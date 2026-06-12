"""Transport stops fetcher — OSM Overpass for all cities."""
from .overpass import query_overpass


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
    return query_overpass(query_body)
