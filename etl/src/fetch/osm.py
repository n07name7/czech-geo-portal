from .overpass import query_overpass

LAYER_QUERIES: dict[str, str] = {
    "playgrounds": 'node["leisure"="playground"]({bbox});',
    "parks":       'way["leisure"="park"]({bbox}); relation["leisure"="park"]({bbox});',
    "sports":      'node["leisure"="sports_centre"]({bbox}); node["leisure"="pitch"]({bbox});',
    "shops":       'node["shop"="supermarket"]({bbox}); node["shop"="convenience"]({bbox});',
}

PRAGUE_BBOX = (49.94, 14.22, 50.18, 14.71)  # (south, west, north, east)


def fetch_osm_pois(
    layer: str,
    bbox: tuple[float, float, float, float] = PRAGUE_BBOX,
) -> list[tuple[float, float]]:
    """Return list of (lat, lon) for all POIs of given layer within bbox."""
    if layer not in LAYER_QUERIES:
        raise ValueError(f"Unknown OSM layer: {layer!r}. Valid: {list(LAYER_QUERIES)}")

    south, west, north, east = bbox
    bbox_str = f"{south},{west},{north},{east}"
    return query_overpass(LAYER_QUERIES[layer].format(bbox=bbox_str))
