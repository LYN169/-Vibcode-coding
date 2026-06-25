"""Administrative-name reference loading and auditable city-code mapping."""

from __future__ import annotations

from pathlib import Path

import pandas as pd


MCA_SOURCE_URL = "https://www.mca.gov.cn/mzsj/xzqh/2023/202301xzqh.html"
REFERENCE_FIELDS = {
    "city_code",
    "city",
    "province_code",
    "source_code",
    "mapping_type",
    "source_year",
    "source_url",
}


def load_city_reference(project_dir: str | Path) -> pd.DataFrame:
    """Load and validate the local Ministry of Civil Affairs city-name snapshot."""

    path = Path(project_dir) / "reference" / "mca_city_codes_2023.csv"
    if not path.exists():
        raise FileNotFoundError(
            f"缺少地市名称参考表：{path}。请运行 scripts/build_admin_reference.py。"
        )
    reference = pd.read_csv(
        path,
        encoding="utf-8-sig",
        dtype={
            "city_code": "string",
            "province_code": "string",
            "source_code": "string",
            "source_year": "string",
        },
        keep_default_na=True,
    )
    missing = sorted(REFERENCE_FIELDS.difference(reference.columns))
    if missing:
        raise ValueError(f"地市名称参考表缺少字段：{', '.join(missing)}")
    reference["city_code"] = reference["city_code"].astype("string").str.strip()
    reference["city"] = reference["city"].astype("string").str.strip()
    invalid_code = ~reference["city_code"].str.fullmatch(r"\d{4}", na=False)
    if invalid_code.any():
        raise ValueError(
            f"地市名称参考表包含 {int(invalid_code.sum())} 条非四位 city_code。"
        )
    duplicates = reference["city_code"].duplicated(keep=False)
    if duplicates.any():
        codes = ", ".join(sorted(reference.loc[duplicates, "city_code"].unique()))
        raise ValueError(f"地市名称参考表 city_code 重复：{codes}")
    if reference["city"].isna().any() or reference["city"].eq("").any():
        raise ValueError("地市名称参考表存在空 city 名称。")
    return reference


def apply_city_name_mapping(
    frame: pd.DataFrame,
    reference: pd.DataFrame,
    code_column: str = "city_code",
) -> tuple[pd.DataFrame, list[str]]:
    """Attach Chinese city names while preserving source values and mapping status.

    Unknown future codes are never displayed as raw four-digit labels. They receive a
    transparent province-level fallback and remain explicitly marked as unmapped.
    """

    result = frame.copy()
    result[code_column] = result[code_column].astype("string").str.strip()
    if "city" in result.columns:
        result["city_source_value"] = result["city"].astype("string")
        result = result.drop(columns="city")
    lookup = reference[
        ["city_code", "city", "mapping_type", "source_code", "source_url"]
    ].rename(
        columns={
            "city_code": code_column,
            "mapping_type": "city_mapping_type",
            "source_code": "city_name_source_code",
            "source_url": "city_name_source_url",
        }
    )
    result = result.merge(lookup, on=code_column, how="left", validate="many_to_one")
    result["city_mapping_status"] = result["city"].notna().map(
        {True: "mapped", False: "unmapped"}
    )
    warnings: list[str] = []
    unmapped = result["city"].isna()
    if unmapped.any():
        fallback = (
            result.loc[unmapped, "province"].astype("string").fillna("未知省份")
            + "未识别地区"
        )
        result.loc[unmapped, "city"] = fallback
        result.loc[unmapped, "city_mapping_type"] = "unmapped_fallback"
        codes = sorted(result.loc[unmapped, code_column].dropna().astype(str).unique())
        warnings.append(
            f"地市名称参考表未覆盖 {len(codes)} 个代码：{', '.join(codes)}；"
            "界面已使用省级未识别地区标签，原 city_code 保留。"
        )
    return result, warnings
