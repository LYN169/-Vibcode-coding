import { useEffect, useState } from "react";
import styled from "styled-components";
import useMoveTo from "@/hooks/useMoveTo";
import AutoFit from "@/components/autoFit";
import { usePlanningStore } from "../stores";
import { loadStats } from "@/utils/loadStats";
import type { PlanningStats } from "@/types/stats";

const GridWrapper = styled.div`
  flex: 1; min-height: 0; display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: auto auto 1fr;
  gap: 16px; padding: 16px;
`;
const Card = styled.div`
  position: relative;
  background: rgba(255, 245, 232, 0.65);
  border: 1px solid rgba(255, 145, 0, 0.3);
  padding: 14px; backdrop-filter: blur(4px); border-radius: 4px;
  pointer-events: auto; z-index: 9999;
  &::before { content: ""; position: absolute; top: -1px; left: -1px; width: 10px; height: 10px; border-top: 2px solid #ea580c; border-left: 2px solid #ea580c; }
  &::after { content: ""; position: absolute; bottom: -1px; right: -1px; width: 10px; height: 10px; border-bottom: 2px solid #ea580c; border-right: 2px solid #ea580c; }
`;
const CardTitle = styled.div`
  font-size: 15px; margin-bottom: 8px; padding-left: 8px; border-left: 3px solid #fdb961;
  display: flex; justify-content: space-between; align-items: center; color: #5a4a42;
  span { font-size: 9px; color: rgba(0,0,0,0.35); font-weight: normal; }
`;
const StatItem = styled.div`
  display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  &:last-child { border-bottom: none; }
  .label { color: #888; }
  .value { font-weight: 600; color: #333; }
`;
const ToggleBar = styled.div` display: flex; gap: 8px; flex-wrap: wrap; `;
const ToggleBtn = styled.button<{ $active: boolean }>`
  padding: 4px 12px; border-radius: 4px; font-size: 11px; border: 1px solid ${(p) => (p.$active ? "#ea580c" : "rgba(0,0,0,0.15)")};
  background: ${(p) => (p.$active ? "rgba(234,88,12,0.12)" : "transparent")};
  color: ${(p) => (p.$active ? "#ea580c" : "#888")}; cursor: pointer;
`;
const Header = styled.div`
  padding: 16px 20px 0;
  h1 { font-size: 26px; color: #5a4a42; margin: 0; }
  p { font-size: 12px; color: #999; margin: 4px 0 0; }
`;

export default function Panel() {
  const [stats, setStats] = useState<PlanningStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const topBox = useMoveTo("toBottom", 0.6);
  const leftBox = useMoveTo("toRight", 0.8, 0.5);
  const leftBox2 = useMoveTo("toRight", 0.8, 0.7);
  const rightBox = useMoveTo("toLeft", 0.8, 0.5);
  const rightBox2 = useMoveTo("toLeft", 0.8, 0.7);
  const showCurrent = usePlanningStore((s) => s.showCurrent);
  const showPlanned = usePlanningStore((s) => s.showPlanned);
  const showRoads = usePlanningStore((s) => s.showRoads);
  const toggle = usePlanningStore((s) => s.toggle);

  useEffect(() => { loadStats().then(setStats).catch((e) => setError(String(e))); }, []);

  useEffect(() => {
    const unsub = usePlanningStore.subscribe((s) => s.mapPlayComplete, (v) => {
      if (v) { topBox.restart(); leftBox.restart(); leftBox2.restart(); rightBox.restart(); rightBox2.restart(); }
    });
    return () => unsub();
  }, []);

  const location = stats?.location;
  const planning = stats?.planning;
  const population = stats?.population;
  const currentLU = stats?.currentLanduse;
  const dashboardCards = stats?.dashboardCards ?? [];

  return (
    <AutoFit>
      <Header ref={topBox.ref}>
        <h1>{stats?.displayTitle ?? "国土空间规划数字大屏"}</h1>
        <p>{location ? `${location.province}${location.city}${location.county}${location.town}` : ""} · {planning?.planningPeriod ?? ""}</p>
      </Header>
      <GridWrapper>
        {/* Layer toggles */}
        <Card ref={leftBox.ref} style={{ gridArea: "1 / 1 / 2 / 3" }}>
          <CardTitle>图层控制<span>LAYER CONTROL</span></CardTitle>
          <ToggleBar>
            <ToggleBtn $active={showCurrent} onClick={() => toggle("showCurrent")}>现状用地</ToggleBtn>
            <ToggleBtn $active={showPlanned} onClick={() => toggle("showPlanned")}>规划用地</ToggleBtn>
            <ToggleBtn $active={showRoads} onClick={() => toggle("showRoads")}>规划道路</ToggleBtn>
          </ToggleBar>
        </Card>
        {/* Planning info */}
        <Card ref={rightBox2.ref} style={{ gridArea: "1 / 3 / 2 / 5" }}>
          <CardTitle>规划定位<span>POSITIONING</span></CardTitle>
          {planning && (
            <>
              <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6, marginBottom: 8 }}>
                {planning.overallGoal.slice(0, 120)}...
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {planning.strategicPositioning.slice(0, 5).map((s) => (
                  <span key={s} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(234,88,12,0.1)", color: "#ea580c" }}>{s}</span>
                ))}
              </div>
            </>
          )}
          {!planning && !error && <div style={{ color: "#999", fontSize: 12 }}>加载中...</div>}
        </Card>
        {/* Area stats from currentLanduse */}
        <Card ref={leftBox2.ref} style={{ gridArea: "2 / 1 / 4 / 2" }}>
          <CardTitle>现状用地结构<span>LAND USE</span></CardTitle>
          {error && <div style={{ color: "red", fontSize: 11 }}>加载失败: {error}</div>}
          {currentLU && currentLU.categories.slice(0, 8).map((cat) => (
            <StatItem key={cat.code}>
              <span className="label">{cat.name}</span>
              <span className="value">{cat.sharePercent}%</span>
            </StatItem>
          ))}
          {!currentLU && !error && <div style={{ color: "#999", fontSize: 12 }}>加载中...</div>}
        </Card>
        {/* Population + Planning info */}
        <Card ref={rightBox.ref} style={{ gridArea: "2 / 4 / 4 / 5" }}>
          <CardTitle>基本指标<span>KEY METRICS</span></CardTitle>
          {planning && (
            <>
              <StatItem><span className="label">规划范围</span><span className="value">{planning.areaKm2} km²</span></StatItem>
              <StatItem><span className="label">规划面积</span><span className="value">{planning.areaMu.toLocaleString()} 亩</span></StatItem>
              <StatItem><span className="label">规划周期</span><span className="value">{planning.planningPeriod}</span></StatItem>
              <StatItem><span className="label">基期年</span><span className="value">{planning.baseYear}</span></StatItem>
            </>
          )}
          {population?.countyProxy && (
            <StatItem><span className="label">县域城镇化率</span><span className="value">{population.countyProxy.urbanizationRate2024Percent}%</span></StatItem>
          )}
        </Card>
        {/* Dashboard cards preview */}
        {dashboardCards.length > 0 && (
          <Card style={{ gridArea: "4 / 1 / 6 / 5" }}>
            <CardTitle>数据面板<span>DASHBOARD CARDS</span></CardTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {dashboardCards.slice(0, 10).map((card) => (
                <span key={card.title} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 4, background: "rgba(234,88,12,0.06)", color: "#555" }}>
                  {card.title}{card.value != null ? `: ${card.value}${card.unit ?? ""}` : ""}
                </span>
              ))}
            </div>
          </Card>
        )}
      </GridWrapper>
    </AutoFit>
  );
}
