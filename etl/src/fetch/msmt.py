import requests

# Czech Republic bounding box: (south, west, north, east)
CZECH_BBOX = (48.55, 12.09, 51.06, 18.87)

# Overpass API queries for schools and kindergartens
# Note: We use OSM Overpass API instead of MŠMT because MŠMT has no coordinates
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


def fetch_msmt_pois(layer: str) -> list[tuple[float, float]]:
    """
    Return list of (lat, lon) for schools or kindergartens across Czech Republic.

    Uses OpenStreetMap (Overpass API) since MŠMT registry has no coordinates.
    The MŠMT registry is authoritative but we use OSM for geospatial data.

    Args:
        layer: "schools" or "kindergartens"

    Returns:
        List of (lat, lon) tuples

    Raises:
        ValueError: if layer is not recognized
    """
    if layer not in OSM_LAYER_MAP:
        raise ValueError(
            f"Unknown layer: {layer!r}. Valid: {list(OSM_LAYER_MAP.keys())}"
        )

    south, west, north, east = CZECH_BBOX
    bbox_str = f"{south},{west},{north},{east}"
    query_body = OSM_LAYER_MAP[layer].format(bbox=bbox_str)

    # Build Overpass query
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
        # For nodes: lat/lon are direct
        # For ways: use center.lat/center.lon
        if "lat" in element and "lon" in element:
            pois.append((float(element["lat"]), float(element["lon"])))
        elif "center" in element:
            center = element["center"]
            pois.append((float(center["lat"]), float(center["lon"])))

    return pois
