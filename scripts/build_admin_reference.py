"""Build an offline city-name snapshot from the MCA 2023 division-code page."""

from __future__ import annotations

import json
import sys
from io import StringIO
from pathlib import Path
from urllib.request import Request, urlopen

import pandas as pd


PROJECT_DIR = Path(__file__).resolve().parents[1]
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

from src.admin_divisions import MCA_SOURCE_URL  # noqa: E402
from src.real_data_pipeline import normalize_county_code, read_csv_flexible  # noqa: E402


SPECIAL_LABELS: dict[str, tuple[str, str]] = {
    "4190": ("河南省直辖县级行政区划", "province_direct"),
    "4290": ("湖北省直辖县级行政区划", "province_direct"),
    "4690": ("海南省直辖县级行政区划", "province_direct"),
    "6590": ("新疆维吾尔自治区直辖县级行政区划", "province_direct"),
    "7100": ("台湾省", "special_region"),
    "8101": ("香港特别行政区", "special_region"),
    "8200": ("澳门特别行政区", "special_region"),
    "6297": ("甘肃省特殊区域", "special_region"),
    "6298": ("甘肃省特殊区域", "special_region"),
    "6299": ("甘肃省特殊区域", "special_region"),
}


def _download_official_table() -> pd.DataFrame:
    """Download and parse the official Excel-style HTML table."""

    request = Request(MCA_SOURCE_URL, headers={"User-Agent": "Mozilla/5.0"})
    payload = urlopen(request, timeout=90).read().decode("utf-8")
    table = pd.read_html(StringIO(payload))[0]
    official = pd.DataFrame(
        {
            "source_code": table.iloc[:, 1].astype("string").str.strip(),
            "city": table.iloc[:, 2].astype("string").str.strip(),
        }
    )
    return official.loc[
        official["source_code"].str.fullmatch(r"\d{6}", na=False)
    ].copy()


def _current_road_codes() -> tuple[pd.DataFrame, Path]:
    """Read current source codes only to verify snapshot coverage."""

    config = json.loads(
        (PROJECT_DIR / "config" / "data_sources.json").read_text(encoding="utf-8")
    )
    raw_dir = Path(config["raw_data_dir"])
    road_path = raw_dir / "road_2019&2024.csv"
    road, _, _ = read_csv_flexible(road_path)
    road["county_code"] = normalize_county_code(road["county_code"])
    road = road.loc[road["county_code"].notna()].copy()
    road["city_code"] = road["county_code"].str[:4]
    road["province_code"] = road["county_code"].str[:2]
    return road, road_path


def build_reference() -> pd.DataFrame:
    """Create a unique, source-annotated city mapping covering current data."""

    official = _download_official_table()
    prefectures = official.loc[
        official["source_code"].str.endswith("00")
        & ~official["source_code"].str.endswith("0000")
    ].copy()
    prefectures["city_code"] = prefectures["source_code"].str[:4]
    prefectures["province_code"] = prefectures["source_code"].str[:2]
    prefectures["mapping_type"] = "official_prefecture"

    provinces = official.loc[official["source_code"].str.endswith("0000")].copy()
    province_names = dict(zip(provinces["source_code"].str[:2], provinces["city"]))
    road, _ = _current_road_codes()
    records = prefectures[
        ["city_code", "city", "province_code", "source_code", "mapping_type"]
    ].to_dict("records")

    for code in sorted(road["city_code"].dropna().unique()):
        province_code = code[:2]
        if province_code in {"11", "12", "31", "50"}:
            records.append(
                {
                    "city_code": code,
                    "city": province_names[province_code],
                    "province_code": province_code,
                    "source_code": f"{province_code}0000",
                    "mapping_type": "municipality",
                }
            )
        elif code in SPECIAL_LABELS:
            label, mapping_type = SPECIAL_LABELS[code]
            records.append(
                {
                    "city_code": code,
                    "city": label,
                    "province_code": province_code,
                    "source_code": f"{province_code}0000",
                    "mapping_type": mapping_type,
                }
            )

    reference = pd.DataFrame(records).drop_duplicates("city_code", keep="last")
    reference["source_year"] = "2023"
    reference["source_url"] = MCA_SOURCE_URL
    reference = reference.sort_values("city_code").reset_index(drop=True)
    needed = set(road["city_code"].dropna())
    missing = sorted(needed.difference(reference["city_code"]))
    if missing:
        raise ValueError(f"仍有未覆盖地市代码：{', '.join(missing)}")
    return reference


if __name__ == "__main__":
    output = PROJECT_DIR / "reference" / "mca_city_codes_2023.csv"
    output.parent.mkdir(parents=True, exist_ok=True)
    reference = build_reference()
    reference.to_csv(output, index=False, encoding="utf-8-sig")
    print(f"WROTE={output}")
    print(f"ROWS={len(reference)}")
    print(f"CURRENT_COVERAGE={len(reference)} city-code records available")
