"""Regional Potential Lab V1.0 Streamlit application."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import pandas as pd
import plotly.express as px
import streamlit as st

from src.data_loader import load_data_bundle
from src.export_utils import dataframe_to_csv_bytes, geodataframe_to_geojson_bytes
from src.indicator_engine import (
    DEFAULT_WEIGHTS,
    build_comparison,
    classify_mismatch,
    compute_joint_scores,
    normalize_weights,
)
from src.map_view import MISMATCH_COLORS, available_layers, build_folium_map
from src.spatial_analysis import run_spatial_analysis
from src.ui_style import inject_css, metric_grid, render_hero, section_heading, status_pills


PROJECT_DIR = Path(__file__).resolve().parent


def _format_number(value: Any, digits: int = 3) -> str:
    """Format a number compactly while handling missing values."""

    try:
        number = float(value)
        if not np.isfinite(number):
            return "—"
        return f"{number:,.{digits}f}"
    except (TypeError, ValueError):
        return "—"


def _format_percent(value: Any, digits: int = 1) -> str:
    """Format a decimal change as a percentage."""

    try:
        number = float(value)
        if not np.isfinite(number):
            return "—"
        return f"{number * 100:+.{digits}f}%"
    except (TypeError, ValueError):
        return "—"


def _collect_uploads() -> dict[str, Any]:
    """Render optional upload controls and return non-empty uploaded objects."""

    uploads: dict[str, Any] = {}
    with st.sidebar.expander("数据上传 / DATA INPUT", expanded=False):
        st.caption("上传文件优先于 data/；不上传且 data/ 为空时自动使用 sample/。")
        uploads["boundary"] = st.file_uploader(
            "县域边界 GeoJSON", type=["geojson", "json"], key="boundary"
        )
        for year in (2019, 2024):
            uploads[f"nightlight_{year}"] = st.file_uploader(
                f"夜间灯光 {year}", type="csv", key=f"nightlight_{year}"
            )
            uploads[f"population_{year}"] = st.file_uploader(
                f"人口 {year}", type="csv", key=f"population_{year}"
            )
            uploads[f"road_{year}"] = st.file_uploader(
                f"路网 {year}", type="csv", key=f"road_{year}"
            )
            uploads[f"economy_{year}"] = st.file_uploader(
                f"经济 {year}", type="csv", key=f"economy_{year}"
            )
        uploads["economy_2023"] = st.file_uploader(
            "经济 2023（可替代 2024）", type="csv", key="economy_2023"
        )
    return uploads


def _weight_controls() -> dict[str, dict[str, float]]:
    """Render editable weight groups and return raw user inputs."""

    group_labels = {
        "economic": "经济活力",
        "population": "人口支撑",
        "transport": "交通支撑",
        "potential": "综合潜力",
    }
    field_labels = {
        "gdp": "GDP",
        "gdp_per_capita": "人均 GDP",
        "gdp_density": "GDP 密度",
        "ntl_sum": "灯光总量",
        "ntl_mean": "灯光均值",
        "pop_total": "人口总量",
        "pop_density": "人口密度",
        "road_density": "路网密度",
        "highway_density": "高速密度",
        "economic_score": "经济指数",
        "population_score": "人口指数",
        "transport_score": "交通指数",
    }
    weights: dict[str, dict[str, float]] = {}
    with st.sidebar.expander("指标权重 / WEIGHTS", expanded=False):
        st.caption("每组权重会自动归一化；全部设为 0 时回退默认值。")
        for group, defaults in DEFAULT_WEIGHTS.items():
            st.markdown(f"**{group_labels[group]}**")
            weights[group] = {}
            for field, default in defaults.items():
                weights[group][field] = st.number_input(
                    field_labels[field],
                    min_value=0.0,
                    value=float(default),
                    step=0.05,
                    format="%.2f",
                    key=f"weight_{group}_{field}",
                )
            total = sum(weights[group].values())
            st.caption(f"当前合计：{total:.2f}")
    return weights


def _region_controls(frame: pd.DataFrame) -> tuple[str, dict[str, str]]:
    """Render cascading national/province/city/county filters."""

    level = st.sidebar.selectbox(
        "地区范围 / REGION",
        ["全国", "按省份", "按地市", "按县区"],
        index=0,
    )
    selection: dict[str, str] = {}
    working = frame
    if level in {"按省份", "按地市", "按县区"}:
        if "province" not in working.columns:
            st.sidebar.warning("数据中没有 province 字段，已按全国处理。")
            return "全国", {}
        provinces = sorted(working["province"].dropna().astype(str).unique())
        if not provinces:
            return "全国", {}
        selection["province"] = st.sidebar.selectbox("选择省份", provinces)
        working = working.loc[working["province"].astype(str) == selection["province"]]
    if level in {"按地市", "按县区"}:
        if "city" not in working.columns:
            st.sidebar.warning("数据中没有 city 字段，筛选停留在省份层级。")
            return "按省份", selection
        cities = sorted(working["city"].dropna().astype(str).unique())
        if not cities:
            return "按省份", selection
        selection["city"] = st.sidebar.selectbox("选择地市", cities)
        working = working.loc[working["city"].astype(str) == selection["city"]]
    if level == "按县区":
        if "county" not in working.columns:
            st.sidebar.warning("数据中没有 county 字段，筛选停留在地市层级。")
            return "按地市", selection
        counties = sorted(working["county"].dropna().astype(str).unique())
        if not counties:
            return "按地市", selection
        selection["county"] = st.sidebar.selectbox("选择县区", counties)
    return level, selection


def _apply_region_filter(frame: gpd.GeoDataFrame, selection: dict[str, str]) -> gpd.GeoDataFrame:
    """Filter a GeoDataFrame by all active administrative selections."""

    result = frame
    for field, value in selection.items():
        if field in result.columns:
            result = result.loc[result[field].astype(str) == value]
    return gpd.GeoDataFrame(result.copy(), geometry="geometry", crs=frame.crs)


def _render_source_diagnostics(bundle: Any, score_warnings: list[str]) -> None:
    """Show data provenance, fallbacks, and validation issues without interrupting the app."""

    status_pills(
        [
            (bundle.source_mode, True),
            ("联合尺度标准化", True),
            ("NA 动态权重", True),
            (
                "静态路网截面"
                if bundle.road_static_used
                else ("路网近似" if bundle.road_proxy_used else "路网双期"),
                not bundle.road_proxy_used,
            ),
            ("经济 2023 替代" if bundle.economy_proxy_used else "经济年份匹配", not bundle.economy_proxy_used),
        ]
    )
    with st.expander("数据状态与字段诊断", expanded=bool(bundle.errors)):
        for message in bundle.errors:
            st.error(message)
        for message in [*bundle.warnings, *score_warnings]:
            st.warning(message)
        st.markdown("**当前数据来源**")
        st.dataframe(
            pd.DataFrame(
                [{"数据项": key, "来源": value} for key, value in bundle.sources.items()]
            ),
            width="stretch",
            hide_index=True,
        )


def _build_current_results(
    filtered: gpd.GeoDataFrame, year_mode: str
) -> tuple[gpd.GeoDataFrame, pd.DataFrame | None]:
    """Prepare one analysis-year map result and optional two-period comparison."""

    if year_mode == "2019—2024 对比":
        classified_parts = []
        for year in (2019, 2024):
            part = filtered.loc[filtered["year"] == year].copy()
            classified_parts.append(classify_mismatch(part))
        classified = pd.concat(classified_parts, ignore_index=True)
        classified = gpd.GeoDataFrame(classified, geometry="geometry", crs=filtered.crs)
        comparison = build_comparison(classified)
        current = classified.loc[classified["year"] == 2024].copy()
        return gpd.GeoDataFrame(current, geometry="geometry", crs=filtered.crs), comparison
    year = int(year_mode)
    current = filtered.loc[filtered["year"] == year].copy()
    return gpd.GeoDataFrame(classify_mismatch(current), geometry="geometry", crs=filtered.crs), None


def _render_kpis(current: pd.DataFrame, comparison: pd.DataFrame | None) -> None:
    """Render the headline diagnostic indicators."""

    county_count = current["county_code"].nunique()
    potential_median = current["potential_score"].median(skipna=True)
    release_share = (current["mismatch_type"] == "潜力释放区").mean() if len(current) else np.nan
    if comparison is not None:
        change = comparison["potential_score_change"].mean(skipna=True)
        fourth_value = _format_number(change)
        fourth_note = "2019—2024 平均变化"
    else:
        change = current["economic_score"].median(skipna=True)
        fourth_value = _format_number(change)
        fourth_note = "当前范围经济活力中位数"
    metric_grid(
        [
            ("COUNTIES", f"{county_count:,}", "当前筛选县域数量", "lime"),
            ("POTENTIAL", _format_number(potential_median), "综合潜力指数中位数", "lime"),
            ("RELEASE ZONE", _format_percent(release_share), "潜力释放区占比", "orange"),
            ("SHIFT / ECONOMY", fourth_value, fourth_note, "orange"),
        ]
    )


def _render_data_integrity(current: pd.DataFrame) -> None:
    """Render missingness counts and the non-imputation methodology notice."""

    county_count = int(current["county_code"].nunique())
    gdp_missing = int(current["missing_gdp"].sum())
    gdp_missing_ratio = gdp_missing / county_count if county_count else np.nan
    potential_available = int(current["potential_score"].notna().sum())
    insufficient = int(current["mismatch_type"].eq("数据不足").sum())
    weak = int(current["score_quality_flag"].eq("weak").sum())
    if int(current["missing_economy_count"].gt(0).sum()) > 0:
        st.warning(
            "部分县域存在经济统计数据缺失，系统未进行插补，综合指数基于可用指标动态归一化计算。"
        )
    else:
        st.info("当前筛选区域经济统计字段完整；系统仍按保留 NA 的动态权重规则计算。")
    ratio_text = "—" if pd.isna(gdp_missing_ratio) else f"{gdp_missing_ratio:.1%}"
    metric_grid(
        [
            ("COUNTIES", f"{county_count:,}", "当前筛选县域总数", "lime"),
            ("GDP MISSING", f"{gdp_missing:,}", "GDP 缺失县域数量", "orange"),
            ("MISSING RATE", ratio_text, "GDP 缺失比例", "orange"),
            ("SCORE AVAILABLE", f"{potential_available:,}", "潜力指数可计算县域", "lime"),
            ("INSUFFICIENT", f"{insufficient:,}", "错配诊断数据不足", "orange"),
            ("WEAK", f"{weak:,}", "低可信评分县域", "orange"),
        ]
    )


def _render_sidebar_guide(
    bundle: Any,
    score_warnings: list[str],
    current: pd.DataFrame,
    comparison: pd.DataFrame | None,
) -> None:
    """Render platform help and compact live diagnostics at the sidebar bottom."""

    county_count = int(current["county_code"].nunique())
    gdp_missing = int(current["missing_gdp"].sum())
    missing_ratio = gdp_missing / county_count if county_count else np.nan
    potential_available = int(current["potential_score"].notna().sum())
    insufficient = int(current["mismatch_type"].eq("数据不足").sum())
    weak = int(current["score_quality_flag"].eq("weak").sum())
    potential_median = current["potential_score"].median(skipna=True)
    release_share = (
        current["mismatch_type"].eq("潜力释放区").mean() if len(current) else np.nan
    )
    if comparison is not None:
        shift_value = comparison["potential_score_change"].mean(skipna=True)
        shift_label = "2019—2024 潜力平均变化"
    else:
        shift_value = current["economic_score"].median(skipna=True)
        shift_label = "经济活力中位数"

    st.sidebar.divider()
    with st.sidebar.popover(
        "网站说明 / GUIDE",
        icon=":material/info:",
        type="secondary",
        width="content",
    ):
        st.markdown("### Regional Potential Lab")
        st.caption("县域经济潜力与空间错配诊断平台")
        st.markdown(
            "本工具将县域经济、夜间灯光、人口和路网信息置于统一的2019/2024联合尺度，"
            "用于识别潜力、支撑条件、空间错配与跨期变化。"
        )

        with st.expander("使用说明", expanded=False):
            st.markdown(
                "1. 在侧栏选择年份和地区层级。\n"
                "2. 按需调整权重与空间分析指标。\n"
                "3. 切换地图图层并查看县域悬停信息。\n"
                "4. 浏览结构图、结果表并下载 CSV 或 GeoJSON。"
            )

        with st.expander("数据源与计算口径", expanded=False):
            status_pills(
                [
                    (bundle.source_mode, True),
                    ("联合尺度标准化", True),
                    ("NA 动态权重", True),
                    (
                        "静态路网截面"
                        if bundle.road_static_used
                        else ("路网近似" if bundle.road_proxy_used else "路网双期"),
                        not bundle.road_proxy_used,
                    ),
                    (
                        "经济 2023 替代"
                        if bundle.economy_proxy_used
                        else "经济年份匹配",
                        not bundle.economy_proxy_used,
                    ),
                ]
            )
            st.markdown("**数据状态与字段诊断**")
            for message in bundle.errors:
                st.error(message)
            for message in [*bundle.warnings, *score_warnings]:
                st.warning(message)
            for key, value in bundle.sources.items():
                st.caption(f"{key} · {value}")

        with st.expander("数据完整性提示", expanded=False):
            if int(current["missing_economy_count"].gt(0).sum()) > 0:
                st.warning(
                    "部分县域经济统计缺失；系统未插补，指数按可用指标动态归一化。"
                )
            left, right = st.columns(2)
            left.metric("县域总数", f"{county_count:,}")
            right.metric("GDP 缺失", f"{gdp_missing:,}")
            left.metric(
                "缺失比例", "—" if pd.isna(missing_ratio) else f"{missing_ratio:.1%}"
            )
            right.metric("潜力可计算", f"{potential_available:,}")
            left.metric("数据不足", f"{insufficient:,}")
            right.metric("低可信 weak", f"{weak:,}")

        with st.expander("县域潜力快速诊断", expanded=False):
            left, right = st.columns(2)
            left.metric("潜力中位数", _format_number(potential_median))
            right.metric("潜力释放区", _format_percent(release_share))
            left.metric(shift_label, _format_number(shift_value))
            right.metric("当前县域", f"{county_count:,}")

        with st.expander("数据限制与引用", expanded=False):
            st.caption(
                "缺失经济数据不填0、不插值、不删除县域。路网为静态截面条件。"
                "地市中文名称采用民政部2023行政区划代码快照，仅用于名称标准化，"
                "不代表2019或2024历史区划边界。"
            )
            st.markdown(
                "[民政部：2023年中华人民共和国县以上行政区划代码]"
                "(https://www.mca.gov.cn/mzsj/xzqh/2023/202301xzqh.html)"
            )


def _render_charts(current: pd.DataFrame, comparison: pd.DataFrame | None) -> None:
    """Render compact Plotly rankings and diagnostic type distributions."""

    left, right = st.columns([1.45, 1])
    with left:
        if comparison is not None and not comparison.empty:
            chart = comparison.nlargest(12, "potential_score_change").sort_values(
                "potential_score_change"
            )
            fig = px.bar(
                chart,
                x="potential_score_change",
                y="county",
                orientation="h",
                title="综合潜力指数变化 TOP 12",
                color="potential_score_change",
                color_continuous_scale=["#2C5B37", "#B6FF00"],
            )
        else:
            chart = current.nlargest(12, "potential_score").sort_values("potential_score")
            fig = px.bar(
                chart,
                x="potential_score",
                y="county",
                orientation="h",
                title="综合潜力指数 TOP 12",
                color="potential_score",
                color_continuous_scale=["#2C5B37", "#B6FF00"],
            )
        fig.update_layout(
            template="plotly_dark",
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(255,255,255,.025)",
            coloraxis_showscale=False,
            margin=dict(l=8, r=8, t=52, b=8),
            height=390,
        )
        st.plotly_chart(fig, width="stretch")
    with right:
        counts = current["mismatch_type"].value_counts().rename_axis("类型").reset_index(name="县域数")
        fig = px.bar(
            counts,
            x="类型",
            y="县域数",
            color="类型",
            title="空间错配结构",
            color_discrete_map=MISMATCH_COLORS,
        )
        fig.update_layout(
            template="plotly_dark",
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(255,255,255,.025)",
            showlegend=False,
            margin=dict(l=8, r=8, t=52, b=8),
            height=390,
        )
        st.plotly_chart(fig, width="stretch")


def _table_columns(frame: pd.DataFrame, comparison_mode: bool) -> list[str]:
    """Return required table fields plus provenance and comparison fields when available."""

    columns = [
        "county_code",
        "province",
        "city",
        "county",
        "year",
        "year_display",
        "road_year_display",
        "gdp",
        "missing_gdp",
        "missing_economy_count",
        "missing_total_count",
        "ntl_sum",
        "pop_total",
        "road_density",
        "economic_score",
        "population_score",
        "transport_score",
        "potential_score",
        "economic_valid_weight_sum",
        "population_valid_weight_sum",
        "transport_valid_weight_sum",
        "potential_valid_weight_sum",
        "score_quality_flag",
        "support_score",
        "mismatch_type",
        "mismatch_quality",
        "lisa_type",
    ]
    if comparison_mode:
        columns.extend(
            [
                "ntl_sum_change",
                "pop_total_change",
                "road_density_change",
                "gdp_change",
                "economic_score_change",
                "potential_score_change",
                "ntl_sum_growth_rate",
                "pop_total_growth_rate",
                "gdp_growth_rate",
                "potential_score_growth_rate",
            ]
        )
    return [column for column in columns if column in frame.columns]


def _export_columns(frame: pd.DataFrame, display_columns: list[str]) -> list[str]:
    """Add administrative mapping provenance to downloads without cluttering the UI table."""

    preferred = [
        "county_code",
        "province",
        "city_code",
        "city",
        "city_mapping_type",
        "city_mapping_status",
        "county",
    ]
    ordered = [*preferred, *display_columns]
    return [column for column in dict.fromkeys(ordered) if column in frame.columns]


def main() -> None:
    """Run the Streamlit application."""

    st.set_page_config(
        page_title="Regional Potential Lab",
        page_icon="◩",
        layout="wide",
        initial_sidebar_state="expanded",
    )
    inject_css()
    render_hero()

    st.sidebar.markdown("## REGIONAL / LAB")
    st.sidebar.caption("县域潜力 · 空间错配 · 跨期 intelligence")
    year_mode = st.sidebar.radio(
        "年份 / PERIOD", ["2019", "2024", "2019—2024 对比"], index=2
    )
    uploads = _collect_uploads()
    raw_weights = _weight_controls()
    normalized = normalize_weights(raw_weights)

    bundle = load_data_bundle(PROJECT_DIR, uploads)
    if not bundle.ready:
        section_heading("DATA CHECK", "数据尚未形成可分析闭环")
        _render_source_diagnostics(bundle, normalized.warnings)
        st.info("请按 data/README_data_schema.md 补齐文件，或清空 data/ 后使用内置 sample。")
        st.stop()

    scored_frame, score_warnings = compute_joint_scores(
        bundle.combined, normalized.weights
    )
    scored = gpd.GeoDataFrame(scored_frame, geometry="geometry", crs=bundle.combined.crs)
    _, selection = _region_controls(scored)
    filtered = _apply_region_filter(scored, selection)

    if filtered.empty:
        st.warning("当前地区筛选没有记录，请调整筛选条件。")
        st.stop()

    current, comparison = _build_current_results(filtered, year_mode)
    spatial_variable = st.sidebar.selectbox(
        "空间分析指标 / SPATIAL VARIABLE",
        ["potential_score", "economic_score"],
        format_func=lambda value: "综合潜力指数" if value == "potential_score" else "经济活力指数",
    )
    spatial = run_spatial_analysis(current, spatial_variable)
    map_data = spatial.frame

    if comparison is not None:
        change_columns = [
            "county_code",
            *[column for column in comparison.columns if column.endswith("_change")],
            *[column for column in comparison.columns if column.endswith("_growth_rate")],
        ]
        change_columns = list(dict.fromkeys(change_columns))
        map_data = map_data.merge(
            comparison[change_columns], on="county_code", how="left", validate="one_to_one"
        )
        map_data = gpd.GeoDataFrame(map_data, geometry="geometry", crs=current.crs)

    section_heading("SPATIAL FIELD", "空间潜力与错配地图")
    map_layers = available_layers(map_data, comparison is not None)
    layer_name = st.selectbox("地图图层", map_layers, index=0)
    map_object = build_folium_map(map_data, layer_name)
    try:
        from streamlit_folium import st_folium

        st_folium(
            map_object,
            use_container_width=True,
            height=640,
            returned_objects=[],
            key=f"map_{year_mode}_{layer_name}",
        )
    except ImportError:
        st.error("地图组件未安装。请运行 pip install -r requirements.txt。")

    if spatial.available:
        st.success(
            f"Moran's I = {spatial.moran_i:.4f} ｜ 模拟 p 值 = {spatial.moran_pvalue:.4f} ｜ {spatial.message}"
        )
    else:
        st.info(spatial.message)

    section_heading("SIGNALS", "结构与变化")
    _render_charts(map_data, comparison)

    section_heading("RESULTS", "诊断结果与导出")
    columns = _table_columns(map_data, comparison is not None)
    display = map_data[columns].sort_values(
        "potential_score", ascending=False, na_position="last"
    )
    st.dataframe(display, width="stretch", hide_index=True, height=440)

    export_columns = _export_columns(map_data, columns)
    export_display = map_data[export_columns].sort_values(
        "potential_score", ascending=False, na_position="last"
    )
    csv_bytes = dataframe_to_csv_bytes(export_display)
    geojson_bytes = geodataframe_to_geojson_bytes(
        map_data[export_columns + ["geometry"]]
    )
    download_left, download_right = st.columns(2)
    with download_left:
        st.download_button(
            "下载当前筛选结果 CSV",
            data=csv_bytes,
            file_name=f"regional_potential_{year_mode.replace('—', '-')}.csv",
            mime="text/csv",
            width="stretch",
        )
    with download_right:
        st.download_button(
            "下载当前筛选结果 GeoJSON",
            data=geojson_bytes,
            file_name=f"regional_potential_{year_mode.replace('—', '-')}.geojson",
            mime="application/geo+json",
            width="stretch",
        )

    st.caption(
        "V1.0 Prototype · Joint-scale normalization across 2019/2024 · "
        "Original interface without third-party brand assets"
    )
    _render_sidebar_guide(
        bundle,
        [*normalized.warnings, *score_warnings],
        map_data,
        comparison,
    )


if __name__ == "__main__":
    main()
