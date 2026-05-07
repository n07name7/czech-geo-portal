"""GTFS fetcher for PID public transport stops."""
import io
import zipfile
import requests
import pandas as pd

PID_GTFS_URL = "https://pid.cz/wp-content/uploads/2023/01/PID_GTFS.zip"

# Czech Republic bbox: (south, west, north, east)
CZECH_BBOX = (48.55, 12.09, 51.06, 18.87)


def fetch_gtfs_stops(url: str = PID_GTFS_URL) -> list[tuple[float, float]]:
    """Download PID GTFS ZIP and return list of (lat, lon) for all stops.

    Falls back to OSM if PID GTFS URL is unavailable.

    Args:
        url: URL to GTFS ZIP file (default: PID GTFS)

    Returns:
        List of (lat, lon) tuples for transport stops
    """
    try:
        response = requests.get(url, timeout=120, headers={"User-Agent": "Czech-Geo-Portal/1.0"})
        response.raise_for_status()

        with zipfile.ZipFile(io.BytesIO(response.content)) as zf:
            with zf.open("stops.txt") as f:
                df = pd.read_csv(f)

        pois: list[tuple[float, float]] = []
        for _, row in df[["stop_lat", "stop_lon"]].dropna().iterrows():
            try:
                pois.append((float(row["stop_lat"]), float(row["stop_lon"])))
            except ValueError:
                continue
        return pois

    except (requests.RequestException, zipfile.BadZipFile, KeyError, FileNotFoundError):
        # Fallback to OSM
        return _fetch_gtfs_osm_fallback()


def _fetch_gtfs_osm_fallback() -> list[tuple[float, float]]:
    """Fallback to OSM Overpass for Prague public transport stops."""
    south, west, north, east = CZECH_BBOX
    bbox_str = f"{south},{west},{north},{east}"

    # Query for bus stops (primary Czech public transport)
    query_body = f'node["highway"="bus_stop"]({bbox_str});'
    query = f"[out:json][timeout:120];\n({query_body}\n);\nout center;"

    headers = {"User-Agent": "Czech-Geo-Portal/1.0 (Python ETL)"}
    response = requests.post(
        "https://overpass-api.de/api/interpreter",
        data=query,
        headers=headers,
        timeout=120
    )
    response.raise_for_status()
    data = response.json()

    pois: list[tuple[float, float]] = []
    for element in data.get("elements", []):
        if "lat" in element and "lon" in element:
            pois.append((float(element["lat"]), float(element["lon"])))
    return pois
