import requests

LAYER_QUERIES: dict[str, str] = {
    "clinics": (
        'node["amenity"="clinic"]({bbox}); '
        'node["amenity"="doctors"]({bbox});'
    ),
    "pharmacies": 'node["amenity"="pharmacy"]({bbox});',
}


def fetch_nrpzs_pois(
    layer: str,
    bbox: tuple[float, float, float, float] = (49.94, 14.22, 50.18, 14.71),
) -> list[tuple[float, float]]:
    """Return list of (lat, lon) for clinics or pharmacies within bbox."""
    if layer not in LAYER_QUERIES:
        raise ValueError(f"Unknown layer: {layer!r}. Valid: {list(LAYER_QUERIES)}")

    south, west, north, east = bbox
    bbox_str = f"{south},{west},{north},{east}"
    query_body = LAYER_QUERIES[layer].format(bbox=bbox_str)
    query = f"[out:json][timeout:60];\n({query_body}\n);\nout center;"

    headers = {"User-Agent": "Czech-Geo-Portal/1.0 (Python ETL)"}
    response = requests.post(
        "https://overpass-api.de/api/interpreter",
        data=query,
        headers=headers,
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()

    pois: list[tuple[float, float]] = []
    for element in data.get("elements", []):
        if "lat" in element and "lon" in element:
            pois.append((float(element["lat"]), float(element["lon"])))
    return pois
