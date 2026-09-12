import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Line } from "@react-three/drei";
import { gsap } from "gsap";
import { type Group, PerspectiveCamera, OrthographicCamera, Shape, DoubleSide } from "three";
import { loadGeoJson } from "@/utils/loadGeoJson";
import { loadCsv, parseScenicDetailRows } from "@/utils/loadCsv";
import { fitToBounds } from "@/utils/fitToBounds";
import { projectCoord } from "@/utils/projection";
import { useWugongStore } from "../stores";
import PlanningLayers from "./planningLayers";
import StatusLayers from "./statusLayers";
import SatelliteBaseMap from "./SatelliteBaseMap";
import type { BoundaryFC, LanduseFC, RoadFC } from "@/types/planning";
import type { ScenicSpotFC } from "@/types/tourism";

export interface HoverInfo {
  props: Record<string, unknown>; type: string;
  worldPos: [number, number, number]; screenX: number; screenY: number;
}
interface MapProps { onHoverChange?: (info: HoverInfo | null) => void; }

/* ── Debug bbox ── */
function DebugBBox({ fit }: { fit: { projBbox: { minX: number; maxX: number; minY: number; maxY: number } } }) {
  const { minX, maxX, minY, maxY } = fit.projBbox;
  const pts: [number, number, number][] = [[minX, minY, 10], [maxX, minY, 10], [maxX, maxY, 10], [minX, maxY, 10], [minX, minY, 10]];
  return <Line points={pts} color="#00ffff" lineWidth={1} />;
}

/* ── Base extrusion (3D mode only) ── */
function BaseExtrusion({ boundary, projection }: { boundary: BoundaryFC; projection: ReturnType<typeof import("d3-geo").geoMercator> }) {
  const shapes = useMemo(() => {
    const result: Shape[] = [];
    boundary.features.forEach((f) => {
      const coords = (f.geometry.coordinates as number[][][]);
      coords.forEach((ring) => {
        const pts = ring.map((c) => projectCoord(projection, c as [number, number]));
        if (pts.length >= 4) {
          try { result.push(new Shape(pts)); } catch { /* skip */ }
        }
      });
    });
    return result;
  }, [boundary, projection]);

  return (
    <group position-z={-2}>
      {shapes.map((shape, i) => (
        <mesh key={i} rotation={[0, 0, 0]} position-z={0}>
          <extrudeGeometry args={[shape, { depth: 2, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.2, steps: 1 }]} />
          <meshBasicMaterial color="#1a2744" transparent opacity={0.55} side={DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Scene content ── */
function SceneContent({ onHoverChange }: MapProps) {
  const groupRef = useRef<Group>(null!);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const set = useThree((s) => s.set);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const activeMode = useWugongStore((s) => s.activeMode);
  const viewMode = useWugongStore((s) => s.viewMode);
  const showSatellite = useWugongStore((s) => s.showSatellite);

  const [data, setData] = useState<{
    boundary: BoundaryFC; currentLU: LanduseFC; plannedLU: LanduseFC;
    roads: RoadFC; spots: ScenicSpotFC; details: Record<string, string>[];
  } | null>(null);

  useEffect(() => {
    Promise.all([
      loadGeoJson<BoundaryFC>("boundary.geojson"), loadGeoJson<LanduseFC>("current_landuse.geojson"),
      loadGeoJson<LanduseFC>("planned_landuse.geojson"), loadGeoJson<RoadFC>("planned_roads.geojson"),
      loadGeoJson<ScenicSpotFC>("scenic_spots.geojson"), loadCsv("scenic_detail.csv").then(parseScenicDetailRows),
    ]).then(([b, c, p, r, s, rows]) => {
      setData({ boundary: b, currentLU: c, plannedLU: p, roads: r, spots: s, details: rows });
      setLoaded(true);
    }).catch((e: unknown) => setError(String(e)));
  }, []);

  const fit = useMemo(() => {
    if (!data) return null;
    return fitToBounds([data.boundary], 100);
  }, [data]);

  const fitParamsRef = useRef<{ halfW: number; halfH: number; maxDim: number; distance3D: number } | null>(null);

  // Camera setup
  useEffect(() => {
    if (!loaded || !fit) return;
    const { width: pw, height: ph } = fit.projBbox;
    const maxDim = Math.max(pw, ph);
    const pad2D = 1.25;
    const pad3D = 1.35;
    const fov = 50;
    const distance3D = (maxDim * pad3D) / (2 * Math.tan((fov * Math.PI / 180) / 2));
    const aspect = size.width / size.height;
    let halfW: number, halfH: number;
    if (pw / ph > aspect) { halfW = (pw / 2) * pad2D; halfH = halfW / aspect; }
    else { halfH = (ph / 2) * pad2D; halfW = halfH * aspect; }

    fitParamsRef.current = { halfW, halfH, maxDim, distance3D };

    if (viewMode === "3d") {
      if (!(camera instanceof PerspectiveCamera)) {
        const newCam = new PerspectiveCamera(fov, aspect, 1, distance3D * 6);
        newCam.position.set(0, -distance3D * 0.7, distance3D * 0.9);
        newCam.up.set(0, 0, 1);
        newCam.lookAt(0, 0, 0);
        set({ camera: newCam });
      } else {
        camera.fov = fov;
        camera.aspect = aspect;
        camera.near = 1;
        camera.far = distance3D * 6;
        camera.position.set(0, -distance3D * 0.7, distance3D * 0.9);
        camera.up.set(0, 0, 1);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      }
    } else {
      if (!(camera instanceof OrthographicCamera)) {
        const newCam = new OrthographicCamera(-halfW, halfW, halfH, -halfH, -500, 500);
        newCam.position.set(0, 0, 200);
        newCam.up.set(0, 1, 0);
        newCam.lookAt(0, 0, 0);
        set({ camera: newCam });
      } else {
        camera.left = -halfW; camera.right = halfW;
        camera.top = halfH; camera.bottom = -halfH;
        camera.near = -500; camera.far = 500;
        camera.position.set(0, 0, 200);
        camera.up.set(0, 1, 0);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      }
    }

    useWugongStore.setState({ mapReady: true });
    console.log("=== Wugong Camera Fit Debug ===", { viewMode, projBbox: fit.projBbox, distance3D: distance3D.toFixed(0), halfW: halfW.toFixed(1) });
  }, [loaded, fit, viewMode, camera, size, set]);

  // Resize
  useEffect(() => {
    if (!fit) return;
    const h = () => {
      const p = fitParamsRef.current; if (!p) return;
      const a = window.innerWidth / window.innerHeight;
      if (viewMode === "2d" && camera instanceof OrthographicCamera) {
        const { width: pw, height: ph } = fit.projBbox;
        const pad = 1.25;
        let hw: number, hh: number;
        if (pw / ph > a) { hw = (pw / 2) * pad; hh = hw / a; }
        else { hh = (ph / 2) * pad; hw = hh * a; }
        camera.left = -hw; camera.right = hw;
        camera.top = hh; camera.bottom = -hh;
        camera.updateProjectionMatrix();
        fitParamsRef.current = { ...p, halfW: hw, halfH: hh };
      } else if (viewMode === "3d" && camera instanceof PerspectiveCamera) {
        camera.aspect = a;
        camera.updateProjectionMatrix();
      }
    };
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [camera, fit, viewMode]);

  // Reset view
  const resetView = useCallback(() => {
    const p = fitParamsRef.current; if (!p) return;
    if (viewMode === "3d" && camera instanceof PerspectiveCamera) {
      gsap.to(camera.position, {
        x: 0, y: -p.distance3D * 0.7, z: p.distance3D * 0.9,
        duration: 1.2, ease: "circ.out",
      });
    } else if (viewMode === "2d" && camera instanceof OrthographicCamera) {
      gsap.to(camera, {
        left: -p.halfW, right: p.halfW, top: p.halfH, bottom: -p.halfH,
        duration: 1.2, ease: "circ.out",
        onUpdate: () => camera.updateProjectionMatrix(),
      });
    }
  }, [camera, viewMode]);
  useEffect(() => { (window as any).__wugongResetView = resetView; }, [resetView]);

  if (error) return <Html center><div style={{ color:"red",background:"#111",padding:16,borderRadius:8 }}>加载失败: {error}</div></Html>;
  if (!loaded || !fit) return <Html center><div style={{ color:"#ccc",background:"#1a1a2e",padding:16,borderRadius:8 }}>加载中...</div></Html>;

  const satOpacity = activeMode === "status" ? 0.85 : 0.30;

  return (
    <group ref={groupRef} position={[fit.offset[0], fit.offset[1], 0]}>
      <SatelliteBaseMap projection={fit.projection} opacity={satOpacity} visible={showSatellite} />

      {/* Base extrusion in 3D mode */}
      {viewMode === "3d" && <BaseExtrusion boundary={data!.boundary} projection={fit.projection} />}

      {activeMode === "planning" ? (
        <PlanningLayers boundary={data!.boundary} currentLU={data!.currentLU} plannedLU={data!.plannedLU}
          roads={data!.roads} projection={fit.projection} onHoverChange={onHoverChange} />
      ) : (
        <StatusLayers boundary={data!.boundary} spots={data!.spots} details={data!.details}
          projection={fit.projection} onHoverChange={onHoverChange} />
      )}

      <DebugBBox fit={fit} />
    </group>
  );
}

export default function Map({ onHoverChange }: MapProps) {
  const viewMode = useWugongStore((s) => s.viewMode);
  return (
    <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <Canvas
        camera={{ manual: true } as any}
        dpr={[1, 2]} style={{ width: "100%", height: "100%" }}
        gl={{ preserveDrawingBuffer: false }}
      >
        <color attach="background" args={["#0d1117"]} />
        <ambientLight intensity={3} />
        <directionalLight intensity={5} position={[50, -50, 100]} color="#ffffff" />
        <SceneContent onHoverChange={onHoverChange} />
        <OrbitControls
          enablePan enableZoom
          enableRotate={viewMode === "3d"}
          zoomSpeed={0.5}
          target={[0, 0, 0]}
          maxPolarAngle={viewMode === "3d" ? Math.PI * 0.48 : Math.PI * 0.49}
          minPolarAngle={Math.PI * 0.08}
          minDistance={viewMode === "3d" ? 30 : 5}
          maxDistance={viewMode === "3d" ? 600 : 500}
        />
      </Canvas>
      <div style={{ position:"absolute",bottom:20,right:20,zIndex:1001,display:"flex",gap:6 }}>
        <button onClick={() => useWugongStore.getState().setViewMode("3d")}
          style={{ padding:"6px 14px",borderRadius:8,border:"1px solid rgba(255,255,255,0.15)",background: viewMode==="3d"?"rgba(234,88,12,0.25)":"rgba(15,18,28,0.85)",color: viewMode==="3d"?"#f59e0b":"#ccc",fontSize:12,cursor:"pointer" }}>
          3D立体
        </button>
        <button onClick={() => useWugongStore.getState().setViewMode("2d")}
          style={{ padding:"6px 14px",borderRadius:8,border:"1px solid rgba(255,255,255,0.15)",background: viewMode==="2d"?"rgba(234,88,12,0.25)":"rgba(15,18,28,0.85)",color: viewMode==="2d"?"#f59e0b":"#ccc",fontSize:12,cursor:"pointer" }}>
          2D正射
        </button>
        <button onClick={() => (window as any).__wugongResetView?.()}
          style={{ padding:"6px 14px",borderRadius:8,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(15,18,28,0.85)",color:"#ccc",fontSize:12,cursor:"pointer" }}>
          重置视角
        </button>
      </div>
    </div>
  );
}
