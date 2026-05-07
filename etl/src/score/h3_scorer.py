import math

import h3
import numpy as np
from pyproj import Transformer
from scipy.spatial import cKDTree

_TRANSFORMER = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)

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
    if not pois or not cell_ids:
        return {c: 0.0 for c in cell_ids}

    centers = [h3.cell_to_latlng(c) for c in cell_ids]
    poi_xy = _to_mercator(pois)
    cell_xy = _to_mercator(centers)

    tree = cKDTree(poi_xy)
    counts = tree.query_ball_point(cell_xy, r=radius_m, return_length=True)
    counts = np.array(counts, dtype=float)

    max_count = counts.max()
    if max_count == 0:
        return {c: 0.0 for c in cell_ids}

    return dict(zip(cell_ids, (counts / max_count).tolist()))
