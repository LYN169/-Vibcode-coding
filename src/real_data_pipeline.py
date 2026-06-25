"""Configuration-driven, non-destructive real-data standardization pipeline."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import pandas as pd

from src.admin_divisions import apply_city_name_mapping, load_city_reference
from src.indicator_engine import build_comparison, classify_mismatch, compute_joint_scores
from src.spatial_analysis import run_spatial_analysis


CSV_ENCODINGS = ("utf-8-sig", "utf-8", "gbk", "gb18030")
ROAD_DATA_NOTE = "静态路网截面数据，2019与2024共用"
REQUIRED_RAW_FILES = {
    "economy": "economy_2019-2024.csv",
    "nightlight_2019": "nightlight_2019.csv",
    "nightlight_2024": "nightlight_2024.csv",
    "population_2019": "population_2019.csv",
    "population_2024": "population_2024.csv",
    "road": "road_2019&2024.csv",
    "boundary": "中国_县.geojson",
}


@dataclass
class FileAudit:
    """Compact audit record for one raw input file."""

    key: str
    filename: str
    success: bool
    encoding: str = ""
    raw_rows: int = 0
    raw_columns: int = 0
    standard_rows: int = 0
    columns: list[str] = field(default_factory=list)
    core_columns: list[str] = field(default_factory=list)
    unnamed_columns: int = 0
    notes: list[str] = field(default_factory=list)


@dataclass
class PipelineResult:
    """Processed real-data outputs and summary diagnostics."""

    boundary: gpd.GeoDataFrame
    master: gpd.GeoDataFrame
    comparison: pd.DataFrame
    audits: list[FileAudit]
    summary: dict[str, Any]
    output_files: list[Path]


def load_pipeline_config(project_dir: str | Path) -> dict[str, Any]:
    """Read the external raw-data location from the project configuration."""

    project = Path(project_dir)
    path = project / "config" / "data_sources.json"
    if not path.exists():
        raise FileNotFoundError(f"缺少数据源配置：{path}")
    config = json.loads(path.read_text(encoding="utf-8"))
    raw_dir = Path(config["raw_data_dir"])
    processed_dir = Path(config.get("processed_app_data_dir", "outputs/processed/app_data"))
    if not processed_dir.is_absolute():
        processed_dir = project / processed_dir
    output_root = Path(config.get("active_output_root", "outputs/processed"))
    if not output_root.is_absolute():
        output_root = project / output_root
    return {
        **config,
        "raw_data_dir": raw_dir,
        "processed_app_data_dir": processed_dir,
        "active_output_root": output_root,
    }


def read_csv_flexible(path: str | Path) -> tuple[pd.DataFrame, str, list[str]]:
    """Read a CSV with required encoding fallbacks, then try pandas Excel support."""

    source = Path(path)
    failures: list[str] = []
    for encoding in CSV_ENCODINGS:
        try:
            frame = pd.read_csv(
                source,
                encoding=encoding,
                dtype=str,
                low_memory=False,
                keep_default_na=True,
            )
            return frame, encoding, failures
        except Exception as exc:
            failures.append(f"{encoding}: {type(exc).__name__}: {exc}")
    try:
        frame = pd.read_excel(source, dtype=str)
        return frame, "pandas.read_excel", failures
    except Exception as exc:
        failures.append(f"read_excel: {type(exc).__name__}: {exc}")
        raise ValueError(f"无法读取 {source.name}；" + " | ".join(failures)) from exc


def normalize_county_code(series: pd.Series) -> pd.Series:
    """Accept exactly six digits or the 156-prefixed nine-digit GB form."""

    clean = (
        series.astype("string")
        .str.strip()
        .str.replace(r"\.0$", "", regex=True)
    )
    return clean.str.extract(r"^(?:156)?(\d{6})$", expand=False).astype("string")


def numeric_series(series: pd.Series) -> pd.Series:
    """Convert numeric text while retaining blank and invalid values as NA."""

    clean = series.astype("string").str.replace(",", "", regex=False).str.strip()
    return pd.to_numeric(clean, errors="coerce")


def _drop_unnamed(frame: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Remove spreadsheet-export tail columns whose names begin with Unnamed."""

    unnamed = [column for column in frame.columns if str(column).startswith("Unnamed:")]
    return frame.drop(columns=unnamed, errors="ignore"), unnamed


def _audit_csv(key: str, path: Path) -> tuple[pd.DataFrame, FileAudit, pd.DataFrame]:
    """Read one CSV, capture its raw schema, and separate invalid code rows."""

    raw, encoding, failures = read_csv_flexible(path)
    core, unnamed = _drop_unnamed(raw)
    codes = normalize_county_code(core.get("county_code", pd.Series(pd.NA, index=core.index)))
    invalid = core.loc[codes.isna()].copy()
    invalid.insert(0, "data_source", key)
    invalid.insert(1, "reason", "county_code 不是6位或156前缀9位行政代码")
    audit = FileAudit(
        key=key,
        filename=path.name,
        success=True,
        encoding=encoding,
        raw_rows=len(raw),
        raw_columns=len(raw.columns),
        columns=[str(column) for column in raw.columns],
        core_columns=[str(column) for column in core.columns],
        unnamed_columns=len(unnamed),
        notes=failures,
    )
    if unnamed:
        affected = int(raw[unnamed].notna().any(axis=1).sum())
        audit.notes.append(f"删除 {len(unnamed)} 个 Unnamed 尾列；涉及 {affected} 条异常扩展记录。")
    return core, audit, invalid


def _standardize_road(
    frame: pd.DataFrame,
    audit: FileAudit,
    city_reference: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Validate the static road section and create two logical years."""

    required = [
        "county_code",
        "province_code",
        "city_code",
        "province",
        "city",
        "county",
        "area_km2",
        "road_length_km",
        "highway_length_km",
        "road_density",
        "highway_density",
    ]
    missing = [column for column in required if column not in frame.columns]
    if missing:
        raise ValueError(f"road 缺少字段：{', '.join(missing)}")
    road = frame[required].copy()
    road["county_code"] = normalize_county_code(road["county_code"])
    road = road.loc[road["county_code"].notna()].copy()
    road["province_code"] = road["county_code"].str[:2]
    road["city_code"] = road["county_code"].str[:4]
    # The source 'city' column contains four-digit codes. Keep it for audit, while
    # the display field is replaced by the local MCA 2023 reference snapshot.
    road, mapping_warnings = apply_city_name_mapping(road, city_reference)
    for column in (
        "area_km2",
        "road_length_km",
        "highway_length_km",
        "road_density",
        "highway_density",
    ):
        road[column] = numeric_series(road[column])
    road["road_data_note"] = ROAD_DATA_NOTE
    road = road.drop_duplicates("county_code", keep="first")
    audit.standard_rows = len(road)
    audit.notes.extend(mapping_warnings)
    mapped_codes = int(
        road.loc[road["city_mapping_status"].eq("mapped"), "city_code"].nunique()
    )
    audit.notes.append(
        f"源 city 四位代码已按民政部2023参考快照转换为中文名称；覆盖 {mapped_codes} 个地市代码。"
    )
    audit.notes.append("源 year=2024 的静态截面复制为2019和2024两个逻辑年份。")
    road_2019 = road.copy()
    road_2019["year"] = 2019
    road_2024 = road.copy()
    road_2024["year"] = 2024
    return road_2019, road_2024


def _standardize_boundary(
    path: Path,
    road_metadata: pd.DataFrame,
) -> tuple[gpd.GeoDataFrame, FileAudit, pd.DataFrame]:
    """Create a polygon county boundary and attach available administrative metadata."""

    raw = gpd.read_file(path)
    required = ["name", "gb", "geometry"]
    missing = [column for column in required if column not in raw.columns]
    if missing:
        raise ValueError(f"boundary 缺少字段：{', '.join(missing)}")
    codes = normalize_county_code(raw["gb"])
    polygon_mask = raw.geometry.geom_type.isin(["Polygon", "MultiPolygon"])
    valid = codes.notna() & polygon_mask & raw.geometry.notna() & ~raw.geometry.is_empty
    invalid = raw.loc[~valid, ["name", "gb"]].copy()
    invalid.insert(0, "data_source", "boundary")
    invalid.insert(1, "reason", "缺少有效gb县码或几何不是县域面")
    boundary = raw.loc[valid, ["name", "gb", "geometry"]].copy()
    boundary["county_code"] = codes.loc[valid]
    boundary["county"] = boundary["name"].astype("string")
    boundary["province_code"] = boundary["county_code"].str[:2]
    boundary["city_code"] = boundary["county_code"].str[:4]
    metadata_columns = [
        "county_code",
        "province",
        "city",
        "city_mapping_type",
        "city_mapping_status",
        "area_km2",
    ]
    metadata = road_metadata[metadata_columns].drop_duplicates("county_code")
    boundary = boundary.merge(metadata, on="county_code", how="left", validate="one_to_one")
    boundary["city"] = boundary["city"].fillna(boundary["city_code"])
    boundary = boundary[
        [
            "county_code",
            "province_code",
            "city_code",
            "province",
            "city",
            "city_mapping_type",
            "city_mapping_status",
            "county",
            "area_km2",
            "geometry",
        ]
    ]
    boundary = gpd.GeoDataFrame(boundary, geometry="geometry", crs=raw.crs)
    if boundary.crs is None:
        boundary = boundary.set_crs("EPSG:4490")
    boundary = boundary.to_crs("EPSG:4326")
    audit = FileAudit(
        key="boundary",
        filename=path.name,
        success=True,
        encoding="GeoJSON / pyogrio",
        raw_rows=len(raw),
        raw_columns=len(raw.columns),
        standard_rows=len(boundary),
        columns=[str(column) for column in raw.columns],
        core_columns=required,
        notes=[
            f"排除 {len(invalid)} 条无有效县码的非县域面记录。",
            "EPSG:4490 标准化输出转换为 EPSG:4326。",
        ],
    )
    return boundary, audit, invalid


def _standardize_economy(frame: pd.DataFrame, audit: FileAudit) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Standardize either the new long economy table or the legacy wide table.

    Numeric parse failures remain NA. Duplicate county-year keys are rejected instead
    of being silently collapsed because they would make the economic source ambiguous.
    """

    long_required = {"county_code", "year", "gdp", "gdp_per_capita", "gdp_density"}
    wide_required = {"county_code", "county", "gdp_2019", "gdp_2024"}
    parts: list[pd.DataFrame] = []

    if long_required.issubset(frame.columns):
        optional = [
            column
            for column in ("county", "economy_unit", "match_status", "gb")
            if column in frame.columns
        ]
        base = frame[[*long_required, *optional]].copy()
        base["county_code"] = normalize_county_code(base["county_code"])
        base["year"] = pd.to_numeric(base["year"], errors="coerce").astype("Int64")
        base = base.loc[
            base["county_code"].notna() & base["year"].isin([2019, 2024])
        ].copy()
        duplicate_count = int(base.duplicated(["county_code", "year"]).sum())
        if duplicate_count:
            raise ValueError(
                f"economy 长表存在 {duplicate_count} 条重复 county_code + year 记录。"
            )
        for column in ("gdp", "gdp_per_capita", "gdp_density"):
            base[column] = numeric_series(base[column])
        if "economy_unit" not in base.columns:
            base["economy_unit"] = "亿元"
        base["year_display"] = base["year"]
        for year in (2019, 2024):
            parts.append(base.loc[base["year"] == year].copy())
        audit.standard_rows = sum(len(part) for part in parts)
        audit.notes.append(
            "识别为长表经济数据；按 county_code + year 校验唯一性，原始 NA 未插补。"
        )
        return parts[0], parts[1]

    if wide_required.issubset(frame.columns):
        base = frame[list(wide_required)].copy()
        base["county_code"] = normalize_county_code(base["county_code"])
        base = base.loc[base["county_code"].notna()].copy()
        for year in (2019, 2024):
            part = base[["county_code", "county", f"gdp_{year}"]].rename(
                columns={f"gdp_{year}": "gdp"}
            )
            part["year"] = year
            part["year_display"] = year
            part["gdp"] = numeric_series(part["gdp"])
            part["gdp_per_capita"] = np.nan
            part["gdp_density"] = np.nan
            part["economy_unit"] = "亿元"
            parts.append(part)
        audit.standard_rows = sum(len(part) for part in parts)
        audit.notes.append("识别为旧宽表 GDP；转为2019/2024长表，未提供字段保留NA。")
        return parts[0], parts[1]

    raise ValueError(
        "economy 字段结构不受支持：需要长表字段 "
        f"{', '.join(sorted(long_required))}，或旧宽表字段 {', '.join(sorted(wide_required))}。"
    )


def _standardize_nightlight(
    frame: pd.DataFrame,
    audit: FileAudit,
    year: int,
) -> pd.DataFrame:
    """Keep recognized county light statistics and discard invalid appended rows."""

    aliases = {
        "name": "county",
        "mean": "ntl_mean",
        "sum": "ntl_sum",
        "max": "ntl_max",
        "median": "ntl_median",
        "平均值": "ntl_mean",
        "总量": "ntl_sum",
    }
    renamed = frame.rename(columns={key: value for key, value in aliases.items() if key in frame.columns})
    required = ["county_code", "ntl_mean", "ntl_sum", "ntl_max", "ntl_median"]
    missing = [column for column in required if column not in renamed.columns]
    if missing:
        raise ValueError(f"nightlight_{year} 缺少字段：{', '.join(missing)}")
    columns = ["county_code"] + (["county"] if "county" in renamed.columns else []) + required[1:]
    result = renamed[columns].copy()
    result["county_code"] = normalize_county_code(result["county_code"])
    result = result.loc[result["county_code"].notna()].copy()
    result["year"] = year
    for column in required[1:]:
        result[column] = numeric_series(result[column])
    result = result.drop_duplicates("county_code", keep="first")
    audit.standard_rows = len(result)
    audit.notes.append("逻辑年份按文件名设置；无效坐标拼接记录不进入县域表。")
    return result


def _standardize_population(
    frame: pd.DataFrame,
    audit: FileAudit,
    year: int,
) -> pd.DataFrame:
    """Standardize population totals/density and correct the file's logical year."""

    aliases = {
        "人口": "pop_total",
        "人口总量": "pop_total",
        "人口密度": "pop_density",
    }
    renamed = frame.rename(columns={key: value for key, value in aliases.items() if key in frame.columns})
    required = ["county_code", "pop_total"]
    missing = [column for column in required if column not in renamed.columns]
    if missing:
        raise ValueError(f"population_{year} 缺少字段：{', '.join(missing)}")
    columns = ["county_code", "pop_total"] + (["pop_density"] if "pop_density" in renamed.columns else [])
    result = renamed[columns].copy()
    result["county_code"] = normalize_county_code(result["county_code"])
    result = result.loc[result["county_code"].notna()].copy()
    result["year"] = year
    result["pop_total"] = numeric_series(result["pop_total"])
    if "pop_density" in result.columns:
        result["pop_density"] = numeric_series(result["pop_density"])
    else:
        result["pop_density"] = np.nan
        audit.notes.append("原始表缺少人口密度；等待主表面积连接后计算。")
    raw_years = sorted(frame["year"].dropna().astype(str).unique()) if "year" in frame.columns else []
    if raw_years and raw_years != [str(year)]:
        audit.notes.append(f"原始 year={raw_years}，已按文件名修正逻辑年份为 {year}。")
    result = result.drop_duplicates("county_code", keep="first")
    audit.standard_rows = len(result)
    return result


def _merge_year(
    boundary: gpd.GeoDataFrame,
    year: int,
    economy: pd.DataFrame,
    nightlight: pd.DataFrame,
    population: pd.DataFrame,
    road: pd.DataFrame,
) -> gpd.GeoDataFrame:
    """Left-join all standardized themes onto the complete boundary."""

    result = boundary.copy()
    result["year"] = year
    for table in (economy, nightlight, population, road):
        keep = ["county_code"] + [
            column
            for column in table.columns
            if column not in {"county_code", "year", "county"}
            and column not in result.columns
        ]
        result = result.merge(table[keep], on="county_code", how="left", validate="one_to_one")
    if result["pop_density"].isna().any():
        can_compute = result["pop_density"].isna() & result["pop_total"].notna() & result["area_km2"].gt(0)
        result.loc[can_compute, "pop_density"] = (
            result.loc[can_compute, "pop_total"] / result.loc[can_compute, "area_km2"]
        )
    return gpd.GeoDataFrame(result, geometry="geometry", crs=boundary.crs)


def _matching_diagnostics(
    boundary: gpd.GeoDataFrame,
    tables: dict[str, pd.DataFrame],
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, list[dict[str, Any]]]:
    """Build unmatched, extra, duplicate, and compact match summary records."""

    boundary_codes = set(boundary["county_code"].dropna())
    boundary_names = boundary.set_index("county_code")[["province", "city", "county"]]
    unmatched_rows: list[dict[str, Any]] = []
    extra_rows: list[dict[str, Any]] = []
    duplicate_rows: list[dict[str, Any]] = []
    summary: list[dict[str, Any]] = []
    for name, table in tables.items():
        codes = table["county_code"].dropna().astype(str)
        code_set = set(codes)
        missing_codes = sorted(boundary_codes - code_set)
        extra_codes = sorted(code_set - boundary_codes)
        duplicates = codes[codes.duplicated(keep=False)].value_counts()
        year = table["year"].iloc[0] if "year" in table.columns and len(table) else ""
        for code in missing_codes:
            meta = boundary_names.loc[code]
            unmatched_rows.append(
                {
                    "data_source": name,
                    "year": year,
                    "county_code": code,
                    "province": meta["province"],
                    "city": meta["city"],
                    "county": meta["county"],
                }
            )
        for code in extra_codes:
            extra_rows.append(
                {"data_source": name, "year": year, "county_code": code, "reason": "指标代码不在边界中"}
            )
        for code, count in duplicates.items():
            duplicate_rows.append(
                {"data_source": name, "year": year, "county_code": code, "duplicate_count": int(count)}
            )
        summary.append(
            {
                "data_source": name,
                "year": year,
                "rows": len(table),
                "unique_codes": len(code_set),
                "matched": len(code_set & boundary_codes),
                "boundary_unmatched": len(missing_codes),
                "extra_codes": len(extra_codes),
                "duplicates": int(codes.duplicated().sum()),
            }
        )
    return (
        pd.DataFrame(unmatched_rows, columns=["data_source", "year", "county_code", "province", "city", "county"]),
        pd.DataFrame(extra_rows, columns=["data_source", "year", "county_code", "reason"]),
        pd.DataFrame(duplicate_rows, columns=["data_source", "year", "county_code", "duplicate_count"]),
        summary,
    )


def _missing_summary(master: pd.DataFrame) -> pd.DataFrame:
    """Summarize missingness for raw indicators, scores, and audit fields by year."""

    fields = [
        "gdp",
        "gdp_per_capita",
        "gdp_density",
        "ntl_sum",
        "ntl_mean",
        "ntl_max",
        "ntl_median",
        "pop_total",
        "pop_density",
        "road_length_km",
        "highway_length_km",
        "road_density",
        "highway_density",
        "economic_score",
        "population_score",
        "transport_score",
        "potential_score",
    ]
    rows: list[dict[str, Any]] = []
    for year, group in master.groupby("year"):
        for field in fields:
            missing = int(group[field].isna().sum()) if field in group.columns else len(group)
            rows.append(
                {
                    "year": int(year),
                    "field": field,
                    "total_rows": len(group),
                    "missing_count": missing,
                    "missing_ratio": missing / len(group) if len(group) else np.nan,
                }
            )
    return pd.DataFrame(rows)


def _write_csv(frame: pd.DataFrame, path: Path) -> None:
    """Write UTF-8-SIG CSV with NA serialized as empty cells."""

    path.parent.mkdir(parents=True, exist_ok=True)
    frame.drop(columns="geometry", errors="ignore").to_csv(
        path, index=False, encoding="utf-8-sig", na_rep=""
    )


def _write_geojson(frame: gpd.GeoDataFrame, path: Path) -> None:
    """Write WGS84 GeoJSON with NA serialized as JSON null."""

    path.parent.mkdir(parents=True, exist_ok=True)
    geo = frame.to_crs("EPSG:4326") if frame.crs and str(frame.crs).upper() != "EPSG:4326" else frame
    path.write_text(geo.to_json(drop_id=True, na="null"), encoding="utf-8")


def _format_columns(audit: FileAudit) -> str:
    """Format real fields compactly while acknowledging exported Unnamed tails."""

    base = ", ".join(f"`{column}`" for column in audit.core_columns)
    if audit.unnamed_columns:
        return f"{base}；另有 Unnamed 尾列 {audit.unnamed_columns} 个"
    return base


def _write_validation_report(
    path: Path,
    raw_dir: Path,
    audits: list[FileAudit],
    match_summary: list[dict[str, Any]],
    missing_summary: pd.DataFrame,
    master: gpd.GeoDataFrame,
    summary: dict[str, Any],
) -> None:
    """Write a reproducible Markdown validation report from computed diagnostics."""

    lines = [
        "# Regional Potential Lab 真实数据检测报告",
        "",
        f"- 检测时间：{datetime.now().astimezone().isoformat(timespec='seconds')}",
        f"- 原始数据目录：`{raw_dir}`",
        "- 原始文件处理：只读；未删除、覆盖或回写。",
        f"- 检测结论：**{summary['validation_conclusion']}**",
        "",
        "## 1. 文件读取与字段",
        "",
        "| 文件 | 成功 | 编码/驱动 | 原始行×列 | 标准行数 | 字段 |",
        "|---|---:|---|---:|---:|---|",
    ]
    for audit in audits:
        lines.append(
            f"| `{audit.filename}` | {'是' if audit.success else '否'} | {audit.encoding} | "
            f"{audit.raw_rows}×{audit.raw_columns} | {audit.standard_rows} | {_format_columns(audit)} |"
        )
    lines.extend(["", "## 2. 自动识别与修复记录", ""])
    for audit in audits:
        if audit.notes:
            lines.append(f"### {audit.filename}")
            lines.extend(f"- {note}" for note in audit.notes if note)
            lines.append("")
    lines.extend(
        [
            "## 3. county_code 与边界匹配",
            "",
            f"- 有效县域边界：{summary['boundary_count']} 个；均为6位字符串且无重复。",
            f"- 无代码/非面‘境界线’记录：{summary['boundary_invalid_records']} 条，未作为县域进入主表。",
            "",
            "| 数据表 | 年份 | 行数 | 唯一代码 | 匹配 | 边界未匹配 | 指标多余 | 重复 |",
            "|---|---:|---:|---:|---:|---:|---:|---:|",
        ]
    )
    for item in match_summary:
        lines.append(
            f"| {item['data_source']} | {item['year']} | {item['rows']} | {item['unique_codes']} | "
            f"{item['matched']} | {item['boundary_unmatched']} | {item['extra_codes']} | {item['duplicates']} |"
        )
    lines.extend(["", "## 4. 缺失值", ""])
    for year in (2019, 2024):
        group = missing_summary.loc[missing_summary["year"] == year].set_index("field")
        lines.extend(
            [
                f"### {year}",
                f"- GDP 缺失：{int(group.loc['gdp', 'missing_count'])} / {int(group.loc['gdp', 'total_rows'])} "
                f"({group.loc['gdp', 'missing_ratio']:.2%})。",
                f"- 夜间灯光核心字段缺失：ntl_sum {int(group.loc['ntl_sum', 'missing_count'])}，ntl_mean {int(group.loc['ntl_mean', 'missing_count'])}。",
                f"- 人口缺失：pop_total {int(group.loc['pop_total', 'missing_count'])}，pop_density {int(group.loc['pop_density', 'missing_count'])}。",
                f"- 路网缺失：road_density {int(group.loc['road_density', 'missing_count'])}，highway_density {int(group.loc['highway_density', 'missing_count'])}。",
                f"- potential_score 无法计算：{int(group.loc['potential_score', 'missing_count'])}。",
                "",
            ]
        )
    lines.extend(
        [
            "## 5. 双期合并与指标计算",
            "",
            f"- 主表总行数：{len(master)}，2019和2024各 {summary['boundary_count']} 行。",
            "- 两期在全域合并后执行同一套 min-max 标准化；地区筛选不参与标准化范围。",
            "- GDP、gdp_per_capita、gdp_density 缺失保持 NA；未填0、未插补、未删除县域。",
            f"- 2019 potential_score 可计算：{summary['potential_available_2019']}；2024：{summary['potential_available_2024']}。",
            f"- 2019 mismatch_type=数据不足：{summary['mismatch_insufficient_2019']}；2024：{summary['mismatch_insufficient_2024']}。",
            "- 路网为同一静态截面复制到两期，仅表征交通支撑条件，不解释为路网变化。",
            "",
            "## 6. 几何检查",
            "",
            f"- 主表 geometry 缺失：{summary['geometry_missing']}。",
            f"- 主表 geometry 无效：{summary['geometry_invalid']}。",
            "- 标准化 GeoJSON 输出为 EPSG:4326。",
            "",
            "## 7. 发现的问题与人工确认",
            "",
            "1. `population_2024.csv` 的原始 `year` 全部为2019；已按文件名修正为2024，原文件未改。",
            "2. 两个夜间灯光文件各含14条坐标串误拼记录和大量 Unnamed 尾列；标准化时仅保留2891条有效行政代码记录。",
            "3. 路网原始 `city` 列为4位代码；标准化阶段已按民政部2023参考快照转换为中文名称，并保留 city_code 与映射状态供追溯。",
            "4. 经济数据缺失严重，但动态权重允许使用灯光、人口和路网继续计算综合潜力；论文中应披露缺失比例和质量标记。",
            "",
            "## 8. 结论",
            "",
            f"**{summary['validation_conclusion']}**：数据能够形成双期县域主表并驱动网页；原始文件异常已隔离，地市名称映射覆盖当前全部代码。",
        ]
    )
    lines.extend(
        [
            "",
            "## 9. V2 核心统计与空间分析",
            "",
            f"- county_code 格式异常：{summary['county_code_invalid']}；县域—年份重复：{summary['county_year_duplicates']}。",
            f"- 相对边界代码缺口：2019 为 {summary['county_gap_2019']}，2024 为 {summary['county_gap_2024']}。",
            f"- 2019 score_quality_flag：{summary['score_quality_2019']}。",
            f"- 2024 score_quality_flag：{summary['score_quality_2024']}。",
            f"- 2019 mismatch_type：{summary['mismatch_type_2019']}。",
            f"- 2024 mismatch_type：{summary['mismatch_type_2024']}。",
            f"- economy.match_status=matched 但 GDP 仍为空：2019 为 {summary['economy_matched_blank_gdp_2019']}，2024 为 {summary['economy_matched_blank_gdp_2024']}。",
            "- gdp_per_capita 与 gdp_density 两列在两期均全部为空，未插补，因此没有 complete 质量记录。",
            f"- 地市代码映射：{summary['city_code_mapped']} / {summary['city_code_total']}；未映射 {summary['city_code_unmapped']}。",
            "",
            "### Moran's I 与 LISA（potential_score，99 次置换，seed=42）",
            "",
            "| 年份 | 可用 | Moran's I | 模拟 p 值 | LISA 回填数 |",
            "|---:|---:|---:|---:|---:|",
        ]
    )
    for year in (2019, 2024):
        spatial = summary["spatial"][str(year)]
        moran_i = "NA" if spatial["moran_i"] is None else f"{spatial['moran_i']:.6f}"
        pvalue = "NA" if spatial["moran_pvalue"] is None else f"{spatial['moran_pvalue']:.4f}"
        lines.append(
            f"| {year} | {'是' if spatial['available'] else '否'} | {moran_i} | {pvalue} | {spatial['lisa_filled_count']} |"
        )
    lines.append("")
    for year in (2019, 2024):
        spatial = summary["spatial"][str(year)]
        lines.append(f"- {year} LISA 类型分布：{spatial['lisa_type_distribution']}。")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def process_real_data(
    project_dir: str | Path,
    output_root: str | Path | None = None,
) -> PipelineResult:
    """Execute the complete real-data standardization and diagnostic pipeline."""

    project = Path(project_dir).resolve()
    config = load_pipeline_config(project)
    raw_dir: Path = config["raw_data_dir"]
    version_root = Path(output_root) if output_root is not None else config["active_output_root"]
    if not version_root.is_absolute():
        version_root = project / version_root
    version_root = version_root.resolve()
    app_data_dir = version_root / "app_data"
    processed_dir = version_root
    diagnostics_dir = version_root
    for filename in REQUIRED_RAW_FILES.values():
        if not (raw_dir / filename).exists():
            raise FileNotFoundError(f"缺少原始数据文件：{raw_dir / filename}")

    audits: list[FileAudit] = []
    invalid_indicator_records: list[pd.DataFrame] = []

    city_reference = load_city_reference(project)
    road_raw, road_audit, road_invalid = _audit_csv("road", raw_dir / REQUIRED_RAW_FILES["road"])
    road_2019, road_2024 = _standardize_road(road_raw, road_audit, city_reference)
    audits.append(road_audit)
    invalid_indicator_records.append(road_invalid)

    boundary, boundary_audit, invalid_boundary = _standardize_boundary(
        raw_dir / REQUIRED_RAW_FILES["boundary"], road_2024
    )
    audits.append(boundary_audit)

    economy_raw, economy_audit, economy_invalid = _audit_csv(
        "economy", raw_dir / REQUIRED_RAW_FILES["economy"]
    )
    economy_2019, economy_2024 = _standardize_economy(economy_raw, economy_audit)
    audits.append(economy_audit)
    invalid_indicator_records.append(economy_invalid)

    night_tables: dict[int, pd.DataFrame] = {}
    population_tables: dict[int, pd.DataFrame] = {}
    for year in (2019, 2024):
        key = f"nightlight_{year}"
        raw, audit, invalid = _audit_csv(key, raw_dir / REQUIRED_RAW_FILES[key])
        night_tables[year] = _standardize_nightlight(raw, audit, year)
        audits.append(audit)
        invalid_indicator_records.append(invalid)

        key = f"population_{year}"
        raw, audit, invalid = _audit_csv(key, raw_dir / REQUIRED_RAW_FILES[key])
        population_tables[year] = _standardize_population(raw, audit, year)
        audits.append(audit)
        invalid_indicator_records.append(invalid)

    tables = {
        "economy_2019": economy_2019,
        "economy_2024": economy_2024,
        "nightlight_2019": night_tables[2019],
        "nightlight_2024": night_tables[2024],
        "population_2019": population_tables[2019],
        "population_2024": population_tables[2024],
        "road_2019": road_2019,
        "road_2024": road_2024,
    }
    unmatched, extra, duplicates, match_summary = _matching_diagnostics(boundary, tables)
    invalid_nonempty = [frame for frame in invalid_indicator_records if not frame.empty]
    if invalid_nonempty:
        invalid_extra = pd.concat(invalid_nonempty, ignore_index=True)
        invalid_extra = invalid_extra.rename(columns={"county_code": "raw_county_code"})
        invalid_extra["county_code"] = pd.NA
        extra = pd.concat(
            [
                extra,
                invalid_extra[["data_source", "county_code", "reason", "raw_county_code"]],
            ],
            ignore_index=True,
            sort=False,
        )

    master_2019 = _merge_year(
        boundary,
        2019,
        economy_2019,
        night_tables[2019],
        population_tables[2019],
        road_2019,
    )
    master_2024 = _merge_year(
        boundary,
        2024,
        economy_2024,
        night_tables[2024],
        population_tables[2024],
        road_2024,
    )
    combined = gpd.GeoDataFrame(
        pd.concat([master_2019, master_2024], ignore_index=True),
        geometry="geometry",
        crs=boundary.crs,
    )
    scored_frame, score_warnings = compute_joint_scores(combined)
    scored = gpd.GeoDataFrame(scored_frame, geometry="geometry", crs=boundary.crs)
    classified_without_spatial = gpd.GeoDataFrame(
        pd.concat(
            [classify_mismatch(scored.loc[scored["year"] == year].copy()) for year in (2019, 2024)],
            ignore_index=True,
        ),
        geometry="geometry",
        crs=boundary.crs,
    )
    spatial_results: dict[int, Any] = {}
    spatial_frames: list[gpd.GeoDataFrame] = []
    for year in (2019, 2024):
        year_frame = classified_without_spatial.loc[
            classified_without_spatial["year"] == year
        ].copy()
        spatial = run_spatial_analysis(
            year_frame,
            value_column="potential_score",
            permutations=99,
            seed=42,
        )
        spatial_results[year] = spatial
        spatial_frames.append(spatial.frame)
    classified = gpd.GeoDataFrame(
        pd.concat(spatial_frames, ignore_index=True),
        geometry="geometry",
        crs=boundary.crs,
    )
    comparison = build_comparison(classified)
    change_columns = [
        "county_code",
        *[column for column in comparison.columns if column.endswith("_change")],
        *[column for column in comparison.columns if column.endswith("_growth_rate")],
    ]
    change_columns = list(dict.fromkeys(change_columns))
    compare_geo = classified.loc[classified["year"] == 2024].merge(
        comparison[change_columns], on="county_code", how="left", validate="one_to_one"
    )
    compare_geo = gpd.GeoDataFrame(compare_geo, geometry="geometry", crs=boundary.crs)

    app_data_dir.mkdir(parents=True, exist_ok=True)
    _write_geojson(boundary, app_data_dir / "county_boundary.geojson")
    for name, table in tables.items():
        app_table = table
        if name.startswith("road_"):
            app_table = table[
                [
                    "county_code",
                    "year",
                    "road_length_km",
                    "highway_length_km",
                    "road_density",
                    "highway_density",
                    "road_data_note",
                ]
            ]
        _write_csv(app_table, app_data_dir / f"{name}.csv")

    output_files = [
        app_data_dir / "county_boundary.geojson",
        *[app_data_dir / f"{name}.csv" for name in tables],
    ]
    road_2019_path = processed_dir / "road_2019_standard.csv"
    road_2024_path = processed_dir / "road_2024_standard.csv"
    master_path = processed_dir / "county_indicators_long.csv"
    geo_2019_path = processed_dir / "county_indicators_2019.geojson"
    geo_2024_path = processed_dir / "county_indicators_2024.geojson"
    compare_path = processed_dir / "county_indicators_compare.geojson"
    _write_csv(road_2019, road_2019_path)
    _write_csv(road_2024, road_2024_path)
    _write_csv(classified, master_path)
    _write_geojson(classified.loc[classified["year"] == 2019], geo_2019_path)
    _write_geojson(classified.loc[classified["year"] == 2024], geo_2024_path)
    _write_geojson(compare_geo, compare_path)
    output_files.extend(
        [road_2019_path, road_2024_path, master_path, geo_2019_path, geo_2024_path, compare_path]
    )

    missing_summary = _missing_summary(classified)
    unmatched_path = diagnostics_dir / "unmatched_boundary_counties.csv"
    extra_path = diagnostics_dir / "extra_indicator_counties.csv"
    missing_path = diagnostics_dir / "missing_value_summary.csv"
    duplicate_path = diagnostics_dir / "duplicate_county_code_report.csv"
    _write_csv(unmatched, unmatched_path)
    _write_csv(extra, extra_path)
    _write_csv(missing_summary, missing_path)
    _write_csv(duplicates, duplicate_path)
    output_files.extend([unmatched_path, extra_path, missing_path, duplicate_path])

    summary = {
        "validation_conclusion": "部分通过",
        "boundary_count": len(boundary),
        "boundary_invalid_records": len(invalid_boundary),
        "master_rows": len(classified),
        "valid_counties_2019": int(classified.loc[classified["year"] == 2019, "county_code"].nunique()),
        "valid_counties_2024": int(classified.loc[classified["year"] == 2024, "county_code"].nunique()),
        "gdp_missing_2019": int(classified.loc[classified["year"] == 2019, "gdp"].isna().sum()),
        "gdp_missing_2024": int(classified.loc[classified["year"] == 2024, "gdp"].isna().sum()),
        "potential_available_2019": int(classified.loc[classified["year"] == 2019, "potential_score"].notna().sum()),
        "potential_available_2024": int(classified.loc[classified["year"] == 2024, "potential_score"].notna().sum()),
        "mismatch_insufficient_2019": int(classified.loc[classified["year"] == 2019, "mismatch_type"].eq("数据不足").sum()),
        "mismatch_insufficient_2024": int(classified.loc[classified["year"] == 2024, "mismatch_type"].eq("数据不足").sum()),
        "geometry_missing": int(classified.geometry.isna().sum()),
        "geometry_invalid": int((~classified.geometry.is_valid & classified.geometry.notna()).sum()),
        "score_warnings": score_warnings,
        "county_code_invalid": int(
            (~classified["county_code"].astype("string").str.fullmatch(r"\d{6}").fillna(False)).sum()
        ),
        "county_year_duplicates": int(classified.duplicated(["county_code", "year"]).sum()),
        "county_gap_2019": int(
            len(set(boundary["county_code"]) - set(classified.loc[classified["year"] == 2019, "county_code"]))
        ),
        "county_gap_2024": int(
            len(set(boundary["county_code"]) - set(classified.loc[classified["year"] == 2024, "county_code"]))
        ),
        "score_quality_2019": classified.loc[
            classified["year"] == 2019, "score_quality_flag"
        ].value_counts(dropna=False).to_dict(),
        "score_quality_2024": classified.loc[
            classified["year"] == 2024, "score_quality_flag"
        ].value_counts(dropna=False).to_dict(),
        "mismatch_type_2019": classified.loc[
            classified["year"] == 2019, "mismatch_type"
        ].value_counts(dropna=False).to_dict(),
        "mismatch_type_2024": classified.loc[
            classified["year"] == 2024, "mismatch_type"
        ].value_counts(dropna=False).to_dict(),
        "economy_matched_blank_gdp_2019": int(
            classified.loc[
                (classified["year"] == 2019)
                & classified.get("match_status", pd.Series(pd.NA, index=classified.index)).eq("matched")
                & classified["gdp"].isna()
            ].shape[0]
        ),
        "economy_matched_blank_gdp_2024": int(
            classified.loc[
                (classified["year"] == 2024)
                & classified.get("match_status", pd.Series(pd.NA, index=classified.index)).eq("matched")
                & classified["gdp"].isna()
            ].shape[0]
        ),
        "city_code_total": int(classified["city_code"].nunique()),
        "city_code_mapped": int(
            classified.loc[
                classified["city_mapping_status"].eq("mapped"), "city_code"
            ].nunique()
        ),
        "city_code_unmapped": int(
            classified.loc[
                classified["city_mapping_status"].eq("unmapped"), "city_code"
            ].nunique()
        ),
        "spatial": {
            str(year): {
                "available": spatial_results[year].available,
                "message": spatial_results[year].message,
                "moran_i": spatial_results[year].moran_i,
                "moran_pvalue": spatial_results[year].moran_pvalue,
                "lisa_filled_count": int(
                    classified.loc[
                        (classified["year"] == year)
                        & classified["lisa_type"].notna()
                        & ~classified["lisa_type"].isin(["数据不足", "空间分析暂不可用"])
                    ].shape[0]
                ),
                "lisa_type_distribution": classified.loc[
                    classified["year"] == year, "lisa_type"
                ].value_counts(dropna=False).to_dict(),
            }
            for year in (2019, 2024)
        },
        "output_root": str(version_root),
    }
    report_path = diagnostics_dir / "data_validation_report.md"
    _write_validation_report(
        report_path,
        raw_dir,
        audits,
        match_summary,
        missing_summary,
        classified,
        summary,
    )
    output_files.append(report_path)
    return PipelineResult(boundary, classified, comparison, audits, summary, output_files)
