import { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls, Html, Line } from "@react-three/drei";
import { gsap } from "gsap";
import { Group } from "three";
import Lights from "@/pages/Demo1/map/lights";
import { loadGeoJson } from "@/utils/loadGeoJson";
import { loadCsv, parseScenicDetailRows } from "@/utils/loadCsv";
import { createProjection, projectCoord } from "@/utils/projection";
import { LAYERS } from "@/config/layers";
import { useTourismStore } from "../stores";
import type { BoundaryFC } from "@/types/planning";
import type { ScenicSpotFC } from "@/types/tourism";

const Wrapper = styled.div` position: absolute; inset: 0; width: 100%; height: 100%; `;

const Card = styled.div`
  background: rgba(255,255,255,0.94); backdrop-filter: blur(8px); border-radius: 10px;
  padding: 16px 20px; color: #333; font-size: 12px; min-width: 220px; max-width: 300px;
  border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 4px 20px rgba(0,0,0,0.12); line-height: 1.7;
  h3 { margin: 0 0 4px; font-size: 16px; color: #7c3aed; }
  .type { font-size: 10px; color: #999; margin-bottom: 8px; }
  .intro { font-size: 11px; color: #555; margin: 8px 0; max-height: 80px; overflow-y: auto; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0; }
  .tag { font-size: 10px; padding: 2px 8px; border-radius: 10px; background: rgba(139,92,246,0.1); color: #7c3aed; }
  .btn { display: inline-block; margin-top: 8px; padding: 6px 16px; border-radius: 6px; font-size: 11px;
    background: #7c3aed; color: white; text-decoration: none; cursor: pointer; border: none; }
`;

const CENTER: [number, number] = [108.1072, 34.3348];

function SceneContent() {
  const groupRef = useRef<Group>(null!);
  const camera = useThree((s) => s.camera);
  const [boundary, setBoundary] = useState<BoundaryFC | null>(null);
  const [spots, setSpots] = useState<ScenicSpotFC | null>(null);
  const [details, setDetails] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeSpot, setActiveSpot] = useState<{ name: string; addr?: string; type?: string; cat?: string; intro?: string; time?: string; tags?: string[]; link?: string } | null>(null);
  const [activePos, setActivePos] = useState<[number, number, number]>([0, 0, 0]);

  const projection = useMemo(() => createProjection(CENTER, 12000), []);

  useEffect(() => {
    Promise.all([
      loadGeoJson<BoundaryFC>("boundary.geojson"),
      loadGeoJson<ScenicSpotFC>("scenic_spots.geojson"),
      loadCsv("scenic_detail.csv").then(parseScenicDetailRows),
    ])
      .then(([b, s, rows]) => {
        setBoundary(b);
        setSpots(s);
        setDetails(rows);
      })
      .catch((e: unknown) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!boundary || !groupRef.current) return;
    const tl = gsap.timeline({ onComplete: () => useTourismStore.setState({ mapPlayComplete: true }) });
    tl.to(camera.position, { x: 60, y: 125, z: 160, duration: 2, ease: "circ.out" });
    tl.to(groupRef.current.scale, { x: 1, y: 1, z: 1, duration: 1, ease: "circ.out" }, 2);
    return () => { tl.kill(); };
  }, [boundary, camera]);

  const findDetail = (spotName: string, fid: number): Record<string, string> | undefined => {
    return details.find((d) => {
      const dName = d["name"] ?? d["景点名称"] ?? "";
      return dName === spotName || String(d.FID) === String(fid);
    });
  };

  if (error) return <Html center><div style={{ color:"red",background:"white",padding:16,borderRadius:8 }}>加载失败: {error}</div></Html>;
  if (!boundary || !spots) return <Html center><div style={{ color:"#666",background:"white",padding:16,borderRadius:8 }}>正在加载地图数据...</div></Html>;

  return (
    <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]} scale-z={0.01} position-x={20}>
      {/* Boundary */}
      {boundary.features.map((f, i) =>
        (f.geometry as { coordinates: number[][][] }).coordinates.map((ring, j) => {
          const pts = ring.map((c) => projectCoord(projection, c as [number, number]));
          return <Line key={`b-${i}-${j}`} points={pts.map((p) => [p.x, p.y, 0.3] as [number, number, number])} color={LAYERS.boundary.lineColor!} lineWidth={2} />;
        })
      )}

      {/* Scenic spots as colored spheres */}
      {spots.features.map((f, i) => {
        const coords = (f.geometry as { coordinates: number[] }).coordinates;
        const [x, y] = projection(coords as [number, number])!;
        const pos: [number, number, number] = [x, -y, 2.5];
        const props = f.properties;
        const detail = findDetail(props.name ?? "", props.FID ?? 0);
        const spotData = {
          name: props.name ?? "暂无名称",
          addr: props.address,
          type: props.type ?? (props["大类"] as string),
          cat: (props["中类"] ?? props["大类"]) as string,
          intro: detail?.["intro"] ?? detail?.["景点介绍"] ?? detail?.["景点介绍（80–150字）"],
          time: detail?.["recommend_time"] ?? detail?.["推荐游览时长"],
          tags: detail?.["tags"] ? String(detail["tags"]).split(/[,，]/).map((t: string) => t.trim()) : [],
          link: detail?.["baike_url"] ?? detail?.["百科链接"],
        };
        return (
          <mesh
            key={`spot-${i}`}
            position={pos}
            onClick={() => { setActiveSpot(spotData); setActivePos(pos); }}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; setActiveSpot(spotData); setActivePos(pos); }}
            onPointerOut={() => { document.body.style.cursor = "auto"; }}>
            <sphereGeometry args={[0.6, 16, 16]} />
            <meshBasicMaterial color={LAYERS.scenicSpots.color} />
          </mesh>
        );
      })}

      {/* Detail card */}
      {activeSpot && (
        <Html center position={activePos} distanceFactor={80} zIndexRange={[1001, 1500]} style={{ pointerEvents: "auto" }}>
          <Card>
            <h3>{activeSpot.name}</h3>
            <div className="type">{activeSpot.cat ?? activeSpot.type} {activeSpot.addr ? `· ${activeSpot.addr}` : ""}</div>
            {activeSpot.intro && <div className="intro">{activeSpot.intro.slice(0, 200)}</div>}
            {activeSpot.time && <div><strong>推荐游览:</strong> {activeSpot.time}</div>}
            {activeSpot.tags && activeSpot.tags.length > 0 && (
              <div className="tags">{activeSpot.tags.filter(Boolean).map((t: string) => <span key={t} className="tag">{t}</span>)}</div>
            )}
            {activeSpot.link && (
              <a className="btn" href={activeSpot.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>查看详情</a>
            )}
          </Card>
        </Html>
      )}
    </group>
  );
}

export default function Map() {
  return (
    <Wrapper>
      <Canvas flat camera={{ position: [-50, 125, 250], fov: 50, far: 2000, near: 1 }} dpr={[1, 2]}>
        <color attach="background" args={["#fff5e8"]} />
        <Lights />
        <SceneContent />
        <ContactShadows opacity={0.5} scale={300} blur={0.5} resolution={256} color="#000000" />
        <OrbitControls enablePan enableZoom enableRotate zoomSpeed={0.3} minDistance={100} maxDistance={300} maxPolarAngle={1.5} />
      </Canvas>
    </Wrapper>
  );
}
