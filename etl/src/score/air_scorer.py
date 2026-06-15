"""Air-quality scoring — PM2.5 per H3 cell from the ČHMÚ grid (lower = better).

Cell centre is transformed to S-JTSK and matched to the grid polygon it
falls in. Score 1.0 at clean air, 0.0 at polluted; metric is PM2.5 µg/m³.
"""
import h3
import numpy as np
from pyproj import Transformer
from shapely import STRtree
from shapely.geometry import Point

_TO_SJTSK = Transformer.from_crs("EPSG:4326", "EPSG:5514", always_xy=True)

# PM2.5 annual mean: WHO guideline 5, EU limit 25 µg/m³. Map a sensible
# Czech range to 0-1 (clean → polluted).
_PM_CLEAN = 8.0
_PM_DIRTY = 22.0


def pm25_to_score(pm25: float) -> float:
    if pm25 <= _PM_CLEAN:
        return 1.0
    return float(np.clip((_PM_DIRTY - pm25) / (_PM_DIRTY - _PM_CLEAN), 0.0, 1.0))


def score_cells_air(
    grid: list[tuple[object, float]],
    cell_ids: list[str],
) -> tuple[dict[str, float], dict[str, int]]:
    """Return ({cell: score 0-1}, {cell: PM2.5 µg/m³}). 0 where no grid cell."""
    if not cell_ids:
        return {}, {}
    if not grid:
        return {c: 0.0 for c in cell_ids}, {c: 0 for c in cell_ids}

    polys = [g for g, _ in grid]
    pm = [p for _, p in grid]
    tree = STRtree(polys)

    centers = [h3.cell_to_latlng(c) for c in cell_ids]
    xs, ys = _TO_SJTSK.transform([lon for _, lon in centers], [lat for lat, _ in centers])
    points = [Point(x, y) for x, y in zip(xs, ys)]

    scores: dict[str, float] = {}
    metric: dict[str, int] = {}
    pairs = tree.query(points, predicate="within")
    cell_pm: dict[int, float] = {}
    for point_idx, poly_idx in pairs.T:
        cell_pm.setdefault(int(point_idx), pm[int(poly_idx)])

    for i, cell in enumerate(cell_ids):
        if i in cell_pm:
            v = cell_pm[i]
            scores[cell] = pm25_to_score(v)
            metric[cell] = int(round(v))
        else:
            scores[cell] = 0.0
            metric[cell] = 0
    return scores, metric
