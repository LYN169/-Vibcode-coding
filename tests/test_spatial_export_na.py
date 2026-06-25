"""NA behavior tests for spatial analysis and CSV export."""

from __future__ import annotations

import unittest

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import box

from src.export_utils import dataframe_to_csv_bytes
from src.spatial_analysis import run_spatial_analysis


class SpatialAndExportNaTests(unittest.TestCase):
    """Ensure NA counties remain visible and serialized as missing."""

    def test_spatial_analysis_uses_non_na_sample_and_merges_back(self) -> None:
        frame = gpd.GeoDataFrame(
            {
                "county_code": [f"{index:02d}" for index in range(12)],
                "potential_score": [np.nan, np.nan, np.nan, *range(9)],
            },
            geometry=[box(index, 0, index + 1, 1) for index in range(12)],
            crs="EPSG:4326",
        )
        result = run_spatial_analysis(frame, "potential_score", permutations=9)
        self.assertFalse(result.available)
        self.assertIn("有效样本不足", result.message)
        self.assertEqual(len(result.frame), 12)
        self.assertTrue((result.frame.iloc[:3]["lisa_type"] == "数据不足").all())
        self.assertTrue(
            (result.frame.iloc[3:]["lisa_type"] == "空间分析暂不可用").all()
        )

    def test_successful_lisa_merges_valid_results_and_marks_na(self) -> None:
        try:
            import esda  # noqa: F401
            import libpysal  # noqa: F401
        except ImportError:
            self.skipTest("Optional PySAL packages are not installed")
        frame = gpd.GeoDataFrame(
            {
                "county_code": [f"{index:02d}" for index in range(12)],
                "potential_score": [np.nan, *range(1, 12)],
            },
            geometry=[box(index, 0, index + 1, 1) for index in range(12)],
            crs="EPSG:4326",
        )
        result = run_spatial_analysis(frame, "potential_score", permutations=9)
        self.assertTrue(result.available, result.message)
        self.assertEqual(len(result.frame), 12)
        self.assertEqual(result.frame.iloc[0]["lisa_type"], "数据不足")
        self.assertTrue(result.frame.iloc[1:]["lisa_pvalue"].notna().all())

    def test_csv_export_keeps_na_as_empty_value(self) -> None:
        source = pd.DataFrame(
            {"county_code": ["01", "02"], "gdp": [np.nan, 100.0], "missing_gdp": [1, 0]}
        )
        payload = dataframe_to_csv_bytes(source)
        restored = pd.read_csv(pd.io.common.BytesIO(payload), dtype={"county_code": "string"})
        self.assertTrue(pd.isna(restored.loc[0, "gdp"]))
        self.assertNotEqual(restored.loc[0, "gdp"], 0)
        self.assertEqual(restored.loc[0, "missing_gdp"], 1)


if __name__ == "__main__":
    unittest.main()
