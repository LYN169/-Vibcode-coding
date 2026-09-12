import { useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import { Shape, ShapeGeometry, DoubleSide, type Group } from "three";
import { Html, Line } from "@react-three/drei";
import { loadGeoJson } from "@/utils/loadGeoJson";
import { createProjection, projectCoord, safeGet } from "@/utils/projection";
import { LAYERS } from "@/config/layers";
import { usePlanningStore } from "../stores";
import type { LanduseFC, RoadFC, BoundaryFC } from "@/types/planning";
import styled from "styled-components";

const TooltipBox = styled.div`
  background: rgba(255,255,255,0.92); backdrop-filter: blur(8px); border-radius: 8px;
  padding: 10px 14px; color: #333; font-size: 12px; pointer-events: none;
  border: 1px solid rgba(0,0,0,0.1); box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  min-width: 140px; max-width: 260px; line-height: 1.6;
`;
const Title = styled.div` font-weight: 600; margin-bottom: 6px; color: #ea580c; font-size: 13px; `;
const Row = styled.div` display: flex; justify-content: space-between; gap: 12px; font-size: 11px; `;

// Real centroid for the Wugong Town boundary
const CENTER: [number, number] = [108.1072, 34.3348];

// Real property key accessors — tolerate both Chinese field names
const propName = (p: Record<string, unknown>): string => {
  return safeGet(p["一级名"] ?? p["一类_1"] ?? p["Landuse_ty"] ?? p["二级名"] ?? p["二类_1"]);
};
const propCode = (p: Record<string, unknown>): string => {
  return safeGet(p["二级"] ?? p["二类用"] ?? p["二类_1"] ?? p["一级"]);
};
const propClass1 = (p: Record<string, unknown>): string => {
  return safeGet(p["一级名"] ?? p["一类_1"] ?? p["Landuse_ty"]);
};
const propNotes = (p: Record<string, unknown>): string => {
  return safeGet(p["备注"] ?? p["notes"]);
};
const propRoadClass = (p: Record<string, unknown>): string => {
  return safeGet(p["道路类"] ?? p["road_class"]);
};

const areaFromSqM = (p: Record<string, unknown>): string => {
  const areaM2 = (p["Shape_Area"] ?? p["Area"] ?? p["areaM2"]) as number | undefined;
  if (areaM2 != null && areaM2 > 0) {
    if (areaM2 < 10000) return `${(areaM2).toFixed(1)} m²`;
    if (areaM2 < 1000000) return `${(areaM2 / 10000).toFixed(1)} ha`;
    return `${(areaM2 / 1000000).toFixed(2)} km²`;
  }
  return "暂无数据";
};

const roadLenM = (p: Record<string, unknown>): string => {
  const len = (p["length"] ?? p["Shape_Leng"]) as number | undefined;
  if (len != null && len > 0) return `${len.toFixed(1)} m`;
  return "暂无数据";
};

export default function PlanningLayers() {
  const groupRef = useRef<Group>(null!);
  const camera = useThree((s) => s.camera);
  const [boundary, setBoundary] = useState<BoundaryFC | null>(null);
  const [currentLU, setCurrentLU] = useState<LanduseFC | null>(null);
  const [plannedLU, setPlannedLU] = useState<LanduseFC | null>(null);
  const [roads, setRoads] = useState<RoadFC | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<{ props: Record<string, unknown>; pos: [number, number, number]; type: string } | null>(null);

  const showCurrent = usePlanningStore((s) => s.showCurrent);
  const showPlanned = usePlanningStore((s) => s.showPlanned);
  const showRoads = usePlanningStore((s) => s.showRoads);

  useEffect(() => {
    Promise.all([
      loadGeoJson<BoundaryFC>("boundary.geojson"),
      loadGeoJson<LanduseFC>("current_landuse.geojson"),
      loadGeoJson<LanduseFC>("planned_landuse.geojson"),
      loadGeoJson<RoadFC>("planned_roads.geojson"),
    ])
      .then(([b, c, p, r]) => { setBoundary(b); setCurrentLU(c); setPlannedLU(p); setRoads(r); })
      .catch((e) => setError(String(e)));
  }, []);

  const projection = useMemo(() => createProjection(CENTER, 12000), []);

  useEffect(() => {
    if (!boundary || !groupRef.current) return;
    const tl = gsap.timeline({ onComplete: () => usePlanningStore.setState({ mapPlayComplete: true }) });
    tl.to(camera.position, { x: 60, y: 125, z: 160, duration: 2, ease: "circ.out" });
    tl.to(groupRef.current.scale, { x: 1, y: 1, z: 1, duration: 1, ease: "circ.out" }, 2);
    return () => { tl.kill(); };
  }, [boundary, camera]);

  if (error) return <Html center><div style={{ color:"red",background:"white",padding:16,borderRadius:8 }}>地图加载失败: {error}</div></Html>;
  if (!boundary) return <Html center><div style={{ color:"#666",background:"white",padding:16,borderRadius:8 }}>正在加载地图数据...</div></Html>;

  return (
    <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]} scale-z={0.01} position-x={20}>
      {/* Boundary outline */}
      {boundary.features.map((f, i) =>
        (f.geometry as { coordinates: number[][][] }).coordinates.map((ring, j) => {
          const pts = ring.map((c) => projectCoord(projection, c as [number, number]));
          return <Line key={`b-${i}-${j}`} points={pts.map((p) => [p.x, p.y, 0.3] as [number, number, number])} color={LAYERS.boundary.lineColor!} lineWidth={2} />;
        })
      )}

      {/* Current land use */}
      {showCurrent && currentLU && currentLU.features.map((f, i) => {
        const coords = (f.geometry as { coordinates: number[][][] | number[][][][] }).coordinates;
        const polys = f.geometry.type === "MultiPolygon" ? coords as number[][][][] : [coords as number[][][]];
        return polys.map((polyRings, pi) =>
          polyRings.map((ring, j) => {
            const pts = ring.map((c) => projectCoord(projection, c as [number, number]));
            if (pts.length < 3) return null;
            const shape = new Shape(pts);
            const midPt = pts[Math.floor(pts.length / 2)];
            return (
              <group key={`clu-${i}-${pi}-${j}`}>
                <mesh position-z={0.1}
                  onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; setHovered({ props: f.properties, pos: [midPt.x, midPt.y, 0.3], type: "现状" }); }}
                  onPointerOut={() => { document.body.style.cursor = "auto"; setHovered(null); }}>
                  <shapeGeometry args={[shape]} />
                  <meshBasicMaterial color={LAYERS.currentLanduse.color} transparent opacity={LAYERS.currentLanduse.fillOpacity!} side={DoubleSide} />
                </mesh>
                <lineSegments position-z={0.12}>
                  <edgesGeometry args={[new ShapeGeometry(shape)]} />
                  <lineBasicMaterial color={LAYERS.currentLanduse.lineColor!} transparent opacity={LAYERS.currentLanduse.opacity} />
                </lineSegments>
              </group>
            );
          })
        );
      })}

      {/* Planned land use — MultiPolygon aware */}
      {showPlanned && plannedLU && plannedLU.features.map((f, i) => {
        const coords = (f.geometry as { coordinates: number[][][] | number[][][][] }).coordinates;
        const polys = f.geometry.type === "MultiPolygon" ? coords as number[][][][] : [coords as number[][][]];
        return polys.map((polyRings, pi) =>
          polyRings.map((ring, j) => {
            const pts = ring.map((c) => projectCoord(projection, c as [number, number]));
            if (pts.length < 3) return null;
            const shape = new Shape(pts);
            const midPt = pts[Math.floor(pts.length / 2)];
            return (
              <group key={`plu-${i}-${pi}-${j}`}>
                <mesh position-z={1.1}
                  onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; setHovered({ props: f.properties, pos: [midPt.x, midPt.y, 1.3], type: "规划" }); }}
                  onPointerOut={() => { document.body.style.cursor = "auto"; setHovered(null); }}>
                  <shapeGeometry args={[shape]} />
                  <meshBasicMaterial color={LAYERS.plannedLanduse.color} transparent opacity={LAYERS.plannedLanduse.fillOpacity!} side={DoubleSide} />
                </mesh>
                <lineSegments position-z={1.12}>
                  <edgesGeometry args={[new ShapeGeometry(shape)]} />
                  <lineBasicMaterial color={LAYERS.plannedLanduse.lineColor!} transparent opacity={LAYERS.plannedLanduse.opacity} />
                </lineSegments>
              </group>
            );
          })
        );
      })}

      {/* Roads */}
      {showRoads && roads && roads.features.map((f, i) => {
        const coords = (f.geometry as { coordinates: number[][] }).coordinates;
        const pts = coords.map((c) => projectCoord(projection, c as [number, number]));
        const mid = Math.floor(pts.length / 2);
        return (
          <Line
            key={`r-${i}`}
            points={pts.map((p) => [p.x, p.y, 2.2] as [number, number, number])}
            color={LAYERS.plannedRoads.lineColor!}
            lineWidth={1.5}
            onPointerOver={(e: { stopPropagation: () => void }) => { e.stopPropagation(); document.body.style.cursor = "pointer"; setHovered({ props: f.properties, pos: [pts[mid].x, pts[mid].y, 2.5], type: "道路" }); }}
            onPointerOut={() => { document.body.style.cursor = "auto"; setHovered(null); }}
          />
        );
      })}

      {/* Hover tooltip */}
      {hovered && (
        <Html center position={hovered.pos} distanceFactor={100} zIndexRange={[1001, 1500]} style={{ pointerEvents: "none" }}>
          <TooltipBox>
            {hovered.type === "道路" ? (
              <>
                <Title>{propRoadClass(hovered.props)}</Title>
                <Row><span>道路类别</span><span>{propRoadClass(hovered.props)}</span></Row>
                <Row><span>长度</span><span>{roadLenM(hovered.props)}</span></Row>
                <Row><span>FID</span><span>{safeGet(hovered.props.FID)}</span></Row>
              </>
            ) : (
              <>
                <Title>{propClass1(hovered.props)}</Title>
                <Row><span>用地名称</span><span>{propName(hovered.props)}</span></Row>
                <Row><span>用地代码</span><span>{propCode(hovered.props)}</span></Row>
                <Row><span>面积</span><span>{areaFromSqM(hovered.props)}</span></Row>
                <Row><span>状态</span><span>{hovered.type}</span></Row>
                {propNotes(hovered.props) !== "暂无数据" && (
                  <div style={{ marginTop:4, fontSize:10, color:"#999" }}>{propNotes(hovered.props)}</div>
                )}
              </>
            )}
          </TooltipBox>
        </Html>
      )}
    </group>
  );
}
