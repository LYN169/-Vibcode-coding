"""Folium map construction for continuous indicators and diagnostic classes."""

from __future__ import annotations

import html
from typing import Any

import folium
import geopandas as gpd
import numpy as np
import pandas as pd
from branca.colormap import LinearColormap
from folium.features import GeoJsonTooltip


LAYER_CONFIG: dict[str, dict[str, Any]] = {
    "GDP 空间分布图": {"field": "gdp", "kind": "numeric", "caption": "GDP"},
    "夜间灯光空间分布图": {
        "field": "ntl_sum",
        "kind": "numeric",
        "caption": "夜间灯光总量",
    },
    "人口支撑指数图": {
        "field": "population_score",
        "kind": "numeric",
        "caption": "人口支撑指数",
    },
    "交通支撑指数图": {
        "field": "transport_score",
        "kind": "numeric",
        "caption": "交通支撑指数",
    },
    "综合潜力指数图": {
        "field": "potential_score",
        "kind": "numeric",
        "caption": "综合潜力指数",
    },
    "空间错配类型图": {
        "field": "mismatch_type",
        "kind": "mismatch",
        "caption": "空间错配类型",
    },
    "LISA 集聚类型图": {
        "field": "lisa_type",
        "kind": "lisa",
        "caption": "LISA 集聚类型",
    },
    "2019—2024 变化图": {
        "field": "potential_score_change",
        "kind": "diverging",
        "caption": "综合潜力指数变化",
    },
}

MISMATCH_COLORS = {
    "稳定增长区": "#B6FF00",
    "潜力释放区": "#00E5FF",
    "承载压力区": "#FF8A00",
    "收缩风险区": "#FF3D57",
    "数据不足": "#4B5563",
}

LISA_COLORS = {
    "高高集聚 HH": "#FF3D57",
    "低低集聚 LL": "#2563EB",
    "高低异常 HL": "#FF8A00",
    "低高异常 LH": "#00E5FF",
    "不显著 Not Significant": "#6B7280",
    "数据不足": "#4B5563",
    "空间分析暂不可用": "#30343B",
}


def available_layers(frame: gpd.GeoDataFrame, comparison_mode: bool) -> list[str]:
    """List map layers whose source fields exist in the current result."""

    layers: list[str] = []
    preferred = ["综合潜力指数图", "空间错配类型图"]
    remaining = [name for name in LAYER_CONFIG if name not in preferred]
    for name in preferred + remaining:
        if name == "2019—2024 变化图" and not comparison_mode:
            continue
        if LAYER_CONFIG[name]["field"] in frame.columns:
            layers.append(name)
    return layers


def _legend_html(title: str, colors: dict[str, str]) -> str:
    """Create a compact categorical legend suitable for the dark basemap."""

    rows = "".join(
        f'<div style="margin:5px 0"><span style="display:inline-block;width:10px;'
        f'height:10px;background:{color};margin-right:8px"></span>{label}</div>'
        for label, color in colors.items()
    )
    return f"""
    <div style="position:fixed;left:22px;bottom:28px;z-index:9999;background:rgba(8,10,9,.92);
    color:#fff;padding:14px 16px;border:1px solid rgba(255,255,255,.20);font-size:12px;
    box-shadow:0 10px 30px rgba(0,0,0,.25);"><b>{title}</b>{rows}</div>
    """


def _format_legend_number(value: float) -> str:
    """Format numeric legend ticks for compact map display."""

    absolute = abs(value)
    if absolute >= 1000:
        return f"{value:,.0f}"
    if absolute >= 10:
        return f"{value:,.2f}".rstrip("0").rstrip(".")
    if absolute >= 1:
        return f"{value:,.3f}".rstrip("0").rstrip(".")
    return f"{value:,.4f}".rstrip("0").rstrip(".")


def _numeric_legend_html(title: str, colors: list[str], minimum: float, maximum: float) -> str:
    """Create a readable floating legend for numeric layers.

    Branca's default SVG legend uses dark tick text and can overlap its caption on
    the CARTO dark basemap. This custom legend gives the color ramp a light glass
    panel, black labels, and enough vertical spacing for the layer title.
    """

    midpoint = (minimum + maximum) / 2
    gradient = ", ".join(colors)
    ticks = "".join(
        f"<span>{html.escape(_format_legend_number(value))}</span>"
        for value in (minimum, midpoint, maximum)
    )
    safe_title = html.escape(title)
    return f"""
    <style>
      .rpl-numeric-legend {{
        position:fixed;
        top:22px;
        right:76px;
        z-index:9999;
        width:360px;
        padding:13px 15px 12px;
        color:#050706!important;
        background:rgba(244,244,240,.94);
        border:1px solid rgba(10,12,11,.25);
        box-shadow:0 14px 34px rgba(0,0,0,.28);
        backdrop-filter:blur(8px);
        font-family:Inter,"Noto Sans SC",Arial,sans-serif;
      }}
      .rpl-numeric-legend .rpl-legend-title {{
        margin:0 0 9px;
        color:#050706!important;
        font-size:13px;
        line-height:1.2;
        font-weight:800;
        letter-spacing:.02em;
      }}
      .rpl-numeric-legend .rpl-legend-bar {{
        height:11px;
        border:1px solid rgba(10,12,11,.28);
        background:linear-gradient(90deg,{gradient});
      }}
      .rpl-numeric-legend .rpl-legend-ticks {{
        display:flex;
        justify-content:space-between;
        gap:12px;
        margin-top:7px;
        color:#050706!important;
        font-size:12px;
        font-weight:700;
        line-height:1.1;
      }}
      .rpl-numeric-legend .rpl-legend-ticks span {{
        color:#050706!important;
        text-shadow:0 1px 0 rgba(255,255,255,.55);
      }}
    </style>
    <div class="rpl-numeric-legend">
      <div class="rpl-legend-title">{safe_title}</div>
      <div class="rpl-legend-bar"></div>
      <div class="rpl-legend-ticks">{ticks}</div>
    </div>
    """


def _tooltip_fields(frame: gpd.GeoDataFrame, selected_field: str) -> tuple[list[str], list[str]]:
    """Select stable identity and metric fields for hover tooltips."""

    label_map = {
        "county": "县区",
        "city": "地市",
        "province": "省份",
        "year": "分析年份",
        "year_display": "经济数据真实年份",
        "gdp": "GDP",
        "missing_gdp": "GDP 是否缺失（1=是）",
        "missing_total_count": "核心指标缺失数",
        "score_quality_flag": "评分质量",
        "economic_valid_weight_sum": "经济有效权重和",
        "potential_valid_weight_sum": "潜力有效权重和",
        "ntl_sum": "夜间灯光总量",
        "pop_total": "人口总量",
        "road_density": "路网密度",
        "economic_score": "经济活力指数",
        "population_score": "人口支撑指数",
        "transport_score": "交通支撑指数",
        "potential_score": "综合潜力指数",
        "support_score": "支撑指数",
        "mismatch_type": "错配类型",
        "mismatch_quality": "错配可信度",
        "lisa_type": "LISA 类型",
        "potential_score_change": "潜力指数变化",
    }
    order = [
        "county",
        "city",
        "province",
        "year",
        "year_display",
        "missing_gdp",
        "score_quality_flag",
        "missing_total_count",
        "economic_valid_weight_sum",
        "potential_valid_weight_sum",
        selected_field,
        "economic_score",
        "population_score",
        "transport_score",
        "potential_score",
        "mismatch_type",
        "mismatch_quality",
        "lisa_type",
    ]
    fields: list[str] = []
    for field in order:
        if field in frame.columns and field not in fields:
            fields.append(field)
    return fields, [label_map.get(field, field) for field in fields]


def _safe_float(value: Any) -> float | None:
    """Convert a feature value to float when finite."""

    try:
        number = float(value)
        return number if np.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def build_folium_map(frame: gpd.GeoDataFrame, layer_name: str) -> folium.Map:
    """Build an interactive county map with hover details, legend, and fit bounds."""

    if frame.empty:
        return folium.Map(location=[35, 105], zoom_start=4, tiles="CartoDB dark_matter")
    config = LAYER_CONFIG[layer_name]
    field = config["field"]
    geo = frame.copy()
    if geo.crs is None:
        geo = geo.set_crs("EPSG:4326")
    elif str(geo.crs).upper() != "EPSG:4326":
        geo = geo.to_crs("EPSG:4326")

    bounds = geo.total_bounds
    center = [(bounds[1] + bounds[3]) / 2, (bounds[0] + bounds[2]) / 2]
    fmap = folium.Map(
        location=center,
        zoom_start=6,
        tiles="CartoDB dark_matter",
        control_scale=True,
        prefer_canvas=True,
    )
    fields, aliases = _tooltip_fields(geo, field)
    tooltip = GeoJsonTooltip(
        fields=fields,
        aliases=aliases,
        localize=True,
        sticky=False,
        labels=True,
        style="background:#0b0d0c;color:#fff;border:1px solid #b6ff00;padding:10px;",
    )

    if config["kind"] in {"numeric", "diverging"}:
        values = pd.to_numeric(geo[field], errors="coerce")
        finite = values[np.isfinite(values)]
        minimum = float(finite.min()) if not finite.empty else 0.0
        maximum = float(finite.max()) if not finite.empty else 1.0
        if np.isclose(minimum, maximum):
            maximum = minimum + 1.0
        colors = (
            ["#2563EB", "#F4F4F0", "#FF5A36"]
            if config["kind"] == "diverging"
            else ["#111814", "#2C5B37", "#B6FF00", "#F4F4F0"]
        )
        colormap = LinearColormap(colors, vmin=minimum, vmax=maximum)
        colormap.caption = config["caption"]

        def numeric_style(feature: dict[str, Any]) -> dict[str, Any]:
            value = _safe_float(feature["properties"].get(field))
            fill = "#343A40" if value is None else colormap(value)
            return {
                "fillColor": fill,
                "color": "#D8DED9",
                "weight": 0.8,
                "fillOpacity": 0.78,
            }

        folium.GeoJson(
            geo,
            name=layer_name,
            style_function=numeric_style,
            highlight_function=lambda _: {"weight": 2.4, "color": "#FFFFFF", "fillOpacity": 0.92},
            tooltip=tooltip,
        ).add_to(fmap)
        fmap.get_root().html.add_child(
            folium.Element(_numeric_legend_html(config["caption"], colors, minimum, maximum))
        )
    else:
        palette = MISMATCH_COLORS if config["kind"] == "mismatch" else LISA_COLORS

        def category_style(feature: dict[str, Any]) -> dict[str, Any]:
            category = feature["properties"].get(field)
            return {
                "fillColor": palette.get(str(category), "#343A40"),
                "color": "#E5E7EB",
                "weight": 0.9,
                "fillOpacity": 0.84,
            }

        folium.GeoJson(
            geo,
            name=layer_name,
            style_function=category_style,
            highlight_function=lambda _: {"weight": 2.4, "color": "#FFFFFF", "fillOpacity": 0.95},
            tooltip=tooltip,
        ).add_to(fmap)
        fmap.get_root().html.add_child(folium.Element(_legend_html(config["caption"], palette)))

    fmap.fit_bounds([[bounds[1], bounds[0]], [bounds[3], bounds[2]]], padding=(18, 18))
    folium.LayerControl(collapsed=True).add_to(fmap)
    return fmap
