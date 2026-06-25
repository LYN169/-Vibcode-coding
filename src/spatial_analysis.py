"""Optional PySAL autocorrelation with NA-aware sample selection."""

from __future__ import annotations

from dataclasses import dataclass

import geopandas as gpd
import numpy as np
import pandas as pd


MIN_SPATIAL_SAMPLE = 10


@dataclass
class SpatialResult:
    """Spatial analysis outputs and availability metadata."""

    frame: gpd.GeoDataFrame
    available: bool
    message: str
    moran_i: float | None = None
    moran_pvalue: float | None = None


def _blank_columns(
    frame: gpd.GeoDataFrame,
    value_column: str | None = None,
) -> gpd.GeoDataFrame:
    """Add unavailable LISA fields while marking NA target counties separately."""

    result = frame.copy()
    result["lisa_cluster"] = "NA"
    result["lisa_pvalue"] = np.nan
    result["lisa_type"] = "空间分析暂不可用"
    if value_column and value_column in result.columns:
        target = pd.to_numeric(result[value_column], errors="coerce")
        result.loc[target.isna(), "lisa_type"] = "数据不足"
    return result


def run_spatial_analysis(
    frame: gpd.GeoDataFrame,
    value_column: str = "potential_score",
    permutations: int = 999,
    seed: int = 42,
) -> SpatialResult:
    """Run Moran's I and LISA on non-NA targets when at least ten counties exist."""

    if value_column not in frame.columns:
        return SpatialResult(
            _blank_columns(frame, value_column),
            False,
            f"空间分析暂不可用：缺少字段 {value_column}。",
        )

    target = pd.to_numeric(frame[value_column], errors="coerce")
    valid_mask = frame.geometry.notna() & target.notna()
    valid = (
        frame.loc[valid_mask]
        .copy()
        .reset_index()
        .rename(columns={"index": "_source_index"})
    )
    if len(valid) < MIN_SPATIAL_SAMPLE:
        return SpatialResult(
            _blank_columns(frame, value_column),
            False,
            f"有效样本不足，空间分析暂不可用（至少需要 {MIN_SPATIAL_SAMPLE} 个县域，当前 {len(valid)} 个）。",
        )

    values = pd.to_numeric(valid[value_column], errors="coerce").to_numpy(dtype=float)
    if np.isclose(np.nanstd(values), 0):
        return SpatialResult(
            _blank_columns(frame, value_column),
            False,
            "空间分析暂不可用：有效指标没有空间差异。",
        )

    try:
        from esda.moran import Moran, Moran_Local
        from libpysal.weights import KNN, Queen

        weight = Queen.from_dataframe(valid, use_index=False)
        if weight.islands:
            k = min(4, len(valid) - 1)
            weight = KNN.from_dataframe(valid, k=k)
        weight.transform = "R"
        # Global Moran uses NumPy's random state; fixing it keeps validation reruns
        # reproducible. Moran_Local accepts its own seed explicitly.
        np.random.seed(seed)
        moran = Moran(values, weight, permutations=permutations)
        lisa = Moran_Local(
            values,
            weight,
            permutations=permutations,
            seed=seed,
        )

        significant = lisa.p_sim < 0.05
        code_map = {1: "HH", 2: "LH", 3: "LL", 4: "HL"}
        name_map = {
            "HH": "高高集聚 HH",
            "LL": "低低集聚 LL",
            "HL": "高低异常 HL",
            "LH": "低高异常 LH",
        }
        cluster = np.array(
            [code_map.get(int(code), "NA") for code in lisa.q], dtype=object
        )
        cluster[~significant] = "Not Significant"
        lisa_type = np.array(
            [name_map.get(code, "不显著 Not Significant") for code in cluster],
            dtype=object,
        )

        result = frame.copy()
        result["lisa_cluster"] = "NA"
        result["lisa_pvalue"] = np.nan
        result["lisa_type"] = "数据不足"
        source_indices = valid["_source_index"].to_numpy()
        result.loc[source_indices, "lisa_cluster"] = cluster
        result.loc[source_indices, "lisa_pvalue"] = lisa.p_sim
        result.loc[source_indices, "lisa_type"] = lisa_type
        return SpatialResult(
            frame=result,
            available=True,
            message=f"空间分析已完成，有效样本 {len(valid)} 个。",
            moran_i=float(moran.I),
            moran_pvalue=float(moran.p_sim),
        )
    except Exception as exc:  # PySAL remains optional and isolated from the app.
        return SpatialResult(
            _blank_columns(frame, value_column),
            False,
            f"空间分析暂不可用：{exc}",
        )
