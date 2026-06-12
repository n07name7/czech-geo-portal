from .overpass import query_overpass

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
    return query_overpass(OSM_LAYER_MAP[layer].format(bbox=bbox_str))
