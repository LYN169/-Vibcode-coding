"""Generate deterministic fictional county data for the V1.0 demonstration."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


SAMPLE_DIR = Path(__file__).resolve().parent


COUNTIES = [
    ("010101", "北澜省", "临河市", "新川区", 0, 2, 520),
    ("010102", "北澜省", "临河市", "长桥县", 1, 2, 610),
    ("010201", "北澜省", "沧岭市", "青石县", 2, 2, 740),
    ("010202", "北澜省", "沧岭市", "望城区", 3, 2, 480),
    ("020101", "中岳省", "青原市", "丰谷县", 0, 1, 820),
    ("020102", "中岳省", "青原市", "东浦县", 1, 1, 560),
    ("020201", "中岳省", "星港市", "星海区", 2, 1, 450),
    ("020202", "中岳省", "星港市", "岑山县", 3, 1, 900),
    ("030101", "南川省", "云泽市", "云溪县", 0, 0, 680),
    ("030102", "南川省", "云泽市", "白鹭县", 1, 0, 760),
    ("030201", "南川省", "岚江市", "岚江区", 2, 0, 500),
    ("030202", "南川省", "岚江市", "松林县", 3, 0, 880),
]

GDP_2019 = [80, 120, 65, 180, 55, 95, 210, 70, 130, 45, 160, 100]
GDP_GROWTH = [1.25, 1.35, 1.10, 1.18, 1.50, 1.22, 1.15, 1.48, 1.12, 1.42, 1.20, 1.08]
POP_2019 = [320000, 600000, 280000, 720000, 350000, 420000, 850000, 260000, 520000, 210000, 680000, 300000]
POP_GROWTH = [1.03, 1.08, 0.96, 1.02, 1.12, 1.04, 1.06, 0.94, 1.00, 1.09, 1.01, 0.92]
ROAD_DENSITY_2019 = [0.72, 1.05, 0.58, 1.28, 0.92, 1.15, 1.62, 0.50, 1.20, 0.80, 1.48, 0.55]
ROAD_GROWTH = [1.15, 1.22, 1.18, 1.10, 1.35, 1.20, 1.08, 1.42, 1.12, 1.30, 1.10, 1.25]
NTL_2019 = [420, 780, 300, 1260, 270, 610, 1800, 320, 920, 190, 1180, 460]
NTL_GROWTH = [1.32, 1.46, 1.14, 1.24, 1.72, 1.35, 1.20, 1.65, 1.18, 1.55, 1.25, 1.12]


def _write_csv(name: str, rows: list[dict[str, object]]) -> None:
    """Write one sample table while retaining string county codes."""

    pd.DataFrame(rows).to_csv(SAMPLE_DIR / name, index=False, encoding="utf-8-sig")


def generate() -> None:
    """Generate the boundary GeoJSON and all required two-period CSV files."""

    features = []
    for code, province, city, county, col, row, area in COUNTIES:
        # Integer grid edges ensure exact shared vertices for Queen contiguity tests.
        x0 = 110.0 + col
        y0 = 29.0 + row
        polygon = [[
            [x0, y0],
            [x0 + 1.0, y0],
            [x0 + 1.0, y0 + 1.0],
            [x0, y0 + 1.0],
            [x0, y0],
        ]]
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "county_code": code,
                    "province": province,
                    "city": city,
                    "county": county,
                    "area_km2": area,
                },
                "geometry": {"type": "Polygon", "coordinates": polygon},
            }
        )
    payload = {"type": "FeatureCollection", "features": features}
    (SAMPLE_DIR / "county_boundary.geojson").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    for year in (2019, 2024):
        nightlight_rows: list[dict[str, object]] = []
        population_rows: list[dict[str, object]] = []
        road_rows: list[dict[str, object]] = []
        economy_rows: list[dict[str, object]] = []
        for index, (code, _province, _city, _county, _col, _row, area) in enumerate(COUNTIES):
            if year == 2019:
                gdp = GDP_2019[index]
                population = POP_2019[index]
                road_density = ROAD_DENSITY_2019[index]
                ntl_sum = NTL_2019[index]
            else:
                gdp = GDP_2019[index] * GDP_GROWTH[index]
                population = round(POP_2019[index] * POP_GROWTH[index])
                road_density = ROAD_DENSITY_2019[index] * ROAD_GROWTH[index]
                ntl_sum = NTL_2019[index] * NTL_GROWTH[index]

            ntl_mean = ntl_sum / area
            pop_density = population / area
            highway_density = road_density * (0.16 + (index % 4) * 0.035)
            nightlight_values: dict[str, object] = {
                "ntl_mean": round(ntl_mean, 4),
                "ntl_sum": round(ntl_sum, 2),
                "ntl_max": round(ntl_mean * 3.4, 4),
                "ntl_median": round(ntl_mean * 0.76, 4),
            }
            economy_values: dict[str, object] = {
                "gdp": round(gdp, 2),
                "gdp_per_capita": round(gdp * 100_000_000 / population, 2),
                "gdp_density": round(gdp / area, 4),
            }
            if year == 2024 and index == 2:
                # Partial case: GDP absent, derived statistical indicators retained.
                economy_values["gdp"] = None
            elif year == 2024 and index == 7:
                # Weak case: three economic statistics absent, lights retained.
                economy_values = {name: None for name in economy_values}
            elif year == 2024 and index == 11:
                # Unavailable economic sub-score: statistics and light inputs absent.
                economy_values = {name: None for name in economy_values}
                nightlight_values = {name: None for name in nightlight_values}
            nightlight_rows.append(
                {
                    "county_code": code,
                    "year": year,
                    **nightlight_values,
                }
            )
            population_rows.append(
                {
                    "county_code": code,
                    "year": year,
                    "pop_total": population,
                    "pop_density": round(pop_density, 4),
                }
            )
            road_rows.append(
                {
                    "county_code": code,
                    "year": year,
                    "road_length_km": round(road_density * area, 2),
                    "road_density": round(road_density, 4),
                    "highway_density": round(highway_density, 4),
                }
            )
            economy_rows.append(
                {
                    "county_code": code,
                    "year": year,
                    **economy_values,
                }
            )

        _write_csv(f"nightlight_{year}.csv", nightlight_rows)
        _write_csv(f"population_{year}.csv", population_rows)
        _write_csv(f"road_{year}.csv", road_rows)
        _write_csv(f"economy_{year}.csv", economy_rows)


if __name__ == "__main__":
    generate()
