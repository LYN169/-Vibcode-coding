"""Regression tests for generated real-data outputs and default app loading."""

from __future__ import annotations

import unittest
import json
from pathlib import Path

import pandas as pd

from src.data_loader import load_data_bundle
from src.indicator_engine import compute_joint_scores


PROJECT_DIR = Path(__file__).resolve().parents[1]


class RealDataIntegrationTests(unittest.TestCase):
    """Validate the processed national two-period dataset."""

    def test_processed_master_schema_and_counts(self) -> None:
        config = json.loads(
            (PROJECT_DIR / "config" / "data_sources.json").read_text(encoding="utf-8")
        )
        output_root = PROJECT_DIR / config["active_output_root"]
        path = output_root / "county_indicators_long.csv"
        self.assertTrue(path.exists())
        frame = pd.read_csv(path, dtype={"county_code": "string"})
        self.assertEqual(len(frame), 5782)
        self.assertTrue(frame["county_code"].str.fullmatch(r"\d{6}").all())
        self.assertEqual(frame.groupby("year")["county_code"].nunique().to_dict(), {2019: 2891, 2024: 2891})
        self.assertEqual(frame.groupby("year")["gdp"].apply(lambda value: int(value.isna().sum())).to_dict(), {2019: 971, 2024: 972})
        self.assertEqual(frame.groupby("year")["potential_score"].apply(lambda value: int(value.notna().sum())).to_dict(), {2019: 2891, 2024: 2891})
        self.assertEqual(int(frame.duplicated(["county_code", "year"]).sum()), 0)
        self.assertEqual(int(frame["lisa_type"].notna().sum()), 5782)
        self.assertEqual(frame["city_code"].nunique(), 348)
        self.assertFalse(frame["city"].astype("string").str.fullmatch(r"\d{4}").any())
        self.assertTrue(frame["city_mapping_status"].eq("mapped").all())

    def test_default_loader_uses_processed_real_data(self) -> None:
        bundle = load_data_bundle(PROJECT_DIR)
        self.assertTrue(bundle.ready)
        self.assertEqual(len(bundle.combined), 5782)
        self.assertTrue(bundle.road_static_used)
        self.assertFalse(bundle.errors)
        self.assertIn("真实数据", bundle.source_mode)
        scored, _ = compute_joint_scores(bundle.combined)
        self.assertEqual(int(scored["missing_gdp"].sum()), 1943)
        self.assertEqual(int(scored["potential_score"].notna().sum()), 5782)


if __name__ == "__main__":
    unittest.main()
