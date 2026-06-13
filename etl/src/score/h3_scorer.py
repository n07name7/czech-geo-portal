import math

import h3
import numpy as np
from pyproj import Transformer
from scipy.spatial import cKDTree

# S-JTSK (EPSG:5514) — the Czech national grid; distances are accurate to
# <0.1% nationwide, so the 800 m radius and the object counts are real metres
# (Web Mercator would shrink 800 m to ~510 m at Prague's latitude).
_TRANSFORMER = Transformer.from_crs("EPSG:4326", "EPSG:5514", always_xy=True)

RADIUS_M = 800  # ~10 minute walk


def get_city_cells(bbox: tuple[float, float, float, float], resolution: int = 10) -> list[str]:
    """Return all H3 cell IDs covering a city bounding box at given resolution."""
    south, west, north, east = bbox
    boundary = h3.LatLngPoly([
        (north, west), (north, east), (south, east), (south, west),
    ])
    return list(h3.polygon_to_cells(boundary, resolution))


def _to_mercator(coords: list[tuple[float, float]]) -> np.ndarray:
    """Convert list of (lat, lon) to EPSG:3857 (x, y) in metres."""
    lons = [c[1] for c in coords]
    lats = [c[0] for c in coords]
    xs, ys = _TRANSFORMER.transform(lons, lats)
    return np.column_stack([xs, ys])


def count_cells(
    pois: list[tuple[float, float]],
    cell_ids: list[str],
    radius_m: int = RADIUS_M,
) -> dict[str, int]:
    """Raw number of POIs within radius_m metres of each cell centre."""
    if not pois or not cell_ids:
        return {c: 0 for c in cell_ids}
    centers = [h3.cell_to_latlng(c) for c in cell_ids]
    tree = cKDTree(_to_mercator(pois))
    counts = tree.query_ball_point(_to_mercator(centers), r=radius_m, return_length=True)
    return dict(zip(cell_ids, (int(c) for c in counts)))


def score_cells(
    pois: list[tuple[float, float]],
    cell_ids: list[str],
    radius_m: int = RADIUS_M,
) -> dict[str, float]:
    """
    For each H3 cell in cell_ids, count POIs within radius_m metres.
    Returns {cell_id: normalized_score} where max score == 1.0.
    Score is normalised per-city (max within the provided cell_ids == 1.0).
    """
    counts = count_cells(pois, cell_ids, radius_m)
    if not counts:
        return {}
    max_count = max(counts.values())
    if max_count == 0:
        return {c: 0.0 for c in cell_ids}
    return {c: n / max_count for c, n in counts.items()}
