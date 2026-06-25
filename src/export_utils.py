"""Download serialization helpers for tabular and geospatial results."""

from __future__ import annotations

import geopandas as gpd
import pandas as pd


def dataframe_to_csv_bytes(frame: pd.DataFrame) -> bytes:
    """Serialize a DataFrame as Excel-friendly UTF-8 CSV."""

    tabular = frame.drop(columns="geometry", errors="ignore")
    return tabular.to_csv(index=False).encode("utf-8-sig")


def geodataframe_to_geojson_bytes(frame: gpd.GeoDataFrame) -> bytes:
    """Serialize a GeoDataFrame as UTF-8 GeoJSON in WGS84 coordinates."""

    geo = frame.copy()
    if geo.crs is not None and str(geo.crs).upper() != "EPSG:4326":
        geo = geo.to_crs("EPSG:4326")
    return geo.to_json(drop_id=True, na="null").encode("utf-8")

