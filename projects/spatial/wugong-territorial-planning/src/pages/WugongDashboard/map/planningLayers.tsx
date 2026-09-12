import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Shape, ShapeGeometry, Path, DoubleSide } from "three";
import { Line } from "@react-three/drei";
import { projectCoord } from "@/utils/projection";
import { LAYERS } from "@/config/layers";
import { currentLanduseStyle, plannedLanduseStyle, plannedRoadStyle, matchStyle, matchRoadStyle } from "@/config/layerStyles";
import { useWugongStore } from "../stores";
import type { BoundaryFC, LanduseFC, RoadFC } from "@/types/planning";
import type { HoverInfo } from "./index";

interface Props {
  boundary: BoundaryFC; currentLU: LanduseFC; plannedLU: LanduseFC; roads: RoadFC;
  projection: ReturnType<typeof import("d3-geo").geoMercator>;
  onHoverChange?: (info: HoverInfo | null) => void;
}

// ── Stats ──
interface LayerStats { totalFeatures: number; renderedFeatures: number; totalRings: number; renderedRings: number; skippedRings: number; skippedReasons: Record<string, number>; }
function newStats(): LayerStats { return { totalFeatures: 0, renderedFeatures: 0, totalRings: 0, renderedRings: 0, skippedRings: 0, skippedReasons: {} }; }
function addSkip(s: LayerStats, r: string) { s.skippedRings++; s.skippedReasons[r] = (s.skippedReasons[r] || 0) + 1; }

function centroidOf(pts: { x: number; y: number }[]) {
  let sx = 0, sy = 0; for (const p of pts) { sx += p.x; sy += p.y; }
  return { cx: sx / pts.length, cy: sy / pts.length };
}

interface SHP { shape: Shape; cx: number; cy: number; }

function geoToShapes(geom: { type: string; coordinates: unknown }, proj: Props["projection"], stats: LayerStats): SHP[] {
  const result: SHP[] = [];
  const ring = (r: number[][]): SHP | null => {
    const pts = r.map((c) => projectCoord(proj, c as [number, number]));
    if (pts.length < 4) { addSkip(stats, "pts<4"); return null; }
    if (pts.some((p) => !isFinite(p.x) || !isFinite(p.y))) { addSkip(stats, "NaN"); return null; }
    try { const s = new Shape(pts); return { shape: s, ...centroidOf(pts) }; }
    catch { addSkip(stats, "Shape fail"); return null; }
  };
  const hole = (r: number[][]) => { const pts = r.map((c) => projectCoord(proj, c as [number, number])); return pts.length >= 4 ? new Path(pts) : null; };

  if (geom.type === "Polygon") {
    const c = geom.coordinates as number[][][]; if (!c?.length) { addSkip(stats, "empty"); return result; }
    const o = ring(c[0]); if (!o) return result;
    for (let h = 1; h < c.length; h++) { const ho = hole(c[h]); if (ho) o.shape.holes.push(ho); }
    result.push(o);
  } else if (geom.type === "MultiPolygon") {
    const ps = geom.coordinates as number[][][][]; if (!ps?.length) { addSkip(stats, "empty"); return result; }
    for (const p of ps) {
      if (!p?.length) continue;
      const o = ring(p[0]); if (!o) continue;
      for (let h = 1; h < p.length; h++) { const ho = hole(p[h]); if (ho) o.shape.holes.push(ho); }
      result.push(o);
    }
  }
  return result;
}

// ── Memoized shape data per feature ──
interface MemoShape {
  shapes: SHP[];
  sgCache: (ShapeGeometry | null)[];
  fillColor: string; lineColor: string; opacity: number;
  props: Record<string, unknown>;
}

function useMemoShapes(fc: LanduseFC, proj: Props["projection"], style: typeof currentLanduseStyle, stats: LayerStats): MemoShape[] {
  return useMemo(() => fc.features.map((f) => {
    const svcs = geoToShapes(f.geometry, proj, stats);
    const m = matchStyle(f.properties, style.matchFields, style.categories);
    return {
      shapes: svcs,
      sgCache: svcs.map((s) => { try { return new ShapeGeometry(s.shape); } catch { return null; } }),
      fillColor: m?.fillColor ?? style.defaultFill,
      lineColor: m?.lineColor ?? style.defaultLine,
      opacity: m?.opacity ?? style.defaultOpacity,
      props: f.properties,
    };
  }), [fc, proj, style, stats]);
}

export default function PlanningLayers({ boundary, currentLU, plannedLU, roads, projection, onHoverChange }: Props) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const showCurrent = useWugongStore((s) => s.showCurrent);
  const showPlanned = useWugongStore((s) => s.showPlanned);
  const showRoads = useWugongStore((s) => s.showRoads);
  const showBoundary = useWugongStore((s) => s.showBoundary);

  const cs = useRef(newStats()); const ps = useRef(newStats()); const rs = useRef(newStats()); const bs = useRef(newStats());
  cs.current = newStats(); ps.current = newStats(); rs.current = newStats(); bs.current = newStats();
  cs.current.totalFeatures = currentLU.features.length;
  ps.current.totalFeatures = plannedLU.features.length;
  rs.current.totalFeatures = roads.features.length;
  bs.current.totalFeatures = boundary.features.length;

  const logged = useRef(false);
  useEffect(() => { if (logged.current) return; logged.current = true;
    setTimeout(() => {
      for (const [l, s] of [["boundary",bs.current],["current",cs.current],["planned",ps.current],["roads",rs.current]] as const)
        console.log(`[render] ${l}: ${s.renderedFeatures}/${s.totalFeatures} feat, ${s.renderedRings} rings, ${s.skippedRings} skip`);
    }, 100);
  }, []);

  // Memoized shapes
  const curMemo = useMemoShapes(currentLU, projection, currentLanduseStyle, cs.current);
  const plnMemo = useMemoShapes(plannedLU, projection, plannedLanduseStyle, ps.current);

  const hoverOff = useCallback(() => { setHoveredKey(null); onHoverChange?.(null); }, [onHoverChange]);

  // Boundary
  const bdNodes: React.ReactNode[] = [];
  if (showBoundary) {
    boundary.features.forEach((f, i) => {
      (f.geometry.coordinates as number[][][]).forEach((ring, j) => {
        const pts = ring.map((c) => projectCoord(projection, c as [number, number]));
        if (pts.length < 2) { addSkip(bs.current, "pts<2"); return; }
        bdNodes.push(<Line key={`bd-${i}-${j}`} points={pts.map((p) => [p.x, p.y, 4] as [number,number,number])} color={LAYERS.boundary.lineColor!} lineWidth={2} />);
      });
    });
    bs.current.renderedRings = bdNodes.length;
  }

  // Polygon renderer for one layer
  const renderPoly = (items: MemoShape[], z: number, prefix: string, typeLabel: string, stats: LayerStats) => {
    stats.renderedFeatures = items.filter((m) => m.shapes.length > 0).length;
    let ringCount = 0;
    const nodes: React.ReactNode[] = [];
    items.forEach((m, fi) => {
      m.shapes.forEach((swc, si) => {
        const key = `${prefix}-${fi}-${si}`;
        const sg = m.sgCache[si];
        if (!sg) { addSkip(stats, "SG fail"); return; }
        ringCount++;
        const isHov = hoveredKey === key;
        return nodes.push(
          <group key={key}>
            {/* Base polygon */}
            <mesh position-z={z}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredKey(key);
                onHoverChange?.({ props: m.props, type: typeLabel,
                  worldPos: [swc.cx, swc.cy, z + 2.2],
                  screenX: e.nativeEvent.clientX, screenY: e.nativeEvent.clientY }); }}
              onPointerOut={hoverOff}>
              <shapeGeometry args={[swc.shape]} />
              <meshBasicMaterial color={m.fillColor} transparent opacity={m.opacity} side={DoubleSide} depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
            </mesh>
            {/* Outline */}
            <lineSegments position-z={z + 0.015}>
              <edgesGeometry args={[sg]} />
              <lineBasicMaterial color={m.lineColor} transparent opacity={0.7} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
            </lineSegments>
            {/* Hover overlay */}
            {isHov && <>
              <mesh position-z={z + 2.0}>
                <shapeGeometry args={[swc.shape]} />
                <meshBasicMaterial color="#ffcc00" transparent opacity={0.35} side={DoubleSide} depthWrite={false} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
              </mesh>
              <lineSegments position-z={z + 2.01}>
                <edgesGeometry args={[sg]} />
                <lineBasicMaterial color="#ffffff" transparent opacity={1.0} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
              </lineSegments>
            </>}
          </group>
        );
      });
    });
    stats.renderedRings = ringCount;
    return nodes;
  };

  // Roads
  const roadNodes: React.ReactNode[] = [];
  if (showRoads) {
    roads.features.forEach((f, i) => {
      const pts = (f.geometry.coordinates as number[][]).map((c) => projectCoord(projection, c as [number, number]));
      if (pts.length < 2) { addSkip(rs.current, "pts<2"); return; }
      const mid = Math.floor(pts.length / 2);
      const rm = matchRoadStyle(f.properties, plannedRoadStyle.categories);
      const key = `rd-${i}`; const isHov = hoveredKey === key;
      roadNodes.push(
        <Line key={key}
          points={pts.map((p) => [p.x, p.y, (isHov ? 6 : 3)] as [number,number,number])}
          color={isHov ? "#ffffff" : (rm?.lineColor ?? plannedRoadStyle.defaultLine)}
          lineWidth={isHov ? (rm?.lineWidth ?? 2) * 2.5 : (rm?.lineWidth ?? 2)}
          onPointerOver={(e) => { e.stopPropagation(); setHoveredKey(key);
            onHoverChange?.({ props: f.properties, type: "道路", worldPos: [pts[mid].x, pts[mid].y, 1.6], screenX: e.nativeEvent.clientX, screenY: e.nativeEvent.clientY }); }}
          onPointerOut={hoverOff}
        />,
      );
    });
    rs.current.renderedRings = roadNodes.length;
  }

  return <>
    {bdNodes}
    {showCurrent && renderPoly(curMemo, 0.2, "现", "现状", cs.current)}
    {showPlanned && renderPoly(plnMemo, 0, "规", "规划", ps.current)}
    {roadNodes}
  </>;
}
