# 真实数据放置与字段规范

把真实文件放在本目录。只要本目录出现 CSV/GeoJSON，应用就会进入真实数据模式，不再混入 `sample/`；也可以在页面侧栏上传文件，上传内容优先于同名本地文件。

## 文件清单

```text
data/
├── county_boundary.geojson
├── nightlight_2019.csv
├── nightlight_2024.csv
├── population_2019.csv
├── population_2024.csv
├── road_2019.csv              # 可缺；用 road_2024 近似
├── road_2024.csv
├── economy_2019.csv
├── economy_2024.csv           # 可缺；可由 economy_2023 替代
└── economy_2023.csv           # 仅作为 2024 经济数据替代
```

所有 CSV 推荐保存为 UTF-8。`county_code` 必须在各文件之间一致；程序会强制按字符串读取，因此可以保留前导 `0`。

## 边界字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `county_code` | 字符串 | 县域唯一代码 |
| `province` | 字符串 | 省份名称 |
| `city` | 字符串 | 地市名称 |
| `county` | 字符串 | 县区名称 |
| `geometry` | GeoJSON geometry | Polygon 或 MultiPolygon |

## 夜间灯光字段

`county_code`, `year`, `ntl_mean`, `ntl_sum`, `ntl_max`, `ntl_median`

## 人口字段

`county_code`, `year`, `pop_total`, `pop_density`

## 路网字段

`county_code`, `year`, `road_length_km`, `road_density`, `highway_density`

## 经济字段

`county_code`, `year`, `gdp`, `gdp_per_capita`, `gdp_density`

## 缺失与替代规则

- 原始空白、`NA`、`N/A`、`null` 均读取为 NA；系统不填 0、不插补、不删除边界中的县域。
- 某县部分指标缺失时，该县仍保留，并只使用剩余有效指标动态归一化权重；一类指数全部输入缺失时该指数为 NA。
- 整个文件缺少必需字段时，页面会显示具体表名与字段名；受影响指标为空，其余可用模块继续显示。
- `road_2019.csv` 缺失而 `road_2024.csv` 存在时，2024 路网作为 2019 静态交通条件，导出中的 `road_year_display=2024`，页面提示“路网数据使用当前年份近似”。
- `economy_2024.csv` 缺失而 `economy_2023.csv` 存在时，分析年份仍为 2024，但 `year_display=2023`，避免把真实数据年份混写为 2024。
- 增长率的 2019 分母为 0 或缺失时结果为空，不会抛出除零错误。
- 2019 与 2024 的所有原始指标先合并，再进行联合 min-max 标准化；地区筛选发生在评分之后。
- 全空或最大值等于最小值的指标标准化为 NA，不参与动态权重，页面会显示提示。

导出结果包含 `missing_gdp`、`missing_economy_count`、`missing_total_count`、四类 `*_valid_weight_sum`、`score_quality_flag`、`mismatch_type` 与 `lisa_type`，CSV 中 NA 保持为空，GeoJSON 中为 `null`。
