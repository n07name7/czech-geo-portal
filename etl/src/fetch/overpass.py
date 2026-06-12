"""Shared Overpass API client with retry/backoff.

The weekly ETL fires dozens of Overpass queries in a row (8 cities x several
layers); overpass-api.de rate-limits with 429 quickly. Without retries a city
silently drops out of a layer (main.py catches per-city errors and continues).
"""
import time

import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
HEADERS = {"User-Agent": "Czech-Geo-Portal/1.0 (Python ETL)"}
RETRY_STATUSES = {429, 502, 503, 504}


def query_overpass(
    query_body: str,
    timeout: int = 120,
    retries: int = 4,
) -> list[tuple[float, float]]:
    """Run an Overpass query, return list of (lat, lon).

    Ways/relations are reduced to their center point. Retries on 429/5xx
    with exponential backoff (5s, 10s, 20s, 40s).
    """
    query = f"[out:json][timeout:{timeout}];\n({query_body}\n);\nout center;"

    for attempt in range(retries + 1):
        response = requests.post(
            OVERPASS_URL, data=query, headers=HEADERS, timeout=timeout
        )
        if response.status_code in RETRY_STATUSES and attempt < retries:
            time.sleep(5 * 2 ** attempt)
            continue
        response.raise_for_status()
        break

    data = response.json()
    pois: list[tuple[float, float]] = []
    for element in data.get("elements", []):
        if "lat" in element and "lon" in element:
            pois.append((float(element["lat"]), float(element["lon"])))
        elif "center" in element:
            center = element["center"]
            pois.append((float(center["lat"]), float(center["lon"])))
    return pois
