import { useEffect, useState } from "react";
import styled from "styled-components";
import { useWugongStore } from "./stores";
import Panel from "./panel";
import Map from "./map";
import { loadStats } from "@/utils/loadStats";
import type { PlanningStats } from "@/types/stats";
import type { WugongData } from "./map/scene";

const Wrapper = styled.div` position: relative; width: 100vw; height: 100vh; `;

const ModeBar = styled.div`
  position: absolute; top: 4px; right: 28px; z-index: 1200;
  display: flex; gap: 6px; background: rgba(255,255,255,0.75); backdrop-filter: blur(10px);
  border-radius: 10px; padding: 5px; border: 1px solid rgba(234,88,12,0.25);
`;
const ModeBtn = styled.button<{ $active: boolean }>`
  padding: 7px 20px; border-radius: 7px; font-size: 13px; border: 1px solid ${(p) => (p.$active ? "rgba(234,88,12,0.6)" : "rgba(234,88,12,0.25)")};
  background: ${(p) => (p.$active ? "rgba(234,88,12,0.85)" : "rgba(255,255,255,0.9)")};
  color: ${(p) => (p.$active ? "#fff" : "#374151")};
  font-weight: ${(p) => (p.$active ? 700 : 500)}; cursor: pointer; transition: all 0.15s;
  &:hover { border-color: rgba(234,88,12,0.6); }
`;

const BottomBar = styled.div`
  position: absolute; bottom: 108px; left: 50%; transform: translateX(-50%); z-index: 1001;
  display: flex; gap: 10px; align-items: center;
  background: rgba(255,255,255,0.75); backdrop-filter: blur(10px); border-radius: 10px;
  padding: 8px 14px; border: 1px solid rgba(234,88,12,0.25);
`;
const SectionTitle = styled.div`
  font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap;
`;
const CtrlBtn = styled.button<{ $active: boolean }>`
  padding: 6px 14px; border-radius: 7px; font-size: 12px; border: 1px solid ${(p) => (p.$active ? "rgba(234,88,12,0.6)" : "rgba(0,0,0,0.1)")};
  background: ${(p) => (p.$active ? "rgba(234,88,12,0.15)" : "rgba(255,255,255,0.85)")};
  color: ${(p) => (p.$active ? "#ea580c" : "#374151")};
  font-weight: ${(p) => (p.$active ? 700 : 500)}; cursor: pointer; white-space: nowrap; transition: all 0.15s;
  &:hover { border-color: rgba(234,88,12,0.5); }
`;
const Divider = styled.div` width: 1px; height: 20px; background: rgba(0,0,0,0.1); margin: 0 4px; `;

export default function Index() {
  const activeMode = useWugongStore((s) => s.activeMode);
  const setActiveMode = useWugongStore((s) => s.setActiveMode);
  const mainLayer = useWugongStore((s) => s.mainLayer);
  const setMainLayer = useWugongStore((s) => s.setMainLayer);
  const showBoundary = useWugongStore((s) => s.showBoundary);
  const showRoads = useWugongStore((s) => s.showRoads);
  const showSpots = useWugongStore((s) => s.showSpots);
  const showSatellite = useWugongStore((s) => s.showSatellite);
  const toggleOverlay = useWugongStore((s) => s.toggleOverlay);
  const [stats, setStats] = useState<PlanningStats | null>(null);
  const [wugongData, setWugongData] = useState<WugongData | null>(null);
  const [sidePanelsCollapsed, setSidePanelsCollapsed] = useState(false);
  useEffect(() => { (window as any).__toggleSidePanels = () => setSidePanelsCollapsed(v => !v); }, []);

  useEffect(() => {
    loadStats().then(setStats).catch(() => {});
    return () => useWugongStore.getState().reset();
  }, []);

  return (
    <Wrapper>
      <Map onDataLoad={setWugongData} />
      <ModeBar>
        <ModeBtn $active={activeMode === "planning"} onClick={() => setActiveMode("planning")}>规划展示</ModeBtn>
        <ModeBtn $active={activeMode === "status"} onClick={() => setActiveMode("status")}>现状概况</ModeBtn>
      </ModeBar>

      <BottomBar>
        {activeMode === "planning" ? (
          <>
            <SectionTitle>主图层</SectionTitle>
            <CtrlBtn $active={mainLayer === "planned_landuse"} onClick={() => setMainLayer("planned_landuse")}>规划用地</CtrlBtn>
            <CtrlBtn $active={mainLayer === "current_landuse"} onClick={() => setMainLayer("current_landuse")}>现状用地</CtrlBtn>
            <CtrlBtn $active={mainLayer === "none"} onClick={() => setMainLayer("none")}>无</CtrlBtn>
            <Divider />
            <SectionTitle>叠加</SectionTitle>
            <CtrlBtn $active={showBoundary} onClick={() => toggleOverlay("showBoundary")}>规划边界</CtrlBtn>
            <CtrlBtn $active={showRoads} onClick={() => toggleOverlay("showRoads")}>规划道路</CtrlBtn>
          </>
        ) : (
          <>
            <CtrlBtn $active={showSatellite} onClick={() => toggleOverlay("showSatellite")}>卫星底图</CtrlBtn>
            <CtrlBtn $active={showBoundary} onClick={() => toggleOverlay("showBoundary")}>规划边界</CtrlBtn>
            <CtrlBtn $active={showSpots} onClick={() => toggleOverlay("showSpots")}>景点点位</CtrlBtn>
          </>
        )}
      </BottomBar>

      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 900,
      }}>
        <Panel stats={stats} wugongData={wugongData} sidePanelsCollapsed={sidePanelsCollapsed} />
      </div>
    </Wrapper>
  );
}
