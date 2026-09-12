# 换成自己的规划案例

先按项目 README 启动现有案例，再逐层替换数据。源代码入口为 `src/pages/WugongDemo/`，路由在 `src/App.tsx`。

1. 替换 `public/data/boundary.geojson`、`current_landuse.geojson`、`planned_landuse.geojson`、`planned_roads.geojson`。保持原 GeoJSON 属性结构，坐标为经纬度；保留 Polygon/MultiPolygon 孔洞。
2. 替换 `scenic_spots.geojson` 与 `scenic_detail.csv`。保持 FID 对应，并逐个验证点位与详情。
3. 更新同目录指标文件及 `public/styles/` 分类配色，保持用地代码与配色键一致。
4. 用自己的底图替换 `public/textures/satellite_wugong.png`，同步 `satellite_bounds.json` 的地理范围。不要只换图片而保留旧边界。
5. 修改 `WugongDemo/panel/` 的标题、定位和指标文案；搜索 `武功`、`WUGONG` 检查剩余名称。调整地图投影与视角以适应新区域。
6. 运行 `npm run build`，通过 `npm run preview` 验证规划/现状切换、图层开关、孔洞显示、景点详情、指标和纹理加载，再部署自己的实例。

`vite.config.ts` 会内嵌部分 public 数据，修改数据后应重新构建。开发访问需包含 `/sc-datav/`；改变部署前缀时还要同步源码内的绝对资源路径。

本仓库保留旧页面目录，是为了维持当前源码依赖和参考实现。不要仅凭 `_backup` 名称删除目录，应先检查 import 引用。
