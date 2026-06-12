from .overpass import query_overpass

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
    return query_overpass(LAYER_QUERIES[layer].format(bbox=bbox_str))
