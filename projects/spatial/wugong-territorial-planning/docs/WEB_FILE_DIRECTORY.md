# 武功镇国土空间规划数字大屏 — 项目文件目录

> 版本：2026-05-26 | 本文档面向开发者与 AI 辅助修改

---

## 1. 项目基本信息

| 项目 | 值 |
|------|-----|
| 项目名称 | 武功镇国土空间规划数字大屏 |
| 项目路径 | `D:\claude-work\knight-L-sc-datav-v1.2.4-6-gc1aebf1\knight-L-sc-datav-c1aebf1` |
| 本地启动 | `npm.cmd run dev`（或 `npx pnpm run dev`） |
| 本地构建 | `npm.cmd run build`（或 `npx pnpm run build`） |
| 本地访问 | `http://localhost:5173/sc-datav/#/wugong` |
| 线上部署 | https://wugong-sc-datav.vercel.app |
| 技术栈 | React 19 + TypeScript + Vite 8 + Three.js 0.183 + d3-geo + ECharts 6 + GSAP + Zustand 5 |
| 开源基础 | [knight-L/sc-datav](https://github.com/knight-L/sc-datav)（四川省 Demo1 3D 数字大屏） |

---

## 2. 项目目录总览

```
项目根目录/
├── package.json              # 项目配置、脚本、依赖
├── vite.config.ts             # Vite 构建配置
├── SESSION_SUMMARY.md         # 项目全貌总结（新会话优先阅读）
├── CODEX_CHECKLIST_WUGONG.md  # AI 修改检查清单
├── docs/                      # 本文档目录
│
├── src/                       # 源代码
│   ├── App.tsx                # HashRouter 路由配置
│   ├── main.tsx               # ReactDOM 入口
│   ├── index.css              # 全局样式
│   ├── components/            # 通用组件（autoFit / chart / button）
│   ├── hooks/                 # 自定义 Hook（useMoveTo / useSize / useDebounceEffect）
│   ├── config/                # 配置（layerStyles.ts / layers.ts）
│   ├── types/                 # TypeScript 类型（planning / tourism / stats / map）
│   ├── utils/                 # 工具函数（fitToBounds / formatters / loadGeoJson / loadCsv / loadStats / projection）
│   └── pages/                 # 页面
│       ├── WugongDemo/        # ★ 武功镇大屏（当前主页面）
│       ├── WugongDashboard_backup/  # 旧版自研页面备份
│       ├── Demo0/ ~ Demo3/    # 原项目 Demo 页面
│       ├── Index/             # 首页
│       ├── PlanningDashboard/ # 旧版独立规划页
│       └── TourismDashboard/  # 旧版独立旅游页
│
├── public/                    # 静态资源
│   ├── data/                  # ★ 真实 GIS 数据（8 个文件）
│   ├── styles/                # ★ lyrx 配色 JSON（3 个文件）
│   ├── textures/              # 卫星底图 + 边界坐标
│   ├── font/                  # 字体文件
│   └── model/                 # 3D 模型（Demo1 原版）
│
└── dist/                      # 构建输出
```

---

## 3. src 目录关键文件说明

### 3.1 路由与入口

| 文件 | 作用 | 建议AI修改 | 注意事项 |
|------|------|:---:|------|
| `src/App.tsx` | HashRouter，`/wugong`→WugongDemo，`/demo1`→Demo1 | 可 | 只改路由映射，不改其他 |
| `src/main.tsx` | ReactDOM.createRoot 入口 | 否 | 不要改 |

### 3.2 武功镇大屏核心

| 文件 | 作用 | 建议AI修改 | 注意事项 |
|------|------|:---:|------|
| `src/pages/WugongDemo/index.tsx` | lazy 加载包装 | 否 | — |
| `src/pages/WugongDemo/demo.tsx` | **主页面入口**：Map + ModeBar + BottomBar + Panel 包装 + sidePanelsCollapsed | **是** | 布局根文件，改错影响全局 |
| `src/pages/WugongDemo/stores/index.ts` | Zustand 状态：activeMode / mainLayer / showXxx | **是** | 状态结构不要随意改 |
| `src/pages/WugongDemo/panel/index.tsx` | AutoFit + Headder + GridWrapper(4×6 CSS Grid) + Footer | **是** | 卡片布局+面板折叠动画 |
| `src/pages/WugongDemo/panel/headder.tsx` | 顶部标题（中文+英文副标题） | 可 | 只改 title/sub 文本 |
| `src/pages/WugongDemo/panel/footer.tsx` | 底部三按钮（云层/复位/星星面板折叠） | 可 | 星星按钮功能需保持 |

### 3.3 Three.js 地图渲染

| 文件 | 作用 | 建议AI修改 | 注意事项 |
|------|------|:---:|------|
| `src/pages/WugongDemo/map/index.tsx` | R3F Canvas + PerspectiveCamera + OrbitControls | 可 | 改 Camera 前必须确认 |
| `src/pages/WugongDemo/map/scene.tsx` | 数据加载入口（7 个文件 → WugongBase） | 可 | 加载顺序不要变 |
| `src/pages/WugongDemo/map/wugongBase.tsx` | **核心渲染**：投影/面/线/点/工具提示/景点详情卡 | **是** | 最大的文件，改错影响全局 |
| `src/pages/WugongDemo/map/cloud.tsx` | 云层粒子（Demo1 原版） | 否 | — |
| `src/pages/WugongDemo/map/bottom.tsx` | GLSL 底部光效（Demo1 原版） | 否 | — |
| `src/pages/WugongDemo/map/lights.tsx` | 场景灯光 | 否 | — |

### 3.4 图层控制与交互

| 文件 | 作用 |
|------|------|
| `src/pages/WugongDemo/demo.tsx` BottomBar | 图层控制按钮组（主图层单选+叠加多选） |
| `src/pages/WugongDemo/stores/index.ts` | 所有图层状态：showBoundary / showRoads / showSpots / showSatellite |

### 3.5 工具提示与详情

| 文件 | 作用 |
|------|------|
| `src/pages/WugongDemo/map/wugongBase.tsx` | TooltipBox（hover） + DetailCard（点击景点） |
| `src/utils/formatters.ts` | formatArea / formatLength / formatNullable / formatPercent |

### 3.6 卫星底图

| 文件 | 作用 |
|------|------|
| `src/pages/WugongDashboard_backup/map/SatelliteBaseMap.tsx` | 卫星底图组件（jpg→png→webp 优先级） |
| `public/textures/satellite_wugong.jpg` | 卫星影像 |
| `public/textures/satellite_bounds.json` | 四至坐标 |

### 3.7 图表

| 文件 | 作用 |
|------|------|
| `src/pages/WugongDemo/panel/index.tsx` | LanduseChangeChart 组件（现状—规划用地对比柱状图） |

---

## 4. public/data 数据文件说明

| 文件 | 内容 | 被谁读取 | 允许修改 | 风险 |
|------|------|------|:---:|------|
| `boundary.geojson` | 1 feature, Polygon, 规划边界 | scene.tsx → wugongBase.tsx | **否** | 修改后边界错位 |
| `current_landuse.geojson` | 611 features, Polygon/MultiPolygon, 现状用地 | scene.tsx → wugongBase.tsx | **否** | 数据来自 GIS 导出 |
| `planned_landuse.geojson` | 295 features, Polygon/MultiPolygon, 规划用地 | scene.tsx → wugongBase.tsx | **否** | 同上 |
| `planned_roads.geojson` | 215 features, LineString, 规划道路 | scene.tsx → wugongBase.tsx | **否** | 同上 |
| `scenic_spots.geojson` | 38 features, Point, 景点点位 | scene.tsx → wugongBase.tsx | **否** | 同上 |
| `scenic_detail.csv` | 38 rows, GBK 编码, 景点详情 | scene.tsx → wugongBase.tsx | **否** | FID 匹配依赖 |
| `stats.json` | 17 个一级字段, 综合统计 | demo.tsx → panel/index.tsx | **否** | 面板数据源 |
| `landuse_change.json` | 16 类用地, 现状/规划/变化占比 | panel/index.tsx → LanduseChangeChart | **否** | 图表数据源 |

**修改风险**：任何字段名、编码、坐标变更都会导致渲染错位、tooltip 异常或白屏。

---

## 5. public/styles 样式数据说明

| 文件 | 来源 | 匹配字段 | 分类数 |
|------|------|------|:---:|
| `current_landuse_style.json` | 武功镇现状土地利用.lyrx | 二级名（fallback: 一级名/二级/一级） | 33 |
| `planned_landuse_style.json` | 武功镇未来规划土地利用.lyrx | 二类_1（fallback: 一类用/一类_1/Landuse_ty/二类用） | 26 |
| `planned_roads_style.json` | 规划交通路网.lyrx | 道路类 | 4 |

**重要**：这些文件由 Python 脚本从 ArcGIS `.lyrx` 文件中提取生成。后续只需要检查读取和匹配逻辑，**不要重新生成**。

---

## 6. public/textures 贴图资源说明

| 文件 | 作用 | 备注 |
|------|------|------|
| `satellite_wugong.jpg` | 卫星底图（JPEG 格式，优先加载） | 由用户提供 |
| `satellite_wugong.png` | 卫星底图（PNG 格式，备选） | 同上 |
| `satellite_wugong.webp` | 卫星底图（WebP 格式，备选） | 同上 |
| `satellite_bounds.json` | 四至坐标 `{minLon, minLat, maxLon, maxLat}` | 对齐 boundary |

---

## 7. 后续 AI 修改时最重要的 15 个文件清单

| # | 文件 | 作用 | 重要性 | 修改风险 |
|---|------|------|:---:|:---:|
| 1 | `src/pages/WugongDemo/map/wugongBase.tsx` | 全部地图渲染逻辑 | ★★★★★ | 极高 |
| 2 | `src/pages/WugongDemo/demo.tsx` | 主页面布局+图层控制+面板折叠 | ★★★★★ | 高 |
| 3 | `src/pages/WugongDemo/stores/index.ts` | 全局状态管理 | ★★★★★ | 高 |
| 4 | `src/pages/WugongDemo/panel/index.tsx` | 左右信息面板+图表 | ★★★★ | 中 |
| 5 | `src/pages/WugongDemo/map/index.tsx` | Canvas+Camera+OrbitControls | ★★★★ | 高 |
| 6 | `src/pages/WugongDemo/map/scene.tsx` | 数据加载 | ★★★★ | 中 |
| 7 | `src/pages/WugongDashboard_backup/map/SatelliteBaseMap.tsx` | 卫星底图 | ★★★ | 中 |
| 8 | `src/pages/WugongDemo/panel/footer.tsx` | 底部三按钮 | ★★★ | 低 |
| 9 | `src/pages/WugongDemo/panel/headder.tsx` | 顶部标题 | ★★ | 低 |
| 10 | `src/utils/fitToBounds.ts` | bbox + 投影 | ★★★★ | 高 |
| 11 | `src/utils/formatters.ts` | 面积/长度格式化 | ★★★ | 低 |
| 12 | `src/utils/loadGeoJson.ts` | GeoJSON 加载 | ★★★ | 低 |
| 13 | `src/utils/loadCsv.ts` | CSV 解析 | ★★★ | 低 |
| 14 | `src/config/layerStyles.ts` | lyrx 配色接口 | ★★★ | 中 |
| 15 | `src/App.tsx` | 路由 | ★★ | 低 |
