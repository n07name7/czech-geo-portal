"""Transport stops fetcher — OSM Overpass for all cities."""
import requests


def fetch_gtfs_stops(
    bbox: tuple[float, float, float, float] = (49.94, 14.22, 50.18, 14.71),
) -> list[tuple[float, float]]:
    """Return list of (lat, lon) for public transport stops within bbox.

    Uses OSM Overpass (bus stops + tram stops + metro entrances).
    """
    south, west, north, east = bbox
    bbox_str = f"{south},{west},{north},{east}"

    query_body = (
        f'node["highway"="bus_stop"]({bbox_str});'
        f'node["railway"="tram_stop"]({bbox_str});'
        f'node["railway"="subway_entrance"]({bbox_str});'
    )
    query = f"[out:json][timeout:120];\n({query_body}\n);\nout;"

    headers = {"User-Agent": "Czech-Geo-Portal/1.0 (Python ETL)"}
    response = requests.post(
        "https://overpass-api.de/api/interpreter",
        data=query,
        headers=headers,
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()

    pois: list[tuple[float, float]] = []
    for element in data.get("elements", []):
        if "lat" in element and "lon" in element:
            pois.append((float(element["lat"]), float(element["lon"])))
    return pois
