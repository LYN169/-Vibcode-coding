"""Joint-scale NA-aware indicators, mismatch diagnostics, and comparison."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

import numpy as np
import pandas as pd


DEFAULT_WEIGHTS: dict[str, dict[str, float]] = {
    "economic": {
        "gdp": 0.25,
        "gdp_per_capita": 0.20,
        "gdp_density": 0.20,
        "ntl_sum": 0.20,
        "ntl_mean": 0.15,
    },
    "population": {"pop_total": 0.50, "pop_density": 0.50},
    "transport": {"road_density": 0.60, "highway_density": 0.40},
    "potential": {
        "economic_score": 0.45,
        "population_score": 0.25,
        "transport_score": 0.30,
    },
}

ECONOMIC_FIELDS = list(DEFAULT_WEIGHTS["economic"])
POPULATION_FIELDS = list(DEFAULT_WEIGHTS["population"])
TRANSPORT_FIELDS = list(DEFAULT_WEIGHTS["transport"])
RAW_INDICATOR_FIELDS = ECONOMIC_FIELDS + POPULATION_FIELDS + TRANSPORT_FIELDS


@dataclass
class WeightResult:
    """Normalized configured weights and user-facing normalization warnings."""

    weights: dict[str, dict[str, float]]
    warnings: list[str]


def normalize_weights(
    weights: Mapping[str, Mapping[str, float]] | None = None,
) -> WeightResult:
    """Normalize every configured group; all-zero groups use documented defaults."""

    supplied = weights or DEFAULT_WEIGHTS
    normalized: dict[str, dict[str, float]] = {}
    warnings: list[str] = []
    for group, defaults in DEFAULT_WEIGHTS.items():
        raw_group = supplied.get(group, defaults)
        values = {name: max(float(raw_group.get(name, 0.0)), 0.0) for name in defaults}
        total = sum(values.values())
        if total <= 0:
            values = defaults.copy()
            total = sum(values.values())
            warnings.append(f"{group} 权重之和为 0，已回退默认权重。")
        elif not np.isclose(total, 1.0):
            warnings.append(f"{group} 权重已从合计 {total:.3f} 自动归一化。")
        normalized[group] = {name: value / total for name, value in values.items()}
    return WeightResult(weights=normalized, warnings=warnings)


def minmax_series(series: pd.Series) -> pd.Series:
    """Normalize one indicator across both years while preserving NA.

    All-missing and constant indicators return NA. A constant field contains no
    cross-county information, so it does not participate in dynamic weighting.
    """

    numeric = pd.to_numeric(series, errors="coerce")
    minimum = numeric.min(skipna=True)
    maximum = numeric.max(skipna=True)
    if pd.isna(minimum) or pd.isna(maximum) or np.isclose(maximum, minimum):
        return pd.Series(np.nan, index=series.index, dtype=float)
    return (numeric - minimum) / (maximum - minimum)


def calculate_weighted_score_with_na(
    row: pd.Series,
    indicator_weights: Mapping[str, float],
) -> tuple[float, float, int]:
    """Return an NA-aware score, valid original-weight sum, and missing count.

    Only non-missing indicators with positive weights participate. Their configured
    weights are divided by the valid weight sum. No available weighted input yields
    an NA score; raw or normalized missing values are never replaced with zero.
    """

    weighted_sum = 0.0
    valid_weight_sum = 0.0
    missing_count = 0
    for indicator, weight in indicator_weights.items():
        value = pd.to_numeric(row.get(indicator, np.nan), errors="coerce")
        if pd.isna(value):
            missing_count += 1
            continue
        numeric_weight = max(float(weight), 0.0)
        if numeric_weight <= 0:
            continue
        weighted_sum += float(value) * numeric_weight
        valid_weight_sum += numeric_weight
    if valid_weight_sum <= 0:
        return np.nan, 0.0, missing_count
    return weighted_sum / valid_weight_sum, valid_weight_sum, missing_count


def _add_dynamic_score(
    frame: pd.DataFrame,
    indicator_weights: Mapping[str, float],
    score_column: str,
    valid_weight_column: str,
) -> pd.DataFrame:
    """Add one row-wise dynamically normalized score and its weight coverage."""

    result = frame.copy()
    calculations = [
        calculate_weighted_score_with_na(row, indicator_weights)
        for _, row in result.iterrows()
    ]
    result[score_column] = pd.Series(
        [item[0] for item in calculations], index=result.index, dtype=float
    )
    result[valid_weight_column] = pd.Series(
        [item[1] for item in calculations], index=result.index, dtype=float
    )
    return result


def _score_quality_flag(row: pd.Series) -> str:
    """Assign complete, partial, weak, or unavailable from observable coverage."""

    if pd.isna(row.get("potential_score")):
        return "unavailable"
    weight_fields = [
        "economic_valid_weight_sum",
        "population_valid_weight_sum",
        "transport_valid_weight_sum",
        "potential_valid_weight_sum",
    ]
    weight_values: list[float] = []
    for field in weight_fields:
        value = row.get(field, 0.0)
        weight_values.append(0.0 if pd.isna(value) else float(value))

    complete = int(row.get("missing_total_count", 0)) == 0 and all(
        np.isclose(value, 1.0) for value in weight_values
    )
    if complete:
        return "complete"

    low_positive_coverage = any(
        0 < value < 0.5 and not np.isclose(value, 0.5) for value in weight_values
    )
    if int(row.get("missing_total_count", 0)) >= 3 or low_positive_coverage:
        return "weak"
    return "partial"


def compute_joint_scores(
    frame: pd.DataFrame,
    weights: Mapping[str, Mapping[str, float]] | None = None,
) -> tuple[pd.DataFrame, list[str]]:
    """Compute all county-year scores on one joint scale before region filtering."""

    result = frame.copy()
    weight_result = normalize_weights(weights)
    missing_fields = [name for name in RAW_INDICATOR_FIELDS if name not in result.columns]
    if missing_fields:
        for name in missing_fields:
            result[name] = np.nan
        weight_result.warnings.append(
            f"指标计算缺少字段：{', '.join(missing_fields)}；相关原始值保持为 NA。"
        )

    # Invalid numeric text becomes NA once; no later stage fills missing values.
    for field in RAW_INDICATOR_FIELDS:
        result[field] = pd.to_numeric(result[field], errors="coerce")

    result["missing_gdp"] = result["gdp"].isna().astype("int8")
    result["missing_economy_count"] = (
        result[ECONOMIC_FIELDS].isna().sum(axis=1).astype("int8")
    )
    result["missing_total_count"] = (
        result[RAW_INDICATOR_FIELDS].isna().sum(axis=1).astype("int8")
    )

    for field in RAW_INDICATOR_FIELDS:
        valid_count = int(result[field].notna().sum())
        unique_count = int(result[field].nunique(dropna=True))
        if valid_count == 0:
            weight_result.warnings.append(
                f"指标 {field} 全为空，联合标准化结果保持为 NA。"
            )
        elif unique_count == 1:
            weight_result.warnings.append(
                f"指标 {field} 最大值等于最小值，标准化结果设为 NA，不参与动态权重。"
            )
        result[f"{field}_norm"] = minmax_series(result[field])

    economic_inputs = {
        f"{name}_norm": weight
        for name, weight in weight_result.weights["economic"].items()
    }
    population_inputs = {
        f"{name}_norm": weight
        for name, weight in weight_result.weights["population"].items()
    }
    transport_inputs = {
        f"{name}_norm": weight
        for name, weight in weight_result.weights["transport"].items()
    }
    result = _add_dynamic_score(
        result, economic_inputs, "economic_score", "economic_valid_weight_sum"
    )
    result = _add_dynamic_score(
        result, population_inputs, "population_score", "population_valid_weight_sum"
    )
    result = _add_dynamic_score(
        result, transport_inputs, "transport_score", "transport_valid_weight_sum"
    )
    result = _add_dynamic_score(
        result,
        weight_result.weights["potential"],
        "potential_score",
        "potential_valid_weight_sum",
    )
    result = _add_dynamic_score(
        result,
        {"population_score": 0.45, "transport_score": 0.55},
        "support_score",
        "support_valid_weight_sum",
    )
    result["score_quality_flag"] = result.apply(_score_quality_flag, axis=1)
    return result, weight_result.warnings


def classify_mismatch(frame: pd.DataFrame) -> pd.DataFrame:
    """Classify valid scores and preserve data-insufficient counties."""

    result = _add_dynamic_score(
        frame,
        {"population_score": 0.45, "transport_score": 0.55},
        "support_score",
        "support_valid_weight_sum",
    )
    economic_median = result["economic_score"].median(skipna=True)
    support_median = result["support_score"].median(skipna=True)
    valid = (
        result["economic_score"].notna()
        & result["support_score"].notna()
        & pd.notna(economic_median)
        & pd.notna(support_median)
    )
    high_economic = result["economic_score"] >= economic_median
    high_support = result["support_score"] >= support_median
    conditions = [
        valid & high_economic & high_support,
        valid & ~high_economic & high_support,
        valid & high_economic & ~high_support,
        valid & ~high_economic & ~high_support,
    ]
    choices = ["稳定增长区", "潜力释放区", "承载压力区", "收缩风险区"]
    result["mismatch_type"] = np.select(conditions, choices, default="数据不足")
    result["mismatch_quality"] = np.select(
        [
            result["mismatch_type"].eq("数据不足"),
            result["score_quality_flag"].eq("weak"),
        ],
        ["数据不足", "低可信"],
        default="正常",
    )
    return result


def safe_growth_rate(new: pd.Series, old: pd.Series) -> pd.Series:
    """Return (new-old)/old and leave zero or missing denominators as NA."""

    old_numeric = pd.to_numeric(old, errors="coerce")
    new_numeric = pd.to_numeric(new, errors="coerce")
    valid = old_numeric.notna() & new_numeric.notna() & ~np.isclose(old_numeric, 0)
    result = pd.Series(np.nan, index=old.index, dtype=float)
    result.loc[valid] = (
        new_numeric.loc[valid] - old_numeric.loc[valid]
    ) / old_numeric.loc[valid]
    return result


def build_comparison(frame: pd.DataFrame) -> pd.DataFrame:
    """Align county records and calculate requested 2019—2024 changes and rates."""

    metrics = [
        "ntl_sum",
        "pop_total",
        "road_density",
        "gdp",
        "economic_score",
        "potential_score",
    ]
    identity = ["county_code", "province", "city", "county"]
    available_identity = [column for column in identity if column in frame.columns]
    subset = frame[available_identity + ["year"] + metrics].copy()
    old = subset.loc[subset["year"] == 2019].drop(columns="year")
    new = subset.loc[subset["year"] == 2024].drop(columns="year")
    comparison = old.merge(
        new,
        on="county_code",
        how="outer",
        suffixes=("_2019", "_2024"),
        validate="one_to_one",
    )
    for label in ("province", "city", "county"):
        left = f"{label}_2019"
        right = f"{label}_2024"
        if left in comparison.columns and right in comparison.columns:
            comparison[label] = comparison[right].combine_first(comparison[left])

    for metric in metrics:
        comparison[f"{metric}_change"] = (
            comparison[f"{metric}_2024"] - comparison[f"{metric}_2019"]
        )
    for metric in ("ntl_sum", "pop_total", "gdp", "potential_score"):
        comparison[f"{metric}_growth_rate"] = safe_growth_rate(
            comparison[f"{metric}_2024"], comparison[f"{metric}_2019"]
        )
    return comparison
