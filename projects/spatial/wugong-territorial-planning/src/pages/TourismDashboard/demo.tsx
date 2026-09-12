import { useEffect, useState } from "react";
import styled from "styled-components";
import Map from "./map";
import { loadStats } from "@/utils/loadStats";
import type { PlanningStats } from "@/types/stats";

const Wrapper = styled.div` position: relative; width: 100vw; height: 100vh; `;

const Overlay = styled.div`
  position: absolute; top: 20px; left: 20px; z-index: 9999;
  pointer-events: none;
  h1 { font-size: 28px; color: #5a4a42; margin: 0; text-shadow: 0 1px 4px rgba(255,255,255,0.8); }
  p { font-size: 13px; color: #999; margin: 4px 0 0; }
`;
const InfoCard = styled.div`
  position: absolute; bottom: 24px; left: 20px; z-index: 9999; pointer-events: auto;
  background: rgba(255,255,255,0.88); backdrop-filter: blur(8px); border-radius: 10px;
  padding: 16px 20px; border: 1px solid rgba(139,92,246,0.3);
  box-shadow: 0 4px 16px rgba(0,0,0,0.08); max-width: 340px;
  h3 { margin: 0 0 8px; font-size: 14px; color: #7c3aed; }
  p { font-size: 11px; color: #666; line-height: 1.6; margin: 0 0 4px; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .tag { font-size: 10px; padding: 2px 8px; border-radius: 10px; background: rgba(139,92,246,0.08); color: #7c3aed; }
`;
const ModeSwitch = styled.div`
  position: absolute; top: 20px; right: 20px; z-index: 9999; pointer-events: auto;
  display: flex; gap: 4px; background: rgba(255,255,255,0.8); border-radius: 8px; padding: 4px;
  border: 1px solid rgba(0,0,0,0.08);
`;
const ModeBtn = styled.button<{ $active: boolean }>`
  padding: 6px 16px; border-radius: 6px; font-size: 12px; border: none; cursor: pointer;
  background: ${(p) => (p.$active ? "#7c3aed" : "transparent")};
  color: ${(p) => (p.$active ? "white" : "#666")};
  font-weight: ${(p) => (p.$active ? 600 : 400)};
`;

interface Props { onSwitchToPlanning?: () => void; }

export default function TourismDashboard({ onSwitchToPlanning }: Props) {
  const [stats, setStats] = useState<PlanningStats | null>(null);
  useEffect(() => { loadStats().then(setStats).catch(() => {}); }, []);

  const location = stats?.location;
  const cultureTourism = stats?.cultureTourism as Record<string, unknown> | undefined;

  return (
    <Wrapper>
      <Map />
      <Overlay>
        <h1>农文旅资源展示</h1>
        <p>
          {location ? `${location.province}${location.city}${location.county}${location.town}` : ""} · Agricultural · Cultural · Tourism Resources
        </p>
      </Overlay>

      {onSwitchToPlanning && (
        <ModeSwitch>
          <ModeBtn $active={false} onClick={onSwitchToPlanning}>规划展示</ModeBtn>
          <ModeBtn $active={true}>农文旅展示</ModeBtn>
        </ModeSwitch>
      )}

      {stats && (
        <InfoCard>
          <h3>{location?.town ?? ""}文旅概况</h3>
          {cultureTourism && (
            <>
              <p>{(cultureTourism["advantages"] as string[])?.[0]?.slice(0, 120) ?? (cultureTourism["tourismDevelopmentSummary"] as string)?.slice(0, 120) ?? "暂无概述"}</p>
              <div className="tags">
                {(stats.planning?.strategicPositioning ?? []).slice(0, 6).map((s: string) => (
                  <span key={s} className="tag">{s}</span>
                ))}
              </div>
            </>
          )}
          {!cultureTourism && <p>加载文旅数据中...</p>}
        </InfoCard>
      )}
    </Wrapper>
  );
}
