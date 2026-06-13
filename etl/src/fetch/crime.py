"""Crime incidents from the Czech Police public crime map.

Source: kriminalita.policie.gov.cz open data API — monthly GeoJSON dumps
of registered incidents (crimes and offenses) with point coordinates.
Joint project of the Ministry of Interior and Police ČR, public since 2020.
"""
import gzip
import json

import requests

API_BASE = "https://kriminalita.policie.gov.cz/api/v2"
MONTHS = 12  # incident density over the last N full months

# [(lat, lon), ...] for the whole country, built once per run
_country_cache: list[tuple[float, float]] | None = None


def _available_months() -> list[str]:
    r = requests.get(f"{API_BASE}/downloads", timeout=120)
    r.raise_for_status()
    names = [d["name"] for d in r.json()["data"] if d["name"].isdigit()]
    names.sort(reverse=True)
    # the newest month is partial (current month) — skip it
    return names[1 : MONTHS + 1]


def _fetch_month(month: str) -> list[tuple[float, float]]:
    r = requests.get(f"{API_BASE}/downloads/{month}.geojson", timeout=300)
    r.raise_for_status()
    raw = r.content
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    data = json.loads(raw)
    points = []
    for f in data.get("features", []):
        geom = f.get("geometry") or {}
        if geom.get("type") != "Point":
            continue
        lon, lat = geom["coordinates"][:2]
        points.append((float(lat), float(lon)))
    return points


def _build_country_cache() -> list[tuple[float, float]]:
    global _country_cache
    if _country_cache is not None:
        return _country_cache
    points: list[tuple[float, float]] = []
    for month in _available_months():
        points.extend(_fetch_month(month))
    _country_cache = points
    return _country_cache


def fetch_crime_points(
    bbox: tuple[float, float, float, float],
) -> list[tuple[float, float]]:
    """Return incident points (lat, lon) within bbox, last 12 full months."""
    south, west, north, east = bbox
    return [
        (lat, lon)
        for lat, lon in _build_country_cache()
        if south <= lat <= north and west <= lon <= east
    ]
