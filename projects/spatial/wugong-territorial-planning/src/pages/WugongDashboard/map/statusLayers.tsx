import { useCallback, useMemo, useState } from "react";
import { DoubleSide } from "three";
import { Line, Html } from "@react-three/drei";
import { projectCoord } from "@/utils/projection";
import { LAYERS } from "@/config/layers";
import type { BoundaryFC } from "@/types/planning";
import type { ScenicSpotFC } from "@/types/tourism";
import type { HoverInfo } from "./index";

interface Props {
  boundary: BoundaryFC; spots: ScenicSpotFC; details: Record<string, string>[];
  projection: ReturnType<typeof import("d3-geo").geoMercator>;
  onHoverChange?: (info: HoverInfo | null) => void;
}

/** Single enhanced scenic spot marker with glow ring */
function SpotMarker({
  pos, name, isHov, isActive, isSatellite,
  onClick, onPointerOver, onPointerOut,
}: {
  pos: [number, number, number];
  name: string;
  isHov: boolean; isActive: boolean; isSatellite: boolean;
  onClick: () => void;
  onPointerOver: (e: any) => void;
  onPointerOut: () => void;
}) {
  const s = isHov || isActive ? 1.6 : 1;
  const mainColor = isSatellite ? "#ffd166" : "#d946ef";
  const hovColor = "#ffffff";
  const color = isHov || isActive ? hovColor : mainColor;
  const glowColor = isSatellite ? "#ffd166" : "#a78bfa";

  return (
    <group position={pos}>
      {/* Outer glow ring */}
      <mesh scale={[s * 1.8, s * 1.8, 1]} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.55, 0.7, 32]} />
        <meshBasicMaterial color={glowColor} transparent opacity={isHov || isActive ? 0.7 : 0.35} side={DoubleSide} depthWrite={false} />
      </mesh>
      {/* Main dot */}
      <mesh scale={[s, s, s]}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}>
        <circleGeometry args={[0.6, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} side={DoubleSide} depthWrite={false} />
      </mesh>
      {/* Center bright spot */}
      <mesh scale={[s * 0.65, s * 0.65, 1]}>
        <circleGeometry args={[0.25, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} side={DoubleSide} depthWrite={false} />
      </mesh>
      {/* Name label on hover or active */}
      {(isHov || isActive) && (
        <Html center position={[0, 1.0, 0]} distanceFactor={60} style={{ pointerEvents: "none" }}>
          <div style={{
            background: "rgba(0,0,0,0.75)", color: "#fff", padding: "2px 10px", borderRadius: 6,
            fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}>{name}</div>
        </Html>
      )}
    </group>
  );
}

export default function StatusLayers({ boundary, spots, details, projection, onHoverChange }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const findDetail = (name: string, fid: number) =>
    details.find((d) => String(d.FID) === String(fid) || (d["name"] || d["景点名称"] || "") === name);

  const hoverOff = useCallback(() => { setHoveredIdx(null); onHoverChange?.(null); }, [onHoverChange]);

  // Precompute spot data
  const spotData = useMemo(() => spots.features.map((f) => {
    const p = f.properties;
    const detail = findDetail(String(p.name ?? ""), Number(p.FID ?? 0));
    return {
      name: String(p.name ?? "暂无名称"),
      cat: String(p["大类"] ?? ""), mid: String(p["中类"] ?? ""), sub: String(p["小类"] ?? ""),
      addr: String(p.address ?? ""),
      intro: detail?.["景点介绍（80–150字）"] ?? detail?.["景点介绍"] ?? detail?.["intro"] ?? "",
      time: detail?.["推荐游览时长"] ?? detail?.["recommend_time"] ?? "",
      tags: detail?.["标签"] ? String(detail["标签"]).split(/[,，]/).map((t: string) => t.trim()) : [],
      source: detail?.["编写依据"] ?? detail?.["baike_url"] ?? "",
      level: detail?.["文保级"] ?? "",
    };
  }), [spots, details]);

  // Expose active spot for parent overlay
  const active = activeIdx != null ? spotData[activeIdx] : null;
  if (active) {
    (window as any).__wugongActiveSpot = active;
    (window as any).__wugongClearActiveSpot = () => setActiveIdx(null);
  }

  return (
    <>
      {/* Boundary */}
      {boundary.features.map((f, i) =>
        (f.geometry.coordinates as number[][][]).map((ring, j) => {
          const pts = ring.map((c) => projectCoord(projection, c as [number, number]));
          return <Line key={`bd-${i}-${j}`} points={pts.map((p) => [p.x, p.y, 4] as [number,number,number])} color={LAYERS.boundary.lineColor!} lineWidth={2.5} />;
        }),
      )}

      {/* Spot markers */}
      {spots.features.map((f, i) => {
        const coords = f.geometry.coordinates as number[];
        const [x, y] = projection(coords as [number, number])!;
        const pos: [number, number, number] = [x, -y, 8];
        const sd = spotData[i];
        return (
          <SpotMarker key={`sp-${i}`}
            pos={pos} name={sd.name}
            isHov={hoveredIdx === i} isActive={activeIdx === i} isSatellite={true}
            onClick={() => setActiveIdx(activeIdx === i ? null : i)}
            onPointerOver={(e) => { e.stopPropagation(); setHoveredIdx(i);
              onHoverChange?.({ props: f.properties, type: "景点", worldPos: [x, -y, 3.5], screenX: e.nativeEvent.clientX, screenY: e.nativeEvent.clientY }); }}
            onPointerOut={hoverOff}
          />
        );
      })}
    </>
  );
}
