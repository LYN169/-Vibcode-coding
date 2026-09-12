# Papers Analyzer · 文献分析工具

把检索得到的文献文件变成可以筛选、比较和导出的阅读材料。纯浏览器端 HTML/CSS/JavaScript 应用，文献解析在本地进行，无需后端或 API Key。

- [在线体验](https://bib-analysis-tool.vercel.app)
- [使用指南](guide.html)
- 开源整理日期：2026-09-12；页面仍为 MVP，后续功能见下文。

## 运行画面

加载 55 篇 Demo 文献后，年份、期刊、关键词与文献表格可以在同一页浏览，适合先看文献集合的整体结构，再筛选具体条目。

![文献概览与关键词词云](../../../docs/showcase/papers-overview.png)

切换到时间线，查看该文献集内关键词在各年份的出现频次。

![关键词时间线](../../../docs/showcase/papers-timeline.png)

以上为 2026-09-12 线上运行截图。[查看完整介绍与演示建议](../../../docs/showcase/README.md)。

## 快速复刻

下载本目录，直接用浏览器打开 `index.html`，点击 **Demo 数据** 即可加载 55 篇示例文献。也可以在本目录运行：

```bash
npx --yes serve . -l 8088
```

访问 `http://localhost:8088`。图表库从 jsDelivr CDN 加载，首次运行需要网络；数据内嵌不等于完整离线支持。

## 功能

- BibTeX、RIS、CSV/TSV、CNKI Refworks 文件导入；支持多文件。
- 文献搜索、排序、分类与期刊分区筛选、跨筛选累积勾选。
- 年份/期刊分布、关键词词云与时间线。
- 双文件对比；BibTeX、CSV、Refworks 导出。
- 内置示例和期刊分级快照，不会自动更新期刊分区。

## 源码与修改

`index.html` 是当前可运行的完整源码，也是本开源版的修改入口。`demo_data.json` 和 `journal_rankings.json` 是可读的数据副本，运行时使用 HTML 内的 `EMBEDDED_DEMO` 和 `EMBEDDED_RANKINGS`。修改 JSON 副本后，还需同步 HTML 中的对应数据；不会自动读取外部 JSON。

`guide.html` 是使用说明，`vercel.json` 是静态部署配置。本目录不需要安装原开发环境的 Playwright 依赖。未收录历史恢复/重建脚本、账户绑定和部署凭据，避免误覆盖当前源码或泄露账户信息。

## 部署自己的版本

在 Vercel 导入本仓库，Root Directory 选择 `projects/research/papers-analyzer`，Framework Preset 选择 Other，不设置构建命令，Output Directory 使用 `.`。使用自己的 Vercel 账户，不需要作者的 Token。也可以把本目录放到其他静态网站服务器。

## 状态与限制

2026-09-12 实测线上 Demo 加载 55 条记录，分页、统计和图表页面可运行。不是全功能验收。共现网络、EndNote XML、阅读清单持久化、暗色模式和 PWA 属于历史待办，不能视为已交付功能。期刊分区仅作内置快照参考，请按所需年份核实。

## 开源说明

本目录原创代码采用 [Apache-2.0](LICENSE)。Chart.js、ECharts 和 echarts-wordcloud 保留各自许可证。示例文献元数据和期刊分级快照不包含论文全文，代码许可证不改变其来源权利。复刻时可替换为自己的文献集。
