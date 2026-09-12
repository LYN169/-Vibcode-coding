import { useEffect, useState } from "react";
import styled from "styled-components";
import useMoveTo from "@/hooks/useMoveTo";
import AutoFit from "@/components/autoFit";
import { useWugongStore } from "../stores";
import type { PlanningStats } from "@/types/stats";

import Headder from "./headder";
import Footer from "./footer";

const GridWrapper = styled.div<{ $mode: "planning" | "status" }>`
  flex: 1; min-height: 0; display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: ${(p) => p.$mode === "planning" ? "1.16fr 1.16fr 0.86fr 0.86fr 0.86fr 0.86fr 1.25fr 0.72fr 0.72fr" : "repeat(28, minmax(0, 1fr))"};
  gap: ${(p) => p.$mode === "planning" ? "20px" : "14px"}; padding: 20px;
`;

interface CardProps { $collapsed?: boolean; $side?: "left" | "right"; }
const Card = styled.div<CardProps>`
  position: relative;
  background: rgba(255,245,232,0.65); border: 1px solid rgba(255,145,0,0.3);
  padding: 10px 18px; backdrop-filter: blur(4px); border-radius: 4px;
  display: flex; flex-direction: column; z-index: 9999; overflow-x: hidden; overflow-y: auto;
  font-size: clamp(15px, 0.88vw, 19px); line-height: 1.62;
  pointer-events: auto;
  transition: transform 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease;
  ${(p) => p.$collapsed && p.$side === "left" && `
    opacity: 0 !important; transform: translateX(-118%) !important; pointer-events: none;
  `}
  ${(p) => p.$collapsed && p.$side === "right" && `
    opacity: 0 !important; transform: translateX(118%) !important; pointer-events: none;
  `}
  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-thumb { background: rgba(234,88,12,0.18); border-radius: 999px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::before { content:""; position:absolute; top:-1px; left:-1px; width:10px; height:10px; border-top:2px solid #ea580c; border-left:2px solid #ea580c; pointer-events:none; }
  &::after { content:""; position:absolute; bottom:-1px; right:-1px; width:10px; height:10px; border-bottom:2px solid #ea580c; border-right:2px solid #ea580c; pointer-events:none; }
  p { font-size: clamp(14px, 0.82vw, 17px); line-height: 1.5; margin: 0; color: #4a4a4a; }
  p.positioning { font-size: clamp(15.5px, 0.88vw, 19px); line-height: 1.68; }
  .kw { font-size: clamp(13px, 0.74vw, 15px); padding: 4px 11px; border-radius: 8px; background: rgba(234,88,12,0.08); color: #ea580c; }
  .kw2 { font-size: clamp(13px, 0.74vw, 15px); padding: 4px 11px; border-radius: 8px; background: rgba(0,180,216,0.12); color: #0891b2; }
`;

const CardTitle = styled.div`
  flex-shrink: 0; gap: 8px;
  font-size: clamp(22px, 1.2vw, 27px); font-weight: 700; margin-bottom: 5px;
  padding-left: 12px; border-left: 4px solid #fdb961;
  display: flex; justify-content: space-between; align-items: center; color: #5a4a42;
  span { flex-shrink: 0; font-size: clamp(12px, 0.66vw, 14px); color: rgba(0,0,0,0.4); font-weight: 400; }
`;
const StatRow = styled.div`
  flex-shrink: 0; display: flex; justify-content: space-between; padding: 1px 0; font-size: clamp(15px, 0.84vw, 18px); color: #555;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  .v { font-weight: 700; color: #333; font-size: clamp(17px, 0.95vw, 21px); }
`;

function LanduseChangeChart() {
  const [data, setData] = useState<{title:string;items:{landuse:string;currentShare:number;plannedShare:number;change:number}[]} | null>(null);
  useEffect(() => { fetch("/sc-datav/data/landuse_change.json").then(r => r.json()).then(setData).catch(() => {}); }, []);
  if (!data) return <div style={{ color: "#999", fontSize: 14 }}>加载中...</div>;
  const items = data.items.filter(i => Math.abs(i.change) > 0.2).sort((a, b) => b.change - a.change);
  const maxAbs = Math.max(...items.map(i => Math.abs(i.currentShare)), ...items.map(i => Math.abs(i.plannedShare)), 1);
  return (
    <div style={{ fontSize: 13, lineHeight: 1.45, flex: 1, minHeight: 0, overflowY: "auto" }}>
      {items.map((it) => (
        <div key={it.landuse} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 1 }}>
            <span style={{ color: "#555" }}>{it.landuse}</span>
            <span style={{ color: it.change > 0 ? "#e83030" : it.change < 0 ? "#2b9600" : "#999", fontWeight: 600, fontSize: 13 }}>
              {it.change > 0 ? "+" : ""}{it.change.toFixed(1)}%
            </span>
          </div>
          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "#eee" }}>
            <div style={{ width: `${(it.currentShare / maxAbs) * 100}%`, background: "rgba(245,158,11,0.5)", transition: "width 0.3s" }} />
          </div>
          <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "#eee", marginTop: 1 }}>
            <div style={{ width: `${(it.plannedShare / maxAbs) * 100}%`, background: "rgba(59,130,246,0.5)", transition: "width 0.3s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#999", marginTop: 1 }}>
            <span>现状 {it.currentShare.toFixed(1)}%</span>
            <span>规划 {it.plannedShare.toFixed(1)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

type CS = { $collapsed?: boolean; $side?: "left" | "right" };
const planningKeywords = [
  "文化引领",
  "产业协同",
  "空间提质",
  "保护传承",
  "融合发展",
  "现代农业",
  "宜居品质",
  "绿色低碳",
];

export default function Panel({ stats, sidePanelsCollapsed }: { stats: PlanningStats | null; wugongData?: unknown; sidePanelsCollapsed?: boolean }) {
  const topBox = useMoveTo("toBottom", 0.6);
  const leftBox = useMoveTo("toRight", 0.8, 0.5);
  const leftBox1 = useMoveTo("toRight", 0.8, 0.6);
  const leftBox2 = useMoveTo("toRight", 0.8, 0.7);
  const leftBox3 = useMoveTo("toRight", 0.8, 0.8);
  const rightBox = useMoveTo("toLeft", 0.8, 0.5);
  const rightBox1 = useMoveTo("toLeft", 0.8, 0.6);
  const rightBox2 = useMoveTo("toLeft", 0.8, 0.7);
  const bottomBox = useMoveTo("toTop", 0.8, 0.5);
  const activeMode = useWugongStore((s) => s.activeMode);

  useEffect(() => {
    const unsub = useWugongStore.subscribe((s) => s.mapPlayComplete, (v) => {
      if (v) { topBox.restart(); bottomBox.restart(); leftBox.restart(); leftBox1.restart(); leftBox2.restart(); leftBox3.restart(); rightBox.restart(); rightBox1.restart(); rightBox2.restart(); }
    });
    return () => unsub();
  }, []);

  const pl = stats?.planning;
  const c = sidePanelsCollapsed;
  const L: CS = { $collapsed: c, $side: "left" };
  const R: CS = { $collapsed: c, $side: "right" };

  return (
    <AutoFit>
      <Headder ref={topBox.ref}
        title={activeMode === "planning" ? "武功镇国土空间规划（2026—2040）" : "武功镇景观资源导览"}
        sub={activeMode === "planning" ? "WUGONG TOWN TERRITORIAL SPATIAL PLANNING" : "WUGONG TOWN AGRICULTURAL CULTURE TOURISM GUIDE"} />
      <GridWrapper $mode={activeMode}>
        {activeMode === "planning" ? (
          <>
            <Card ref={leftBox.ref} {...L} style={{ gridArea: "1 / 1 / 3 / 2" }}>
              <CardTitle>规划基础指标<span>PLANNING METRICS</span></CardTitle>
              {pl ? <>
                <StatRow><span>规划范围</span><span className="v">{pl.areaKm2} km²</span></StatRow>
                <StatRow><span>面积（亩）</span><span className="v">{pl.areaMu.toLocaleString()} 亩</span></StatRow>
                <StatRow><span>规划期限</span><span className="v">{pl.planningPeriod}</span></StatRow>
                <StatRow><span>基期年</span><span className="v">{pl.baseYear}</span></StatRow>
                <StatRow><span>目标年</span><span className="v">{pl.targetYear}</span></StatRow>
              </> : <div style={{ color: "#999", fontSize: 13 }}>加载中...</div>}
            </Card>
            <Card ref={leftBox1.ref} {...L} style={{ gridArea: "3 / 1 / 7 / 2" }}>
              <CardTitle>规划定位<span>POSITIONING</span></CardTitle>
              {pl ? <p className="positioning">{pl.overallGoal}</p> : <div style={{ color: "#999", fontSize: 13 }}>加载中...</div>}
            </Card>
            <Card ref={leftBox2.ref} {...L} style={{ gridArea: "7 / 1 / 8 / 2" }}>
              <CardTitle>战略定位<span>STRATEGY</span></CardTitle>
              {pl?.strategicPositioning && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {pl.strategicPositioning.map((s: string) => <span key={s} className="kw">{s}</span>)}
                </div>
              )}
            </Card>
            <Card ref={leftBox3.ref} {...L} style={{ gridArea: "8 / 1 / 10 / 2" }}>
              <CardTitle>发展关键词<span>KEYWORDS</span></CardTitle>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {planningKeywords.map((s) => <span key={s} className="kw2">{s}</span>)}
              </div>
            </Card>
            <Card ref={rightBox.ref} {...R} style={{ gridArea: "1 / 4 / 3 / 5" }}>
              <CardTitle>现状用地结构<span>LAND USE</span></CardTitle>
              {stats?.currentLanduse?.categories.slice(0, 6).map((cat) => (
                <StatRow key={cat.code}><span>{cat.name}</span><span className="v">{cat.sharePercent}%</span></StatRow>
              ))}
            </Card>
            <Card ref={rightBox2.ref} {...R} style={{ gridArea: "3 / 4 / 10 / 5" }}>
              <CardTitle>现状—规划用地对比<span>LANDUSE CHANGE</span></CardTitle>
              <LanduseChangeChart />
            </Card>
          </>
        ) : (
          <>
            <Card ref={leftBox.ref} {...L} style={{ gridArea: "1 / 1 / 6 / 2" }}>
              <CardTitle>区位条件<span>LOCATION</span></CardTitle>
              <p>武功镇位于陕西省咸阳市武功县西北部，地处关中平原腹地，处在西安都市圈西翼与杨凌示范区辐射交汇带。兼具县域西向门户、农科成果承接点、农业与文旅协同节点等多重角色。</p>
              <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginTop:6 }}>{["关中平原","西安都市圈","杨凌辐射","县域门户"].map(s=><span key={s} className="kw">{s}</span>)}</div>
            </Card>
            <Card ref={leftBox1.ref} {...L} style={{ gridArea: "6 / 1 / 11 / 2" }}>
              <CardTitle>自然基础<span>NATURE</span></CardTitle>
              <p>武功镇地处渭河北岸平原农耕区，整体地势西北高、东南低，以平缓台地为主。规划区属渭河流域漆水河水系，漆水河是镇区生态安全和景观组织的重要水廊。</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>{["西北高东南低","漆水河","平原农耕区","生态廊道"].map(s=><span key={s} className="kw">{s}</span>)}</div>
            </Card>
            <Card ref={leftBox2.ref} {...L} style={{ gridArea: "11 / 1 / 17 / 2" }}>
              <CardTitle>人口现状<span>POPULATION</span></CardTitle>
              <div style={{fontSize:13,lineHeight:1.6}}>
                <StatRow><span>2020性别比</span><span className="v">100.39</span></StatRow>
                <StatRow><span>老龄化水平</span><span className="v">23.44%</span></StatRow>
                <StatRow><span>65岁及以上</span><span className="v">16.78%</span></StatRow>
                <StatRow><span>2024城镇化率</span><span className="v">42.85%</span></StatRow>
              </div>
            </Card>
            <Card {...L} style={{ gridArea: "17 / 1 / 23 / 2" }}>
              <CardTitle>产业现状<span>INDUSTRY</span></CardTitle>
              <p>武功镇产业发展以文旅服务和商贸消费较为突出，依托武功古镇、后稷文化艺术节、河滩古会等资源，形成旅游观光、文化体验、餐饮购物和节会消费复合型产业体系。县域第三产业占比已达56.7%。</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>{["文旅服务","商贸消费","农业电商","节会经济"].map(s=><span key={s} className="kw">{s}</span>)}</div>
            </Card>
            <Card {...L} style={{ gridArea: "23 / 1 / 29 / 2" }}>
              <CardTitle>农业基础<span>AGRICULTURE</span></CardTitle>
              <div style={{fontSize:13,lineHeight:1.6}}>
                <StatRow><span>耕地占比</span><span className="v">22.77%</span></StatRow>
                <StatRow><span>水浇地</span><span className="v">14.72%</span></StatRow>
                <StatRow><span>旱地</span><span className="v">8.06%</span></StatRow>
                <StatRow><span>主导方向</span><span className="v">猕猴桃与特色果蔬</span></StatRow>
              </div>
            </Card>
            <Card ref={rightBox.ref} {...R} style={{ gridArea: "1 / 4 / 6 / 5" }}>
              <CardTitle>文旅资源<span>TOURISM</span></CardTitle>
              <p>武功镇为省级历史文化名镇和旅游特色名镇，拥有后稷文化、苏武文化、农耕文化、宗教文化等多元资源。文旅空间呈"一核多片、东密西疏"格局。</p>
            </Card>
            <Card ref={rightBox1.ref} {...R} style={{ gridArea: "6 / 4 / 10 / 5" }}>
              <CardTitle>文旅短板<span>CHALLENGES</span></CardTitle>
              <p>空间分布不均衡，外围片区联系不足，文化资源联动弱，旅游线路组织不强。服务设施和基础设施配套相对滞后。</p>
            </Card>
            <Card {...R} style={{ gridArea: "10 / 4 / 14 / 5" }}>
              <CardTitle>人居环境<span>SETTLEMENT</span></CardTitle>
              <p>武功镇人居环境以村庄、农田和街巷空间为主，核心区建设相对集中，外围区域低密分散。社区服务设施占比偏低，公共空间与街道品质仍需提升。</p>
            </Card>
            <Card {...R} style={{ gridArea: "14 / 4 / 18 / 5" }}>
              <CardTitle>基础设施<span>INFRASTRUCTURE</span></CardTitle>
              <p>供排水设施建设基础明确，已形成镇域供水厂与污水处理厂运营支撑；环卫嵌入县域"村收集、企转运、镇监管、县处理"链条；电力燃气依托区域骨干系统。</p>
            </Card>
            <Card {...R} style={{ gridArea: "18 / 4 / 24 / 5" }}>
              <CardTitle>交通现状<span>TRANSPORT</span></CardTitle>
              <p>道路可达性呈中心较优、南北较弱特征；路网骨架具有一定方向性，但系统性偏弱，内部循环不畅。后续需密路网、打通断头路和优化慢行系统。</p>
            </Card>
            <Card ref={rightBox2.ref} {...R} style={{ gridArea: "24 / 4 / 29 / 5" }}>
              <CardTitle>综合判断<span>SWOT</span></CardTitle>
              <p>武功镇文旅与农业本底扎实、区位协同潜力突出，但空间品质、服务能级与产业联动仍需提升。应围绕县域副中心培育，强化功能布局优化与内涵提质。</p>
            </Card>
          </>
        )}
      </GridWrapper>
      <Footer ref={bottomBox.ref} sidePanelsCollapsed={sidePanelsCollapsed} />
    </AutoFit>
  );
}
