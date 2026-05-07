import requests

OSM_LAYER_MAP = {
    "schools": (
        'node["amenity"="school"]({bbox}); '
        'way["amenity"="school"]({bbox}); '
        'relation["amenity"="school"]({bbox});'
    ),
    "kindergartens": (
        'node["amenity"="kindergarten"]({bbox}); '
        'way["amenity"="kindergarten"]({bbox}); '
        'relation["amenity"="kindergarten"]({bbox});'
    ),
}


def fetch_msmt_pois(
    layer: str,
    bbox: tuple[float, float, float, float] = (49.94, 14.22, 50.18, 14.71),
) -> list[tuple[float, float]]:
    """Return list of (lat, lon) for schools or kindergartens within bbox."""
    if layer not in OSM_LAYER_MAP:
        raise ValueError(f"Unknown layer: {layer!r}. Valid: {list(OSM_LAYER_MAP)}")

    south, west, north, east = bbox
    bbox_str = f"{south},{west},{north},{east}"
    query_body = OSM_LAYER_MAP[layer].format(bbox=bbox_str)
    query = f"[out:json][timeout:90];\n({query_body}\n);\nout center;"

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
        elif "center" in element:
            c = element["center"]
            pois.append((float(c["lat"]), float(c["lon"])))
    return pois
