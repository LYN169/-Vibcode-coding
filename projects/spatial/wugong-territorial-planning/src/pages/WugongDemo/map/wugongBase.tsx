import { useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import { Box2, DoubleSide, Path, Shape, ShapeGeometry, Vector2, Mesh, LineSegments, type Group } from "three";
import { Line, Html } from "@react-three/drei";
import { geoMercator } from "d3-geo";
import { useWugongStore } from "../stores";
import { formatArea, formatLength } from "@/utils/formatters";
import SatelliteBaseMap from "@/pages/WugongDashboard_backup/map/SatelliteBaseMap";
import type { WugongData } from "./scene";
import styled from "styled-components";

interface StyleEntry { value: string; label: string; fillColor: string; lineColor: string; opacity: number; lineWidth: number; }
interface LayerStyle { matchField: string; defaultFill: string; defaultLine: string; defaultOpacity: number; defaultLineWidth: number; categories: StyleEntry[]; }

type HoverInfo = {
  props: Record<string, unknown>;
  type: string;
  pos: [number, number, number];
};

/* ── Map hover tooltip ── */
const TooltipBox = styled.div`
  background: rgba(5,10,20,0.94); backdrop-filter: blur(14px); border-radius: 10px;
  padding: 12px 16px; color: #e0e0e0; font-size: 14px; pointer-events: none;
  border: 1px solid rgba(130,210,255,0.38); box-shadow: 0 10px 28px rgba(0,0,0,0.42);
  box-sizing: border-box; width: 330px; line-height: 1.45;
  animation: tt-in 0.16s ease-out;
  @keyframes tt-in { from { opacity: 0; transform: translateY(6px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .tt-title { font-weight: 700; margin-bottom: 8px; color: #f59e0b; font-size: 18px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .tt-row { display: flex; justify-content: space-between; padding: 4px 0; gap: 16px; }
  .tt-label { color: #aaa; font-size: 13px; } .tt-value { color: #fff; font-weight: 500; text-align: right; font-size: 14px; }
`;

const TooltipOffset = styled.div`
  transform: translate(-50%, 22px);
  pointer-events: none;
`;

/* ── Spot label ── */
const SpotLabel = styled.div`
  background: rgba(255,255,255,0.92); color: #ea580c; padding: 6px 16px; border-radius: 4px;
  font-size: clamp(22px, 1.2vw, 27px); font-weight: 700; white-space: nowrap;
  border: 1px solid rgba(234,88,12,0.62);
  box-shadow: 0 4px 16px rgba(80,40,0,0.18);
`;

/* ── Spot detail card (DOM overlay) ── */
const DetailCard = styled.div`
  background: rgba(5,10,20,0.94); backdrop-filter: blur(14px); border-radius: 14px;
  padding: 22px 26px; color: #e0e0e0; font-size: 16px;
  border: 1px solid rgba(200,150,60,0.5); box-shadow: 0 12px 36px rgba(0,0,0,0.5);
  box-sizing: border-box; width: min(500px, calc(100vw - 56px));
  max-height: min(68vh, calc(100vh - 210px)); overflow-y: auto; line-height: 1.7;
  h3 { color: #f59e0b; margin: 0 0 6px; font-size: 24px; }
  .meta { font-size: 14px; color: #888; margin-bottom: 12px; }
  .intro { font-size: 16px; color: #ccc; margin: 12px 0; line-height: 1.7; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
  .tag { font-size: 13px; padding: 4px 12px; border-radius: 10px; background: rgba(139,92,246,0.2); color: #c4b5fd; }
  .tag.level { background: rgba(234,88,12,0.2); color: #f59e0b; }
  .btn { display: inline-block; padding: 8px 18px; border-radius: 8px; background: #7c3aed; color: #fff; font-size: 14px; text-decoration: none; cursor: pointer; margin-top: 6px; }
  .close { position: absolute; top: 12px; right: 16px; font-size: 22px; color: #aaa; cursor: pointer; background: none; border: none; }
  &::-webkit-scrollbar { width: 4px; } &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
`;

const DetailOverlay = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
`;

const DetailPositioner = styled.div`
  position: absolute;
  left: clamp(520px, 28vw, 640px);
  bottom: clamp(92px, 11vh, 140px);
  pointer-events: auto;

  @media (max-width: 1280px) {
    left: 24px;
    right: 24px;
    bottom: 88px;
  }
`;

const pn = (p: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (p[k] != null && p[k] !== "") return String(p[k]);
  return "暂无数据";
};

function matchCat(props: Record<string, unknown>, style: LayerStyle, extraFields?: string[]): StyleEntry | undefined {
  const fields = [style.matchField, ...(extraFields || [])];
  for (const field of fields) {
    const v = props[field]; if (v == null || v === "") continue;
    const s = String(v).trim();
    for (const c of style.categories) if (c.value === s) return c;
    for (const c of style.categories) if (s.includes(c.value) || c.value.includes(s)) return c;
  }
  return undefined;
}

function isURL(s: string): boolean { return /^https?:\/\//.test(s.trim()); }
const detailValue = (detail: Record<string, string> | null | undefined, keys: string[]) => {
  if (!detail) return "";
  for (const key of keys) {
    const value = detail[key];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
};
const detailTags = (detail: Record<string, string> | null | undefined) =>
  detailValue(detail, ["标签", "tags", "tag"]).split(/[,，、]/).map((t) => t.trim()).filter(Boolean);
const normalizeFid = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? String(numeric) : raw;
};

const pointsToPath = (pts: Vector2[]) => {
  const path = new Path();
  path.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) path.lineTo(pts[i].x, pts[i].y);
  path.lineTo(pts[0].x, pts[0].y);
  return path;
};

const pointsToShape = (pts: Vector2[]) => {
  const shape = new Shape();
  shape.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) shape.lineTo(pts[i].x, pts[i].y);
  shape.lineTo(pts[0].x, pts[0].y);
  return shape;
};

export default function WugongBase({ data }: { data: WugongData }) {
  const groupRef = useRef<Group>(null!);
  const camera = useThree((s) => s.camera);
  const activeMode = useWugongStore((s) => s.activeMode);
  const mainLayer = useWugongStore((s) => s.mainLayer);
  const showBoundary = useWugongStore((s) => s.showBoundary);
  const showRoads = useWugongStore((s) => s.showRoads);
  const showSpots = useWugongStore((s) => s.showSpots);
  const showSatellite = useWugongStore((s) => s.showSatellite);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [hoveredInfo, setHoveredInfo] = useState<HoverInfo | null>(null);
  const [activeDetail, setActiveDetail] = useState<{ props: Record<string, unknown>; detail: Record<string, string> | null } | null>(null);
  const hoverTimerRef = useRef<number | null>(null);

  const pointerLocalPos = (e: any, z: number): [number, number, number] => {
    if (groupRef.current && e?.point?.clone) {
      const local = groupRef.current.worldToLocal(e.point.clone());
      return [local.x, local.y, z];
    }
    return [0, 0, z];
  };
  const showHover = (key: string, props: Record<string, unknown>, type: string, pos: [number, number, number]) => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    document.body.style.cursor = "pointer";
    setHoveredKey(key);
    setHoveredInfo({ props, type, pos });
  };
  const moveHover = (pos: [number, number, number]) => {
    setHoveredInfo((info) => (info ? { ...info, pos } : info));
  };
  const hideHover = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      document.body.style.cursor = "auto";
      setHoveredKey(null);
      setHoveredInfo(null);
    }, 90);
  };
  useEffect(() => () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }, []);

  const [curStyle, setCurStyle] = useState<LayerStyle | null>(null);
  const [plnStyle, setPlnStyle] = useState<LayerStyle | null>(null);
  const [rdStyle, setRdStyle] = useState<LayerStyle | null>(null);
  useEffect(() => {
    Promise.all([
      fetch("/sc-datav/styles/current_landuse_style.json").then(r => r.json()),
      fetch("/sc-datav/styles/planned_landuse_style.json").then(r => r.json()),
      fetch("/sc-datav/styles/planned_roads_style.json").then(r => r.json()),
    ]).then(([c, p, r]) => { setCurStyle(c); setPlnStyle(p); setRdStyle(r); })
      .catch(() => console.warn("[Wugong] Styles not found"));
  }, []);

  /* ── Spot data with FID matching ── */
  const spotData = useMemo(() => {
    const dm = new Map<string, Record<string, string>>();
    data.details.forEach((d) => {
      const fid = normalizeFid(d.FID ?? d.fid ?? d.id ?? d.ID);
      if (fid) dm.set(fid, d);
    });
    const matched: number[] = []; const unmatched: string[] = [];
    const list = data.spots.features.map((f, i) => {
      const fid = normalizeFid(f.properties.FID ?? (f as { id?: unknown }).id ?? i);
      const detail = dm.get(fid);
      const fidNumber = Number(fid);
      if (detail) { matched.push(Number.isFinite(fidNumber) ? fidNumber : i); } else { unmatched.push(`${fid} (name=${f.properties.name})`); }
      return { idx: i, props: f.properties, detail };
    });
    console.log(`[Spots] total=${list.length} details=${data.details.length} matched=${matched.length} unmatched=${unmatched.length}`);
    if (unmatched.length) console.log("[Spots] unmatched:", unmatched.slice(0, 10));
    return list;
  }, [data.spots, data.details]);

  /* ── Projection ── */
  const { center } = useMemo(() => {
    const bb = new Box2();
    data.boundary.features.forEach((f) => (f.geometry.coordinates as number[][][]).forEach((ring) => ring.forEach((c) => bb.expandByPoint(new Vector2(c[0], c[1])))));
    const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
    return { center: [cx, cy] as [number, number] };
  }, [data.boundary]);
  const projection = useMemo(() => geoMercator().center(center).translate([0, 0]), [center]);
  const projBbox = useMemo(() => {
    const pb = new Box2();
    data.boundary.features.forEach((f) => (f.geometry.coordinates as number[][][]).forEach((ring) => ring.forEach((c) => {
      const p = projection(c as [number, number]); if (p) pb.expandByPoint(new Vector2(p[0], -p[1]));
    })));
    return pb;
  }, [data.boundary, projection]);
  const finalScale = useMemo(() => { const w = projBbox.max.x - projBbox.min.x, h = projBbox.max.y - projBbox.min.y; return (80 / Math.max(w, h, 0.001)) * 1000; }, [projBbox]);
  const fp = useMemo(() => geoMercator().center(center).scale(finalScale).translate([0, 0]), [center, finalScale]);
  const ocx = (projBbox.min.x + projBbox.max.x) / 2, ocy = (projBbox.min.y + projBbox.max.y) / 2;
  const proj2 = (c: number[]) => { const p = fp(c as [number, number])!; return new Vector2(p[0], -p[1]); };

  /* ── Camera animation ── */
  useLayoutEffect(() => {
    if (!groupRef.current) return;
    const tl = gsap.timeline({ onComplete: () => useWugongStore.setState({ mapPlayComplete: true }) });
    tl.to(camera.position, { x: 40, y: 120, z: 150, duration: 2, ease: "circ.out" });
    tl.to(groupRef.current.scale, { x: 1, y: 1, z: 1, duration: 1, ease: "circ.out" }, 2);
    groupRef.current.traverse((obj) => { if (obj instanceof Mesh || obj instanceof LineSegments) tl.to(obj.material, { opacity: 1, duration: 1, ease: "circ.out" }, 2); });
    return () => { tl.kill(); };
  }, [camera]);

  /* ── Polygon renderer ── */
  const renderPoly = (fc: typeof data.plannedLU, style: LayerStyle | null, z: number, prefix: string, typeLabel: string, extraMF?: string[]) => {
    if (!style) return null;
    const nodes: React.ReactNode[] = [];
    fc.features.forEach((f, fi) => {
      const polys: number[][][][] = f.geometry.type === "MultiPolygon" ? (f.geometry.coordinates as number[][][][]) : [(f.geometry.coordinates as number[][][])];
      polys.forEach((poly, pi) => {
        const pts = (poly[0] as number[][]).map(proj2); if (pts.length < 3) return;
        try {
          const shape = pointsToShape(pts);
          poly.slice(1).forEach((ring) => {
            const holePts = (ring as number[][]).map(proj2);
            if (holePts.length >= 3) shape.holes.push(pointsToPath(holePts));
          });
          const cat = matchCat(f.properties, style, extraMF);
          const fill = cat?.fillColor ?? style.defaultFill, line = cat?.lineColor ?? style.defaultLine, op = (cat?.opacity ?? style.defaultOpacity) * 0.7;
          const key = `${prefix}-${fi}-${pi}`, isHov = hoveredKey === key;
          nodes.push(<group key={key}>
            <mesh position-z={isHov ? z + 1.2 : z}
              onPointerOver={(e: any) => { e.stopPropagation(); showHover(key, f.properties, typeLabel, pointerLocalPos(e, z + 2.4)); }}
              onPointerMove={(e: any) => { e.stopPropagation(); moveHover(pointerLocalPos(e, z + 2.4)); }}
              onPointerOut={hideHover}>
              <shapeGeometry args={[shape]} /><meshBasicMaterial color={fill} transparent opacity={op} side={DoubleSide} depthWrite={false} />
            </mesh>
            <lineSegments position-z={z + 0.02}><edgesGeometry args={[new ShapeGeometry(shape)]} /><lineBasicMaterial color={line} transparent opacity={0.7} /></lineSegments>
            {isHov && <>
              <mesh position-z={z + 1.2}><shapeGeometry args={[shape]} /><meshBasicMaterial color="#ffcc00" transparent opacity={0.3} side={DoubleSide} depthWrite={false} /></mesh>
              <lineSegments position-z={z + 1.21}><edgesGeometry args={[new ShapeGeometry(shape)]} /><lineBasicMaterial color="#ffffff" transparent opacity={1} /></lineSegments>
            </>}
          </group>);
        } catch { /* skip */ }
      });
    });
    return nodes;
  };

  const rdDef: LayerStyle = rdStyle || { matchField: "道路类", defaultFill: "#e88040", defaultLine: "#e88040", defaultOpacity: 0.9, defaultLineWidth: 2, categories: [] };

  const satelliteZ = 0;
  const boundaryZ = activeMode === "status" ? 0.08 : 6;
  const spotZ = 0.18;
  const activeSpotDetail = activeDetail?.detail ?? null;
  const activeSpotLevel = detailValue(activeSpotDetail, ["文保级", "heritageLevel", "level"]);
  const activeSpotVisitTime = detailValue(activeSpotDetail, ["推荐游览时长", "recommend_time", "duration"]);
  const activeSpotIntro = detailValue(activeSpotDetail, ["景点介绍（80–150字）", "景点介绍", "intro", "简介"]) || "暂无详细介绍";
  const activeSpotTags = detailTags(activeSpotDetail);
  const activeSpotSource = detailValue(activeSpotDetail, ["编写依据", "source", "资料依据"]);

  return (
    <>
    <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]} position={[-ocx, -ocy, 0]} scale-z={0.01}>
      {/* Satellite — status only */}
      {activeMode === "status" && showSatellite && <SatelliteBaseMap projection={fp} opacity={0.85} visible z={satelliteZ} />}

      {/* Boundary outline — red dashed line, no fill */}
      {showBoundary && data.boundary.features.map((f, i) => (f.geometry.coordinates as number[][][]).map((ring, j) => {
        const pts = ring.map(proj2); if (pts.length < 4) return null;
        // Keep the status boundary nearly flush with the satellite plane.
        const linePts: [number, number, number][] = [...pts, pts[0]].map((p) => [p.x, p.y, boundaryZ] as [number, number, number]);
        return (
          <Line key={`bd-${i}-${j}`} points={linePts}
            color="#e83030" lineWidth={3}
            dashed dashSize={0.6} gapSize={0.3}
            depthTest={false}
          />
        );
      }))}

      {/* Land parcels — z=0.6 (planned) / z=0.75 (current) — ABOVE base */}
      {activeMode === "planning" && mainLayer === "planned_landuse" && renderPoly(data.plannedLU, plnStyle, 0.6, "pl", "规划", ["一类_1","一类用","Landuse_ty","二类_1"])}
      {activeMode === "planning" && mainLayer === "current_landuse" && renderPoly(data.currentLU, curStyle, 0.8, "cu", "现状", ["一级名","一级","二类_1"])}

      {/* Roads — z=4 */}
      {activeMode === "planning" && showRoads && data.roads.features.map((f, i) => {
        const pts = (f.geometry.coordinates as number[][]).map(proj2); if (pts.length < 2) return null;
        const cat = rdStyle ? matchCat(f.properties, rdStyle) : undefined;
        return (<Line key={`rd-${i}`} points={pts.map((p) => [p.x, p.y, 4] as [number,number,number])} color={cat?.lineColor ?? rdDef.defaultLine} lineWidth={cat?.lineWidth ?? rdDef.defaultLineWidth}
          onPointerOver={(e: any) => { e.stopPropagation(); showHover(`rd-${i}`, f.properties, "道路", pointerLocalPos(e, 5)); }}
          onPointerMove={(e: any) => { e.stopPropagation(); moveHover(pointerLocalPos(e, 5)); }}
          onPointerOut={hideHover} />);
      })}

      {/* Scenic spots — warm demo-style markers, no depth test, always on top */}
      {activeMode === "status" && showSpots && spotData.map((sd) => {
        const coords = (data.spots.features[sd.idx].geometry as any).coordinates as number[];
        const p = fp(coords as [number, number])!;
        const pos: [number, number, number] = [p[0], -p[1], spotZ];
        return (
          <group key={`sp-${sd.idx}`}>
            <mesh position={pos} renderOrder={999}>
              <ringGeometry args={[5.8, 7.1, 48]} />
              <meshBasicMaterial color="#fbdf88" transparent opacity={0.48} side={DoubleSide} depthTest={false} depthWrite={false} />
            </mesh>
            <mesh position={[pos[0], pos[1], spotZ + 0.03]} renderOrder={1000}>
              <ringGeometry args={[3.4, 4.15, 48]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.82} side={DoubleSide} depthTest={false} depthWrite={false} />
            </mesh>
            <mesh position={[pos[0], pos[1], spotZ + 0.05]} renderOrder={1000}
              onClick={(e: any) => { e.stopPropagation(); console.log("[Spot] clicked FID:", sd.props.FID, "name:", sd.props.name, "detail:", sd.detail); setActiveDetail({ props: sd.props as Record<string,unknown>, detail: sd.detail ?? null }); }}
              onPointerOver={(e: any) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
              onPointerOut={() => { document.body.style.cursor = "auto"; }}>
              <circleGeometry args={[3.35, 40]} />
              <meshBasicMaterial color="#ea580c" transparent opacity={0.92} side={DoubleSide} depthTest={false} depthWrite={false} />
            </mesh>
            <mesh position={[pos[0], pos[1], spotZ + 0.08]} renderOrder={1001}>
              <circleGeometry args={[1.05, 24]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.95} side={DoubleSide} depthTest={false} depthWrite={false} />
            </mesh>
            <Html center position={[pos[0], pos[1] + 7.4, 20]} zIndexRange={[80, 260]} style={{ pointerEvents: "none" }}>
              <SpotLabel>{String(sd.props.name ?? "暂无")}</SpotLabel>
            </Html>
          </group>
        );
      })}

    </group>

    {/* Tooltip */}
    {hoveredInfo && (<Html position={hoveredInfo.pos} zIndexRange={[1001, 1500]} style={{ pointerEvents: "none" }}>
      <TooltipOffset>
        <TooltipBox>
          {hoveredInfo.type === "道路" ? (<>
            <div className="tt-title">规划道路</div>
            <div className="tt-row"><span className="tt-label">道路类</span><span className="tt-value">{pn(hoveredInfo.props, ["道路类"])}</span></div>
            <div className="tt-row"><span className="tt-label">长度</span><span className="tt-value">{formatLength(hoveredInfo.props.length as number ?? hoveredInfo.props.Shape_Leng as number)}</span></div>
          </>) : hoveredInfo.type === "现状" ? (<>
            <div className="tt-title">{pn(hoveredInfo.props, ["一级名"])}</div>
            <div className="tt-row"><span className="tt-label">二级</span><span className="tt-value">{pn(hoveredInfo.props, ["二级名"])}</span></div>
            <div className="tt-row"><span className="tt-label">面积</span><span className="tt-value">{formatArea(hoveredInfo.props.Shape_Area as number ?? hoveredInfo.props.Area as number)}</span></div>
          </>) : (<>
            <div className="tt-title">{pn(hoveredInfo.props, ["一类_1", "Landuse_ty"])}</div>
            <div className="tt-row"><span className="tt-label">二类</span><span className="tt-value">{pn(hoveredInfo.props, ["二类_1", "二类用"])}</span></div>
            <div className="tt-row"><span className="tt-label">面积</span><span className="tt-value">{formatArea(hoveredInfo.props.Shape_Area as number ?? hoveredInfo.props.Area as number)}</span></div>
          </>)}
        </TooltipBox>
      </TooltipOffset>
    </Html>)}

    {/* Spot detail card — DOM overlay outside Canvas */}
    {activeDetail && (
      <Html fullscreen zIndexRange={[5000, 6000]} style={{ pointerEvents: "auto" }}>
        <DetailOverlay>
        <DetailPositioner>
          <DetailCard>
            <button className="close" onClick={() => setActiveDetail(null)}>✕</button>
            <h3>{String(activeDetail.props.name ?? "暂无名称")}</h3>
            <div className="meta">
              {[String(activeDetail.props["大类"] ?? ""), String(activeDetail.props["中类"] ?? ""), String(activeDetail.props["小类"] ?? "")].filter(Boolean).join(" · ")}
              {activeDetail.props.address ? ` · ${String(activeDetail.props.address)}` : ""}
            </div>
            {activeDetail.detail ? (
              <>
                <div className="tags">
                  {activeSpotLevel ? <span className="tag level">{activeSpotLevel}</span> : null}
                  {activeSpotVisitTime ? <span className="tag">{activeSpotVisitTime}</span> : null}
                </div>
                <div className="intro">
                  {activeSpotIntro}
                </div>
                {activeSpotTags.length > 0 && (
                  <div className="tags">
                    {activeSpotTags.map((t: string) => <span key={t} className="tag">{t}</span>)}
                  </div>
                )}
                {activeSpotSource ? (
                  isURL(activeSpotSource) ? (
                    <a className="btn" href={activeSpotSource} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>查看百科</a>
                  ) : (
                    <div style={{ fontSize: 13, color: "#999", marginTop: 8 }}>资料依据: {activeSpotSource.slice(0, 200)}</div>
                  )
                ) : null}
              </>
            ) : (
              <div className="intro">暂无详细介绍</div>
            )}
            {!activeDetail.detail && <div className="intro">暂无详细介绍</div>}
          </DetailCard>
        </DetailPositioner>
        </DetailOverlay>
      </Html>
    )}
    </>
  );
}
