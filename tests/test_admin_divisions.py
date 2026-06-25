"""Regression tests for authoritative city-name mapping and fallbacks."""

from __future__ import annotations

import unittest
from pathlib import Path

import pandas as pd

from src.admin_divisions import apply_city_name_mapping, load_city_reference


PROJECT_DIR = Path(__file__).resolve().parents[1]


class AdminDivisionTests(unittest.TestCase):
    """Verify reference integrity and visible-name behavior."""

    def test_reference_covers_all_current_city_codes(self) -> None:
        reference = load_city_reference(PROJECT_DIR)
        self.assertEqual(len(reference), 348)
        self.assertEqual(reference["city_code"].nunique(), 348)
        self.assertFalse(reference["city"].str.fullmatch(r"\d{4}").any())
        samples = reference.set_index("city_code")["city"].to_dict()
        self.assertEqual(samples["1301"], "石家庄市")
        self.assertEqual(samples["3101"], "上海市")
        self.assertEqual(samples["5002"], "重庆市")
        self.assertEqual(samples["8101"], "香港特别行政区")

    def test_mapping_preserves_codes_and_marks_unknown_values(self) -> None:
        reference = load_city_reference(PROJECT_DIR)
        frame = pd.DataFrame(
            {
                "city_code": ["1301", "9999"],
                "city": ["1301", "9999"],
                "province": ["河北省", "测试省"],
            }
        )
        mapped, warnings = apply_city_name_mapping(frame, reference)
        self.assertEqual(mapped.loc[0, "city"], "石家庄市")
        self.assertEqual(mapped.loc[0, "city_code"], "1301")
        self.assertEqual(mapped.loc[0, "city_mapping_status"], "mapped")
        self.assertEqual(mapped.loc[1, "city"], "测试省未识别地区")
        self.assertEqual(mapped.loc[1, "city_mapping_status"], "unmapped")
        self.assertTrue(warnings)


if __name__ == "__main__":
    unittest.main()
