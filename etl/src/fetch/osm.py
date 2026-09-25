from .overpass import query_overpass

# We use nwr (node, way, relation) to capture area features.
# Overpass is configured (in overpass.py) to return the center point for ways and relations.
LAYER_QUERIES: dict[str, str] = {
    "playgrounds": 'nwr["leisure"="playground"]({bbox});',
    "parks": (
        'nwr["leisure"~"park|nature_reserve|garden"]({bbox}); '
        'nwr["landuse"~"forest|recreation_ground|meadow|orchard"]({bbox}); '
        'nwr["natural"~"wood|scrub|heath"]({bbox}); '
        'nwr["boundary"="national_park"]({bbox});'
    ),
    "sports": (
        'nwr["leisure"~"sports_centre|pitch|stadium|track|fitness_station|fitness_centre|swimming_pool"]({bbox}); '
        'nwr["amenity"="swimming_pool"]({bbox}); '
        'nwr["sport"]({bbox});'
    ),
    "shops": (
        'nwr["shop"~"supermarket|convenience|bakery|butcher|greengrocer|deli|health_food|mall|department_store|general"]({bbox}); '
        'nwr["amenity"="market"]({bbox});'
    ),
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
