import { useEffect, useState, useCallback } from "react";
import styled from "styled-components";
import Map, { type HoverInfo } from "./map";
import { useWugongStore } from "./stores";
import { loadStats } from "@/utils/loadStats";
import { formatArea, formatLength, formatNullable } from "@/utils/formatters";
import type { PlanningStats, DashboardCard } from "@/types/stats";

/* ── Styled components ── */

const Wrapper = styled.div`
  position: relative; width: 100vw; height: 100vh; overflow: hidden;
  background: #0a0e17; font-family: system-ui, -apple-system, "Microsoft YaHei", sans-serif;
`;
const Header = styled.div`
  position: absolute; top: 0; left: 0; right: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 28px;
  background: linear-gradient(180deg, rgba(10,14,23,0.95) 60%, rgba(10,14,23,0) 100%);
  h1 { font-size: 22px; color: #e0e0e0; margin: 0; font-weight: 600; letter-spacing: 0.04em; }
  .sub { font-size: 12px; color: #888; margin-left: 16px; }
`;
const ModeBtns = styled.div`
  display: flex; gap: 4px; background: rgba(255,255,255,0.06); border-radius: 8px; padding: 3px; border: 1px solid rgba(255,255,255,0.08);
`;
const ModeBtn = styled.button<{ $active: boolean }>`
  padding: 7px 20px; border-radius: 6px; font-size: 13px; border: none; cursor: pointer;
  background: ${(p) => (p.$active ? "rgba(234,88,12,0.25)" : "transparent")};
  color: ${(p) => (p.$active ? "#f59e0b" : "#888")}; font-weight: ${(p) => (p.$active ? 600 : 400)};
  transition: all 0.2s; &:hover { color: ${(p) => (p.$active ? "#f59e0b" : "#bbb")}; }
`;

/* ── Panels ── */
const LeftPanel = styled.div`
  position: absolute; left: 16px; top: 90px; bottom: 84px; z-index: 900;
  width: 320px; pointer-events: auto; overflow-y: auto;
  display: flex; flex-direction: column; gap: 10px;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
`;
const RightPanel = styled.div`
  position: absolute; right: 16px; top: 90px; bottom: 84px; z-index: 900;
  width: 340px; pointer-events: auto; overflow-y: auto;
  display: flex; flex-direction: column; gap: 10px;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
`;
const PanelCard = styled.div`
  background: rgba(15,18,28,0.88); backdrop-filter: blur(6px); border-radius: 8px;
  padding: 14px; border: 1px solid rgba(255,255,255,0.06);
  h3 { font-size: 14px; color: #f59e0b; margin: 0 0 10px; border-left: 3px solid #f59e0b; padding-left: 8px; }
  .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; color: #999; }
  .val { color: #ddd; font-weight: 500; text-align: right; }
  p { font-size: 12px; color: #aaa; line-height: 1.6; margin: 0; }
  .scroll { max-height: 160px; overflow-y: auto; &::-webkit-scrollbar { width: 3px; } &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; } }
`;
const ToggleBtn = styled.button<{ $active: boolean }>`
  padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer;
  border: 1px solid ${(p) => (p.$active ? "rgba(234,88,12,0.5)" : "rgba(255,255,255,0.08)")};
  background: ${(p) => (p.$active ? "rgba(234,88,12,0.15)" : "transparent")};
  color: ${(p) => (p.$active ? "#f59e0b" : "#888")};
  transition: all 0.2s;
`;

/* ── Bottom bar ── */
const BottomBar = styled.div`
  position: absolute; bottom: 0; left: 0; right: 0; z-index: 900; height: 72px;
  background: rgba(15,18,28,0.92); backdrop-filter: blur(8px);
  border-top: 1px solid rgba(255,255,255,0.06);
  display: flex; align-items: center; padding: 0 28px; gap: 8px;
`;
const BottomCard = styled.div`
  flex: 1; min-width: 0; text-align: center; padding: 0 8px;
  .val { font-size: 18px; font-weight: 700; color: #f59e0b; line-height: 1.2; }
  .unit { font-size: 11px; color: #888; margin-left: 2px; }
  .label { font-size: 11px; color: #aaa; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

/* ── Tooltip ── */
const TooltipOverlay = styled.div<{ x: number; y: number }>`
  position: fixed; left: ${(p) => p.x}px; top: ${(p) => p.y}px; z-index: 9999;
  pointer-events: none; transform: translate(12px, -50%);
  background: rgba(5,12,24,0.90); backdrop-filter: blur(10px);
  border: 1px solid rgba(120,200,255,0.4); border-radius: 12px;
  padding: 16px 20px; min-width: 340px; max-width: 420px;
  color: #e0e0e0; font-size: 14px; line-height: 1.6;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  .tt-title { font-size: 17px; font-weight: 700; color: #f59e0b; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .tt-row { display: flex; justify-content: space-between; padding: 3px 0; gap: 16px; }
  .tt-label { color: #aaa; flex-shrink: 0; }
  .tt-value { color: #fff; font-weight: 500; text-align: right; word-break: break-all; }
  .tt-note { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #999; }
`;

/* ── Spot detail card ── */
const SpotCard = styled.div`
  position: fixed; right: 24px; top: 120px; z-index: 9999; pointer-events: auto;
  background: rgba(5,12,24,0.92); backdrop-filter: blur(10px);
  border: 1px solid rgba(139,92,246,0.4); border-radius: 12px;
  padding: 18px 22px; width: 380px; max-height: 70vh; overflow-y: auto;
  color: #e0e0e0; font-size: 14px; line-height: 1.7;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  h3 { color: #a78bfa; margin: 0 0 6px; font-size: 20px; }
  .meta { font-size: 12px; color: #888; margin-bottom: 10px; }
  .intro { font-size: 13px; color: #bbb; line-height: 1.7; margin-bottom: 10px; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0; }
  .tag { font-size: 11px; padding: 2px 10px; border-radius: 10px; background: rgba(139,92,246,0.15); color: #a78bfa; }
  .btn { display: inline-block; padding: 6px 16px; border-radius: 6px; background: #7c3aed; color: #fff; font-size: 12px; text-decoration: none; }
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
`;

export default function WugongDashboard() {
  const activeMode = useWugongStore((s) => s.activeMode);
  const setMode = useWugongStore((s) => s.setMode);
  const showCurrent = useWugongStore((s) => s.showCurrent);
  const showPlanned = useWugongStore((s) => s.showPlanned);
  const showRoads = useWugongStore((s) => s.showRoads);
  const showBoundary = useWugongStore((s) => s.showBoundary);
  const showSatellite = useWugongStore((s) => s.showSatellite);
  const toggleLayer = useWugongStore((s) => s.toggleLayer);
  const [stats, setStats] = useState<PlanningStats | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [activeSpot, setActiveSpot] = useState<any>(null);

  useEffect(() => {
    const iv = setInterval(() => {
      const s = (window as any).__wugongActiveSpot;
      if (s) setActiveSpot(s);
    }, 300);
    return () => clearInterval(iv);
  }, []);

  const onHoverChange = useCallback((info: HoverInfo | null) => setHover(info), []);

  useEffect(() => {
    loadStats().then(setStats).catch(() => {});
    return () => { useWugongStore.getState().reset(); };
  }, []);

  const loc = stats?.location; const pl = stats?.planning; const pop = stats?.population;
  const ct = stats?.cultureTourism as Record<string, unknown> | undefined;
  const nat = stats?.naturalBase as Record<string, unknown> | undefined;
  const agri = stats?.agriculture as Record<string, unknown> | undefined;
  const ind = stats?.industryEconomy as Record<string, unknown> | undefined;
  const dashboardCards = stats?.dashboardCards ?? [];

  // ── Tooltip content ──
  const tt = hover ? (() => {
    const p = hover.props;
    if (hover.type === "道路") return { title: "规划道路", rows: [["道路类型", formatNullable(p["道路类"])], ["长度", formatLength(p.length as number ?? p.Shape_Leng as number)]] };
    if (hover.type === "现状") return { title: "现状用地", rows: [["一级用地", formatNullable(p["一级名"])], ["二级用地", formatNullable(p["二级名"])], ["用地代码", formatNullable(p["二级"] ?? p["一级"])], ["面积", formatArea(p.Shape_Area as number ?? p.Area as number)]], note: formatNullable(p["备注"]) !== "暂无数据" ? formatNullable(p["备注"]) : undefined };
    if (hover.type === "规划") return { title: "规划用地", rows: [["一类用地", formatNullable(p["一类_1"] ?? p.Landuse_ty)], ["二类用地", formatNullable(p["二类_1"] ?? p["二类用"])], ["用地代码", formatNullable(p["一类用"] ?? p["二类用"])], ["面积", formatArea(p.Shape_Area as number ?? p.Area as number)]] };
    if (hover.type === "景点") return { title: formatNullable(p.name ?? p["景点名称"]), rows: [["类型", formatNullable(p["大类"] ?? p.type)], ["地址", formatNullable(p.address)]] };
    return { title: "", rows: [] as [string, string][] };
  })() : null;

  // ── Render ──

  return (
    <Wrapper>
      <Map onHoverChange={onHoverChange} />

      {/* Tooltip */}
      {tt && hover && (
        <TooltipOverlay x={hover.screenX} y={hover.screenY}>
          <div className="tt-title">{tt.title}</div>
          {tt.rows.map(([l, v]) => <div className="tt-row" key={l}><span className="tt-label">{l}</span><span className="tt-value">{v}</span></div>)}
          {tt.note && <div className="tt-note">{tt.note}</div>}
        </TooltipOverlay>
      )}

      {/* Spot detail card */}
      {activeSpot && (
        <SpotCard>
          <h3>{activeSpot.name}</h3>
          <div className="meta">{[activeSpot.cat, activeSpot.mid, activeSpot.sub, activeSpot.level].filter(Boolean).join(" · ")}{activeSpot.addr ? ` · ${activeSpot.addr}` : ""}</div>
          {activeSpot.intro && <div className="intro">{activeSpot.intro}</div>}
          {activeSpot.time && <div><strong>推荐游览时长:</strong> {activeSpot.time}</div>}
          {activeSpot.tags?.length > 0 && <div className="tags">{activeSpot.tags.filter(Boolean).map((t: string) => <span key={t} className="tag">{t}</span>)}</div>}
          {activeSpot.source && (
            /^https?:\/\//.test(activeSpot.source.trim()) ? (
              <a className="btn" href={activeSpot.source} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>查看百科</a>
            ) : (
              <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>资料依据: {activeSpot.source.slice(0, 150)}</div>
            )
          )}
          <button onClick={() => { (window as any).__wugongClearActiveSpot?.(); setActiveSpot(null); }} style={{ display: "block", marginTop: 10, fontSize: 12, color: "#888", background: "none", border: "none", cursor: "pointer" }}>关闭</button>
        </SpotCard>
      )}

      {/* Header */}
      <Header>
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <h1>{stats?.displayTitle ?? "国土空间规划数字大屏"}</h1>
          <span className="sub">{loc ? `${loc.province}${loc.city}${loc.county}${loc.town}` : ""}{pl ? ` | ${pl.planningPeriod}` : ""}</span>
        </div>
        <ModeBtns>
          <ModeBtn $active={activeMode === "planning"} onClick={() => setMode("planning")}>规划展示</ModeBtn>
          <ModeBtn $active={activeMode === "status"} onClick={() => setMode("status")}>现状概况</ModeBtn>
        </ModeBtns>
      </Header>

      {/* ── Planning mode panels ── */}
      {activeMode === "planning" && (
        <>
          <LeftPanel>
            <PanelCard>
              <h3>图层控制</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <ToggleBtn $active={showSatellite} onClick={() => toggleLayer("showSatellite")}>卫星底图</ToggleBtn>
                <ToggleBtn $active={showBoundary} onClick={() => toggleLayer("showBoundary")}>规划边界</ToggleBtn>
                <ToggleBtn $active={showPlanned} onClick={() => toggleLayer("showPlanned")}>规划用地</ToggleBtn>
                <ToggleBtn $active={showRoads} onClick={() => toggleLayer("showRoads")}>规划道路</ToggleBtn>
                <ToggleBtn $active={showCurrent} onClick={() => toggleLayer("showCurrent")}>现状用地</ToggleBtn>
              </div>
            </PanelCard>
          </LeftPanel>

          {stats && (
            <RightPanel>
              <PanelCard>
                <h3>规划基础指标</h3>
                {pl && <>
                  <div className="row"><span>规划范围</span><span className="val">{pl.areaKm2} km²（{pl.areaMu.toLocaleString()} 亩）</span></div>
                  <div className="row"><span>规划期限</span><span className="val">{pl.planningPeriod}</span></div>
                  <div className="row"><span>基期年</span><span className="val">{pl.baseYear}</span></div>
                  <div className="row"><span>目标年</span><span className="val">{pl.targetYear}</span></div>
                </>}
              </PanelCard>
              <PanelCard>
                <h3>规划定位</h3>
                <p>{pl?.overallGoal?.slice(0, 200) ?? "暂无数据"}</p>
                {pl?.strategicPositioning && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                    {pl.strategicPositioning.map((s: string) => (
                      <span key={s} style={{ fontSize: 11, padding: "2px 10px", borderRadius: 10, background: "rgba(234,88,12,0.1)", color: "#f59e0b" }}>{s}</span>
                    ))}
                  </div>
                )}
              </PanelCard>
              {pl?.coreConcepts && (
                <PanelCard>
                  <h3>发展关键词</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {pl.coreConcepts.map((s: string) => (
                      <span key={s} style={{ fontSize: 12, padding: "3px 12px", borderRadius: 12, background: "rgba(0,180,216,0.12)", color: "#48cae4" }}>{s}</span>
                    ))}
                  </div>
                </PanelCard>
              )}
            </RightPanel>
          )}
        </>
      )}

      {/* ── Status mode panels ── */}
      {activeMode === "status" && stats && (
        <>
          <LeftPanel>
            <PanelCard>
              <h3>区位条件</h3>
              <p>{loc?.description?.slice(0, 200) ?? "暂无数据"}</p>
            </PanelCard>
            <PanelCard>
              <h3>自然基础</h3>
              <div className="scroll">
                {nat?.["climate"] != null && <p>气候: {String((nat["climate"] as Record<string,unknown>).type ?? "暂无")}</p>}
                {nat?.["terrain"] != null && <p style={{ marginTop: 4 }}>地形: {String((nat["terrain"] as Record<string,unknown>).generalPattern ?? "暂无")}</p>}
                {nat?.["hydrologyEcology"] != null && <p style={{ marginTop: 4 }}>{String((nat["hydrologyEcology"] as Record<string,unknown>).summary ?? "").slice(0, 200)}</p>}
              </div>
            </PanelCard>
            <PanelCard>
              <h3>人口现状</h3>
              <p>{pop?.trendSummary?.slice(0, 200) ?? "暂无数据"}</p>
              {pop?.countyProxy?.agingRatio2020Percent != null && (
                <div className="row" style={{ marginTop: 4 }}><span>县域老龄化率</span><span className="val">{pop.countyProxy.agingRatio2020Percent}%</span></div>
              )}
              {pop?.countyProxy?.urbanizationRate2024Percent != null && (
                <div className="row"><span>县域城镇化率</span><span className="val">{pop.countyProxy.urbanizationRate2024Percent}%</span></div>
              )}
            </PanelCard>
            <PanelCard>
              <h3>产业现状</h3>
              <div className="scroll">
                {(ind?.["townIndustryFeatures"] as string[])?.map((f: string, i: number) => (
                  <p key={i} style={{ marginBottom: i < 3 ? 4 : 0 }}>{f}</p>
                )) ?? <p>暂无数据</p>}
              </div>
            </PanelCard>
            <PanelCard>
              <h3>农业基础</h3>
              {agri && <>
                <div className="row"><span>耕地占比</span><span className="val">{String(agri["farmlandSharePercent"] ?? "暂无")}%</span></div>
                <div className="row"><span>水浇地占比</span><span className="val">{String(agri["irrigatedLandSharePercent"] ?? "暂无")}%</span></div>
                <div className="row"><span>旱地占比</span><span className="val">{String(agri["dryLandSharePercent"] ?? "暂无")}%</span></div>
                <div className="row"><span>主导产品</span><span className="val">{formatNullable(agri["leadingProduct"])}</span></div>
              </>}
            </PanelCard>
          </LeftPanel>

          <RightPanel>
            <PanelCard>
              <h3>文旅资源概况</h3>
              {ct && <>
                <div className="row"><span>景点数量</span><span className="val">{ct["scenicSpotsCount"] != null ? String(ct["scenicSpotsCount"]) : "暂无"}</span></div>
                <div className="row"><span>文化集中区</span><span className="val">{ct["culturalConcentrationZonesCount"] != null ? String(ct["culturalConcentrationZonesCount"]) + " 个" : "暂无"}</span></div>
                <div style={{ marginTop: 8 }}>
                  <p><strong>文旅格局:</strong> {(ct["spatialPattern"] as string)?.slice(0, 150) ?? "暂无"}</p>
                </div>
              </>}
            </PanelCard>
            <PanelCard>
              <h3>优势与短板</h3>
              {ct?.["advantages"] != null && (
                <div style={{ marginBottom: 8 }}>
                  <p style={{ color: "#48cae4", fontWeight: 600, marginBottom: 4 }}>优势</p>
                  {(ct["advantages"] as string[]).map((a, i) => <p key={i} style={{ marginBottom: 2 }}>· {String(a)}</p>)}
                </div>
              )}
              {ct?.["problems"] != null && (
                <div>
                  <p style={{ color: "#f59e0b", fontWeight: 600, marginBottom: 4 }}>短板</p>
                  {(ct["problems"] as string[]).map((a, i) => <p key={i} style={{ marginBottom: 2 }}>· {String(a)}</p>)}
                </div>
              )}
            </PanelCard>
            {ct?.["tourismDevelopmentSummary"] != null && (
              <PanelCard>
                <h3>发展方向</h3>
                <p>{String(ct["tourismDevelopmentSummary"] ?? "暂无").slice(0, 250)}</p>
              </PanelCard>
            )}
          </RightPanel>
        </>
      )}

      {/* ── Bottom data bar (both modes) ── */}
      {dashboardCards.length > 0 && (
        <BottomBar>
          {dashboardCards.map((card: DashboardCard) => (
            <BottomCard key={card.title}>
              <div><span className="val">{card.value ?? "暂无数据"}</span>{card.unit && <span className="unit">{card.unit}</span>}</div>
              <div className="label">{card.title}</div>
            </BottomCard>
          ))}
        </BottomBar>
      )}
    </Wrapper>
  );
}
