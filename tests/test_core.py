"""Core regression tests for scoring, comparison, and documented fallbacks."""

from __future__ import annotations

import shutil
import unittest
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

import pandas as pd

from src.data_loader import load_data_bundle
from src.indicator_engine import build_comparison, compute_joint_scores, minmax_series


PROJECT_DIR = Path(__file__).resolve().parents[1]


@contextmanager
def writable_test_project():
    """Create a test project under the managed writable workspace.

    Windows' system temporary directory can be read-only in the desktop sandbox,
    so regression fixtures use an explicit workspace location.
    """

    root = PROJECT_DIR.parent / "work" / "test_sandboxes" / uuid4().hex
    root.mkdir(parents=True)
    try:
        yield root
    finally:
        shutil.rmtree(root, ignore_errors=True)


def load_isolated_sample_bundle():
    """Load bundled sample data without the project's real-data configuration."""

    with writable_test_project() as project:
        shutil.copytree(PROJECT_DIR / "sample", project / "sample")
        (project / "data").mkdir()
        return load_data_bundle(project)


class CorePipelineTests(unittest.TestCase):
    """Validate the data-to-score closed loop using deterministic sample data."""

    def test_sample_pipeline_preserves_leading_zero_codes(self) -> None:
        bundle = load_isolated_sample_bundle()
        self.assertTrue(bundle.ready)
        self.assertEqual(bundle.source_mode, "内置 sample 示例数据")
        self.assertTrue(bundle.combined["county_code"].str.startswith("0").all())

    def test_joint_scale_spans_both_years_once(self) -> None:
        bundle = load_isolated_sample_bundle()
        scored, _ = compute_joint_scores(bundle.combined)
        self.assertAlmostEqual(float(scored["gdp_norm"].min()), 0.0)
        self.assertAlmostEqual(float(scored["gdp_norm"].max()), 1.0)
        max_year = int(scored.loc[scored["gdp_norm"].idxmax(), "year"])
        self.assertEqual(max_year, 2024)

    def test_constant_minmax_and_growth_rates_are_safe(self) -> None:
        normalized = minmax_series(pd.Series([5.0, 5.0, None]))
        self.assertTrue(normalized.isna().all())
        self.assertTrue(pd.isna(normalized.iloc[2]))
        bundle = load_isolated_sample_bundle()
        scored, _ = compute_joint_scores(bundle.combined)
        comparison = build_comparison(scored)
        self.assertIn("potential_score_growth_rate", comparison.columns)
        self.assertEqual(len(comparison), 12)

    def test_road_and_economy_fallbacks_preserve_real_years(self) -> None:
        with writable_test_project() as project:
            data = project / "data"
            data.mkdir()
            for source in (PROJECT_DIR / "sample").glob("*.csv"):
                if source.name not in {"road_2019.csv", "economy_2024.csv"}:
                    shutil.copy2(source, data / source.name)
            shutil.copy2(
                PROJECT_DIR / "sample" / "county_boundary.geojson",
                data / "county_boundary.geojson",
            )
            economy_2023 = pd.read_csv(
                PROJECT_DIR / "sample" / "economy_2024.csv",
                dtype={"county_code": "string"},
            )
            economy_2023["year"] = 2023
            economy_2023.to_csv(data / "economy_2023.csv", index=False)

            bundle = load_data_bundle(project)
            self.assertTrue(bundle.ready)
            self.assertTrue(bundle.road_proxy_used)
            self.assertTrue(bundle.economy_proxy_used)
            rows_2019 = bundle.combined.loc[bundle.combined["year"] == 2019]
            rows_2024 = bundle.combined.loc[bundle.combined["year"] == 2024]
            self.assertTrue((rows_2019["road_year_display"] == 2024).all())
            self.assertTrue((rows_2024["year_display"] == 2023).all())

    def test_missing_economy_row_keeps_county_and_na(self) -> None:
        with writable_test_project() as project:
            data = project / "data"
            data.mkdir()
            for source in (PROJECT_DIR / "sample").glob("*.csv"):
                shutil.copy2(source, data / source.name)
            shutil.copy2(
                PROJECT_DIR / "sample" / "county_boundary.geojson",
                data / "county_boundary.geojson",
            )
            economy_path = data / "economy_2024.csv"
            economy = pd.read_csv(economy_path, dtype={"county_code": "string"})
            missing_code = economy.iloc[0]["county_code"]
            economy.iloc[1:].to_csv(economy_path, index=False)

            bundle = load_data_bundle(project)
            rows_2024 = bundle.combined.loc[bundle.combined["year"] == 2024]
            self.assertEqual(len(rows_2024), len(bundle.boundary))
            missing_row = rows_2024.loc[rows_2024["county_code"] == missing_code].iloc[0]
            self.assertTrue(pd.isna(missing_row["gdp"]))
            scored, _ = compute_joint_scores(bundle.combined)
            scored_row = scored.loc[
                (scored["county_code"] == missing_code) & (scored["year"] == 2024)
            ].iloc[0]
            self.assertEqual(scored_row["missing_gdp"], 1)
            self.assertTrue(pd.notna(scored_row["economic_score"]))


if __name__ == "__main__":
    unittest.main()
