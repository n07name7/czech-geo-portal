import h3
import numpy as np
from pyproj import Transformer
from scipy.spatial import cKDTree

# Prague bounding box as a polygon (simplified rectangle)
# This covers Prague administrative area (OSM relation 435514)
PRAGUE_BOUNDARY_LATLNG = [
    (50.177, 14.224),
    (50.177, 14.707),
    (49.941, 14.707),
    (49.941, 14.224),
]

_TRANSFORMER = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)

RADIUS_M = 800  # ~10 minute walk


def get_prague_cells(resolution: int = 10) -> list[str]:
    """Return all H3 cell IDs covering Prague at given resolution."""
    boundary = h3.LatLngPoly(PRAGUE_BOUNDARY_LATLNG)
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
    """
    if not pois or not cell_ids:
        return {c: 0.0 for c in cell_ids}

    centers = [h3.cell_to_latlng(c) for c in cell_ids]
    poi_xy = _to_mercator(pois)
    cell_xy = _to_mercator(centers)

    tree = cKDTree(poi_xy)
    counts = np.array(
        [len(tree.query_ball_point(xy, radius_m)) for xy in cell_xy],
        dtype=float,
    )

    max_count = counts.max()
    if max_count == 0:
        return {c: 0.0 for c in cell_ids}

    normalized = counts / max_count
    return dict(zip(cell_ids, normalized.tolist()))
