"""School-quality scoring — best nearby secondary school by CERMAT percentile.

Unlike POI density layers, this answers "is a good secondary school within
reach?". Pupils commute, so the radius is larger and the cell takes the
BEST (max) percentile among schools in range. Score = percentile / 100.
"""
import h3
import numpy as np
from pyproj import Transformer
from scipy.spatial import cKDTree

_TRANSFORMER = Transformer.from_crs("EPSG:4326", "EPSG:5514", always_xy=True)

RADIUS_M = 3000  # secondary schools serve a wider area than ~10 min walk


def _to_grid(coords: list[tuple[float, float]]) -> np.ndarray:
    lons = [c[1] for c in coords]
    lats = [c[0] for c in coords]
    xs, ys = _TRANSFORMER.transform(lons, lats)
    return np.column_stack([xs, ys])


def score_cells_quality(
    schools: list[tuple[float, float, float]],
    cell_ids: list[str],
    radius_m: int = RADIUS_M,
) -> tuple[dict[str, float], dict[str, int]]:
    """Return ({cell: score 0-1}, {cell: best percentile 0-100}).

    Score and metric are 0 where no scored school is within radius.
    """
    if not cell_ids:
        return {}, {}
    if not schools:
        zero = {c: 0.0 for c in cell_ids}
        return zero, {c: 0 for c in cell_ids}

    school_xy = _to_grid([(s[0], s[1]) for s in schools])
    percentiles = np.array([s[2] for s in schools])
    centers = [h3.cell_to_latlng(c) for c in cell_ids]
    cell_xy = _to_grid(centers)

    tree = cKDTree(school_xy)
    neighbors = tree.query_ball_point(cell_xy, r=radius_m)

    scores: dict[str, float] = {}
    metric: dict[str, int] = {}
    for i, cell in enumerate(cell_ids):
        idx = neighbors[i]
        if idx:
            best = float(percentiles[idx].max())
        else:
            best = 0.0
        scores[cell] = best / 100.0
        metric[cell] = int(round(best))
    return scores, metric
