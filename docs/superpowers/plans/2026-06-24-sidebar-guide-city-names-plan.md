# 侧栏说明与地市名称改造实施计划

1. 新增 `scripts/build_admin_reference.py`，只读下载民政部 2023 行政区划页面，提取地级记录并生成 `reference/mca_city_codes_2023.csv`。
2. 新增 `src/admin_divisions.py`，负责参考表校验、地市名称映射、覆盖率诊断和未映射回退。
3. 修改 `src/real_data_pipeline.py`，在路网标准化阶段写入中文 `city`，保留 `city_code`，并新增映射状态字段。
4. 修改 `app.py`，移除主页面三块说明区域，在侧栏底部增加 `ⓘ 网站说明 / GUIDE` Popover，显示介绍、使用说明、口径、完整性和快速诊断。
5. 补充行政映射和 UI 回归测试；更新既有 AppTest 选择值，不再依赖 `3101`。
6. 重新运行 V2 流水线，检查 348 个代码全部映射且 `city` 不含四位数字值。
7. 启动 Streamlit，验证三种年份模式、三级筛选、地图、表格、下载和说明按钮。
