"""Clinics and pharmacies from the official NRPZS registry (ÚZIS).

Source: NRPZS open data — every healthcare service location in Czechia,
monthly CSV with WGS84 coordinates included. License: CC BY 4.0.
"""
import csv
import io

import requests

CSV_URL = (
    "https://datanzis.uzis.gov.cz/data/NR-01-NRPZS/NR-01-06/"
    "Otevrena-data-NR-01-06-nrpzs-mista-poskytovani-zdravotnich-sluzeb.csv"
)

# ZZ_druh_nazev values per layer
LAYER_TYPES: dict[str, set[str]] = {
    "clinics": {
        "Samostatná ordinace lékaře specialisty",
        "Samost. ordinace všeob. prakt. lékaře",
        "Sam.ord.prakt.lékaře pro děti a dorost",
        "Samostatná ordinace PL - stomatologa",
        "Samostatná ordinace PL - gynekologa",
        "Poskytovatel amb. služeb (do 5 oborů)",
        "Poskytovatel amb. služeb (nad 5 oborů)",
        "Ostatní ambulantní zařízení",
        "Poliklinika",
        "Nemocnice",
        "Fakultní nemocnice",
    },
    "pharmacies": {"Lékárna"},
}

# {layer: [(lat, lon), ...]} for the whole country, built once per run
_country_cache: dict[str, list[tuple[float, float]]] | None = None


def _parse_gps(value: str) -> tuple[float, float] | None:
    """ZZ_GPS comes as 'POINT(lat lon)'."""
    if not value or not value.startswith("POINT("):
        return None
    try:
        lat_s, lon_s = value[6:].rstrip(")").split()
        return float(lat_s), float(lon_s)
    except ValueError:
        return None


def _build_country_cache() -> dict[str, list[tuple[float, float]]]:
    global _country_cache
    if _country_cache is not None:
        return _country_cache

    r = requests.get(CSV_URL, timeout=600)
    r.raise_for_status()
    text = io.StringIO(r.content.decode("utf-8-sig"))

    cache: dict[str, list[tuple[float, float]]] = {l: [] for l in LAYER_TYPES}
    for row in csv.DictReader(text):
        point = _parse_gps(row.get("ZZ_GPS", ""))
        if point is None:
            continue
        druh = row.get("ZZ_druh_nazev", "")
        for layer, types in LAYER_TYPES.items():
            if druh in types:
                cache[layer].append(point)

    _country_cache = cache
    return _country_cache


def fetch_nrpzs_pois(
    layer: str,
    bbox: tuple[float, float, float, float] = (49.94, 14.22, 50.18, 14.71),
) -> list[tuple[float, float]]:
    """Return list of (lat, lon) for clinics or pharmacies within bbox."""
    if layer not in LAYER_TYPES:
        raise ValueError(f"Unknown layer: {layer!r}. Valid: {list(LAYER_TYPES)}")

    south, west, north, east = bbox
    return [
        (lat, lon)
        for lat, lon in _build_country_cache()[layer]
        if south <= lat <= north and west <= lon <= east
    ]
