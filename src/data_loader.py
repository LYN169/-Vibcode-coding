"""Data discovery, validation, fallback, and county-level table assembly."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Any, BinaryIO, Mapping

import geopandas as gpd
import pandas as pd


BOUNDARY_FIELDS = {"county_code", "province", "city", "county", "geometry"}
TABLE_FIELDS = {
    "nightlight": {"county_code", "year", "ntl_mean", "ntl_sum", "ntl_max", "ntl_median"},
    "population": {"county_code", "year", "pop_total", "pop_density"},
    "road": {"county_code", "year", "road_length_km", "road_density", "highway_density"},
    "economy": {"county_code", "year", "gdp", "gdp_per_capita", "gdp_density"},
}


@dataclass
class DataBundle:
    """Validated source data and user-facing loading diagnostics."""

    boundary: gpd.GeoDataFrame | None = None
    combined: gpd.GeoDataFrame | None = None
    source_mode: str = "unknown"
    sources: dict[str, str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    road_proxy_used: bool = False
    road_static_used: bool = False
    economy_proxy_used: bool = False

    @property
    def ready(self) -> bool:
        """Return whether a merged GeoDataFrame is available for analysis."""

        return self.combined is not None and not self.combined.empty


def normalize_county_code(series: pd.Series) -> pd.Series:
    """Normalize county codes as trimmed strings without destroying leading zeros."""

    return series.astype("string").str.strip().str.replace(r"\.0$", "", regex=True)


def _reset_stream(source: Any) -> None:
    """Reset uploaded file-like objects when the API supports seeking."""

    if hasattr(source, "seek"):
        source.seek(0)


def _read_csv(source: str | Path | BinaryIO, label: str) -> tuple[pd.DataFrame | None, str | None]:
    """Read a CSV while forcing county_code to string and returning readable errors."""

    try:
        _reset_stream(source)
        frame = pd.read_csv(
            source,
            dtype={"county_code": "string"},
            keep_default_na=True,
            na_values=["", "NA", "N/A", "null", "NULL"],
        )
        if "county_code" in frame.columns:
            frame["county_code"] = normalize_county_code(frame["county_code"])
        return frame, None
    except Exception as exc:  # Data errors must remain visible without crashing Streamlit.
        return None, f"{label} 读取失败：{exc}"


def _read_boundary(source: str | Path | BinaryIO) -> tuple[gpd.GeoDataFrame | None, str | None]:
    """Read GeoJSON from a path or uploaded file and preserve county code strings."""

    try:
        if hasattr(source, "read"):
            _reset_stream(source)
            payload = json.load(source)
            frame = gpd.GeoDataFrame.from_features(payload.get("features", []), crs="EPSG:4326")
        else:
            frame = gpd.read_file(source)
        if "county_code" in frame.columns:
            frame["county_code"] = normalize_county_code(frame["county_code"])
        return frame, None
    except Exception as exc:
        return None, f"县域边界读取失败：{exc}"


def _missing_fields(frame: pd.DataFrame, required: set[str]) -> list[str]:
    """Return required columns absent from a DataFrame."""

    return sorted(required.difference(frame.columns))


def _choose_source(
    key: str,
    filename: str,
    uploads: Mapping[str, Any],
    folder: Path,
) -> tuple[Any | None, str | None]:
    """Resolve an uploaded object first, then a local file in the selected source folder."""

    uploaded = uploads.get(key)
    if uploaded is not None:
        return uploaded, "上传文件"
    local = folder / filename
    if local.exists():
        return local, str(local)
    return None, None


def _configured_processed_dir(project: Path) -> Path | None:
    """Resolve a generated real-data directory without hardcoding its absolute path."""

    config_path = project / "config" / "data_sources.json"
    if not config_path.exists():
        return None
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
        configured = Path(config.get("processed_app_data_dir", "outputs/processed/app_data"))
        if not configured.is_absolute():
            configured = project / configured
        required = [
            configured / "county_boundary.geojson",
            configured / "economy_2019.csv",
            configured / "economy_2024.csv",
        ]
        return configured if all(path.exists() for path in required) else None
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return None


def _prepare_table(
    frame: pd.DataFrame,
    theme: str,
    analysis_year: int,
    source_year: int | None = None,
) -> tuple[pd.DataFrame | None, list[str]]:
    """Validate, de-duplicate, and align one thematic table to an analysis year."""

    messages: list[str] = []
    missing = _missing_fields(frame, TABLE_FIELDS[theme])
    if missing:
        return None, [f"{theme} 表缺少字段：{', '.join(missing)}"]

    result = frame.copy()
    result["county_code"] = normalize_county_code(result["county_code"])
    result["year"] = pd.to_numeric(result["year"], errors="coerce").astype("Int64")
    expected_source_year = source_year if source_year is not None else analysis_year
    selected = result.loc[result["year"] == expected_source_year].copy()
    if selected.empty:
        messages.append(f"{theme} 表中没有 year={expected_source_year} 的记录。")
        return None, messages

    duplicate_count = int(selected["county_code"].duplicated().sum())
    if duplicate_count:
        messages.append(f"{theme} 表发现 {duplicate_count} 条重复 county_code，已保留第一条。")
        selected = selected.drop_duplicates("county_code", keep="first")

    selected["year"] = analysis_year
    if theme == "economy":
        selected["year_display"] = expected_source_year
    if theme == "road":
        selected["road_year_display"] = expected_source_year
    return selected, messages


def _load_theme(
    bundle: DataBundle,
    theme: str,
    analysis_year: int,
    source: Any | None,
    source_label: str | None,
    source_year: int | None = None,
) -> pd.DataFrame | None:
    """Read and validate a thematic table while collecting diagnostics."""

    key = f"{theme}_{analysis_year}"
    if source is None:
        bundle.errors.append(f"缺少 {theme} {analysis_year} 数据文件。")
        return None
    frame, error = _read_csv(source, key)
    if error:
        bundle.errors.append(error)
        return None
    assert frame is not None
    prepared, messages = _prepare_table(frame, theme, analysis_year, source_year)
    bundle.warnings.extend(messages)
    if prepared is None:
        return None
    bundle.sources[key] = source_label or "未知来源"
    return prepared


def load_data_bundle(
    project_dir: str | Path,
    uploads: Mapping[str, Any] | None = None,
) -> DataBundle:
    """Load uploads/default files, apply documented fallbacks, and merge both years.

    Source mode is deliberately exclusive: sample data is used only when neither uploads
    nor files in ``data/`` exist, preventing accidental mixing of real and synthetic data.
    """

    project = Path(project_dir)
    data_dir = project / "data"
    sample_dir = project / "sample"
    uploads = dict(uploads or {})
    bundle = DataBundle()

    has_uploads = any(value is not None for value in uploads.values())
    has_local_data = data_dir.exists() and any(
        path.is_file() and path.suffix.lower() in {".csv", ".geojson", ".json"}
        for path in data_dir.iterdir()
    )
    configured_processed = _configured_processed_dir(project)
    if has_uploads or has_local_data:
        source_dir = data_dir
        bundle.source_mode = "用户上传 / data 本地数据"
    elif configured_processed is not None:
        source_dir = configured_processed
        bundle.source_mode = "真实数据标准化输出"
    else:
        source_dir = sample_dir
        bundle.source_mode = "内置 sample 示例数据"
        bundle.warnings.append("未检测到真实数据，当前使用内置 sample 示例数据。")

    boundary_source, boundary_label = _choose_source(
        "boundary", "county_boundary.geojson", uploads, source_dir
    )
    if boundary_source is None:
        bundle.errors.append("缺少县域边界 county_boundary.geojson。")
        return bundle
    boundary, error = _read_boundary(boundary_source)
    if error:
        bundle.errors.append(error)
        return bundle
    assert boundary is not None
    missing = _missing_fields(boundary, BOUNDARY_FIELDS)
    if missing:
        bundle.errors.append(f"县域边界缺少字段：{', '.join(missing)}")
        return bundle
    boundary = boundary.drop_duplicates("county_code", keep="first").copy()
    if boundary.crs is None:
        boundary = boundary.set_crs("EPSG:4326")
        bundle.warnings.append("县域边界未声明 CRS，已按 EPSG:4326 处理。")
    bundle.boundary = boundary
    bundle.sources["boundary"] = boundary_label or "未知来源"

    loaded: dict[tuple[str, int], pd.DataFrame | None] = {}
    for year in (2019, 2024):
        for theme in ("nightlight", "population"):
            filename = f"{theme}_{year}.csv"
            source, label = _choose_source(f"{theme}_{year}", filename, uploads, source_dir)
            loaded[(theme, year)] = _load_theme(bundle, theme, year, source, label)

    road_2024_source, road_2024_label = _choose_source(
        "road_2024", "road_2024.csv", uploads, source_dir
    )
    road_2024 = _load_theme(bundle, "road", 2024, road_2024_source, road_2024_label)
    loaded[("road", 2024)] = road_2024

    road_2019_source, road_2019_label = _choose_source(
        "road_2019", "road_2019.csv", uploads, source_dir
    )
    if road_2019_source is None and road_2024 is not None:
        road_2019 = road_2024.copy()
        road_2019["year"] = 2019
        road_2019["road_year_display"] = 2024
        loaded[("road", 2019)] = road_2019
        bundle.road_proxy_used = True
        bundle.sources["road_2019"] = bundle.sources.get("road_2024", "road_2024")
        bundle.warnings.append("路网数据使用当前年份近似：2019 采用 2024 路网静态条件。")
    else:
        loaded[("road", 2019)] = _load_theme(
            bundle, "road", 2019, road_2019_source, road_2019_label
        )

    if any(
        table is not None
        and "road_data_note" in table.columns
        and table["road_data_note"].notna().any()
        for table in (loaded.get(("road", 2019)), loaded.get(("road", 2024)))
    ):
        bundle.road_static_used = True
        bundle.warnings.append(
            "路网数据为静态截面数据，2019与2024共用；仅表征交通支撑条件，不解释为路网变化。"
        )

    economy_2019_source, economy_2019_label = _choose_source(
        "economy_2019", "economy_2019.csv", uploads, source_dir
    )
    loaded[("economy", 2019)] = _load_theme(
        bundle, "economy", 2019, economy_2019_source, economy_2019_label
    )

    economy_2024_source, economy_2024_label = _choose_source(
        "economy_2024", "economy_2024.csv", uploads, source_dir
    )
    if economy_2024_source is not None:
        loaded[("economy", 2024)] = _load_theme(
            bundle, "economy", 2024, economy_2024_source, economy_2024_label
        )
    else:
        economy_2023_source, economy_2023_label = _choose_source(
            "economy_2023", "economy_2023.csv", uploads, source_dir
        )
        if economy_2023_source is not None:
            loaded[("economy", 2024)] = _load_theme(
                bundle,
                "economy",
                2024,
                economy_2023_source,
                economy_2023_label,
                source_year=2023,
            )
            bundle.economy_proxy_used = loaded[("economy", 2024)] is not None
            if bundle.economy_proxy_used:
                bundle.sources["economy_2024"] = economy_2023_label or "economy_2023"
                bundle.warnings.append(
                    "2024 经济数据暂缺，当前采用 2023 数据；year_display 已保留为 2023。"
                )
        else:
            loaded[("economy", 2024)] = None
            bundle.errors.append("缺少 economy_2024.csv，且未找到可替代的 economy_2023.csv。")

    yearly_frames: list[gpd.GeoDataFrame] = []
    for year in (2019, 2024):
        year_frame = boundary.copy()
        year_frame["year"] = year
        for theme in ("nightlight", "population", "road", "economy"):
            table = loaded.get((theme, year))
            if table is None:
                continue
            columns = ["county_code"] + [
                column
                for column in table.columns
                if column not in {"county_code", "year"}
                and column not in year_frame.columns
            ]
            year_frame = year_frame.merge(
                table[columns], on="county_code", how="left", validate="one_to_one"
            )
        if "year_display" not in year_frame.columns:
            year_frame["year_display"] = year
        else:
            year_frame["year_display"] = year_frame["year_display"].fillna(year).astype("Int64")
        if "road_year_display" not in year_frame.columns:
            year_frame["road_year_display"] = year
        else:
            year_frame["road_year_display"] = (
                year_frame["road_year_display"].fillna(year).astype("Int64")
            )
        yearly_frames.append(gpd.GeoDataFrame(year_frame, geometry="geometry", crs=boundary.crs))

    combined = pd.concat(yearly_frames, ignore_index=True)
    bundle.combined = gpd.GeoDataFrame(combined, geometry="geometry", crs=boundary.crs)
    economic_fields = ["gdp", "gdp_per_capita", "gdp_density"]
    present_economic_fields = [field for field in economic_fields if field in combined.columns]
    if present_economic_fields:
        incomplete_count = int(combined[present_economic_fields].isna().any(axis=1).sum())
        if incomplete_count:
            bundle.warnings.append(
                f"发现 {incomplete_count} 条县域年度经济统计记录存在缺失；原始 NA 已保留，未进行插补。"
            )
    return bundle
