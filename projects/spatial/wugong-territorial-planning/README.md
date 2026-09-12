# 武功镇国土空间规划可视地图

将国土空间规划的 GIS 图层、指标与景观资源组织为可以切换、查询和演示的三维大屏。基于 [Knight-L/sc-datav](https://github.com/knight-L/sc-datav) 改造，保留 React、Three.js、ECharts 渲染框架。

- [在线体验](https://wugong-sc-datav.vercel.app/sc-datav/#/wugong)
- [用户指南](docs/WEB_USER_GUIDE.md)
- [数据替换与复刻说明](docs/REPLICATION.md)
- 开源整理日期：2026-09-12。

## 快速启动

建议 Node.js 22 LTS（至少 22.12）及 npm。在本目录执行：

```bash
npm ci
npm run dev
```

打开 `http://localhost:5173/sc-datav/#/wugong`。必须使用完整路径；应用的数据、字体和纹理仍引用 `/sc-datav/`。

## 构建与部署

```bash
npm run build
npm run preview
```

预览地址：`http://localhost:4173/sc-datav/#/wugong`。构建脚本将完整站点放入 `dist/sc-datav/`，并生成 `dist/index.html` 入口跳转。

在 Vercel 导入仓库，Root Directory 选择 `projects/spatial/wugong-territorial-planning`，安装命令 `npm ci`，构建命令 `npm run build`，Output Directory 为 `dist`。使用自己的账户和项目。其他静态服务器应把整个 `dist/` 作为站点根目录，保留 `sc-datav` 子目录。

## 内容分类

| 路径 | 内容 |
| --- | --- |
| `src/pages/WugongDemo/` | 当前武功镇入口、三维地图、控制栏和指标面板 |
| `src/pages/WugongDashboard*` | 保留的旧页面及共享依赖；部分仍被当前页面引用 |
| `src/pages/Demo*` | 上游演示页面与渲染参考 |
| `public/data/` | 边界、现状/规划用地、道路、景点和指标数据 |
| `public/styles/` | GIS 分类配色 |
| `public/textures/` | 卫星底图及范围信息 |
| `scripts/prepare-vercel.mjs` | 构建后目录整理 |
| `docs/` | 操作与复刻说明 |

提供完整源码、锁文件、运行所需静态资源与现有案例数据。未收录 `node_modules`、`dist`、账户配置、原始汇报 PPT 和历史模拟数据备份。

## 当前状态

已有规划展示/现状概况双模式、图层开关、用地与道路悬浮信息、景点点位与详情、指标面板和用地变化比较。2026-09-12 线上检查确认双模式与 PNG 卫星底图可加载，无页面脚本异常。移动端适配、所有景点详情的逐项匹配及跨浏览器细节仍需进一步验收。

## 许可证与来源

代码保留上游 [Apache-2.0 许可证](LICENSE)，项目来源及本次改动见 [NOTICE](NOTICE)。上游版本来源目录标识为 `sc-datav-c1aebf1`。字体、模型、纹理及案例数据的来源权利不因代码许可证改变；见 [数据与资源说明](docs/DATA_AND_ASSETS.md)。这是案例可视化项目，页面展示不代表规划文件的审批状态。
