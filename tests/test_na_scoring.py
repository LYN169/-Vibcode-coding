"""Regression tests for row-wise NA-aware dynamic weight normalization."""

from __future__ import annotations

import unittest

import numpy as np
import pandas as pd

from src.indicator_engine import (
    calculate_weighted_score_with_na,
    classify_mismatch,
    compute_joint_scores,
)


def _missingness_fixture() -> pd.DataFrame:
    """Return six county rows spanning complete through unavailable coverage."""

    return pd.DataFrame(
        {
            "county_code": ["01", "02", "03", "04", "05", "06"],
            "year": [2019, 2019, 2019, 2024, 2024, 2024],
            "gdp": [100.0, np.nan, np.nan, np.nan, np.nan, 220.0],
            "gdp_per_capita": [20.0, 30.0, np.nan, np.nan, np.nan, 50.0],
            "gdp_density": [1.0, 1.5, np.nan, np.nan, np.nan, 2.5],
            "ntl_sum": [10.0, 20.0, 30.0, np.nan, np.nan, 60.0],
            "ntl_mean": [1.0, 2.0, 3.0, np.nan, np.nan, 6.0],
            "pop_total": [100.0, 110.0, 120.0, 130.0, np.nan, 160.0],
            "pop_density": [10.0, 11.0, 12.0, 13.0, np.nan, 16.0],
            "road_density": [0.5, 0.6, 0.7, 0.8, np.nan, 1.1],
            "highway_density": [0.05, 0.06, 0.07, 0.08, np.nan, 0.11],
        }
    )


class NaAwareScoringTests(unittest.TestCase):
    """Validate no-imputation and dynamic reweighting requirements."""

    def test_helper_renormalizes_only_valid_items(self) -> None:
        score, valid_weight, missing = calculate_weighted_score_with_na(
            pd.Series({"a": np.nan, "b": 0.4, "c": 0.8}),
            {"a": 0.25, "b": 0.25, "c": 0.50},
        )
        expected = 0.4 * 0.25 / 0.75 + 0.8 * 0.50 / 0.75
        self.assertAlmostEqual(score, expected)
        self.assertAlmostEqual(valid_weight, 0.75)
        self.assertEqual(missing, 1)

    def test_missing_gdp_is_retained_and_economic_score_is_not_zero(self) -> None:
        scored, _ = compute_joint_scores(_missingness_fixture())
        row = scored.loc[scored["county_code"] == "02"].iloc[0]
        self.assertTrue(pd.isna(row["gdp"]))
        self.assertEqual(row["missing_gdp"], 1)
        self.assertAlmostEqual(row["economic_valid_weight_sum"], 0.75)
        self.assertTrue(pd.notna(row["economic_score"]))
        self.assertNotEqual(row["economic_score"], 0.0)
        self.assertEqual(row["score_quality_flag"], "partial")

    def test_lights_only_economy_is_weak(self) -> None:
        scored, _ = compute_joint_scores(_missingness_fixture())
        row = scored.loc[scored["county_code"] == "03"].iloc[0]
        self.assertAlmostEqual(row["economic_valid_weight_sum"], 0.35)
        self.assertTrue(pd.notna(row["economic_score"]))
        self.assertEqual(row["missing_economy_count"], 3)
        self.assertEqual(row["score_quality_flag"], "weak")

    def test_all_economic_missing_still_allows_potential(self) -> None:
        scored, _ = compute_joint_scores(_missingness_fixture())
        row = scored.loc[scored["county_code"] == "04"].iloc[0]
        self.assertTrue(pd.isna(row["economic_score"]))
        self.assertAlmostEqual(row["economic_valid_weight_sum"], 0.0)
        self.assertTrue(pd.notna(row["potential_score"]))
        self.assertAlmostEqual(row["potential_valid_weight_sum"], 0.55)
        self.assertEqual(row["score_quality_flag"], "weak")

    def test_all_component_scores_missing_makes_potential_unavailable(self) -> None:
        scored, _ = compute_joint_scores(_missingness_fixture())
        row = scored.loc[scored["county_code"] == "05"].iloc[0]
        self.assertTrue(pd.isna(row["economic_score"]))
        self.assertTrue(pd.isna(row["population_score"]))
        self.assertTrue(pd.isna(row["transport_score"]))
        self.assertTrue(pd.isna(row["potential_score"]))
        self.assertEqual(row["potential_valid_weight_sum"], 0.0)
        self.assertEqual(row["score_quality_flag"], "unavailable")

    def test_mismatch_marks_missing_economic_score_as_insufficient(self) -> None:
        scored, _ = compute_joint_scores(_missingness_fixture())
        classified = classify_mismatch(scored)
        no_economy = classified.loc[classified["county_code"] == "04"].iloc[0]
        weak = classified.loc[classified["county_code"] == "03"].iloc[0]
        self.assertEqual(no_economy["mismatch_type"], "数据不足")
        self.assertEqual(no_economy["mismatch_quality"], "数据不足")
        self.assertEqual(weak["mismatch_quality"], "低可信")


if __name__ == "__main__":
    unittest.main()

