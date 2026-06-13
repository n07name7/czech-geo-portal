"""Quietness scoring — zonal max-dB per H3 cell from noise band polygons."""
import h3
import numpy as np
from shapely import STRtree
from shapely.geometry import Point

# Score 1.0 = quiet (below mapped bands), 0.0 = 80 dB and louder.
_DB_QUIET = 53.0
_DB_LOUD = 80.0


def db_to_score(db: float) -> float:
    if db <= _DB_QUIET:
        return 1.0
    return float(np.clip((_DB_LOUD - db) / (_DB_LOUD - _DB_QUIET), 0.0, 1.0))


def score_cells_quiet(
    noise_polys: list[tuple[object, float]],
    cell_ids: list[str],
) -> dict[str, float]:
    """For each cell, take the loudest band covering its center."""
    if not cell_ids:
        return {}
    if not noise_polys:
        return {c: 1.0 for c in cell_ids}

    geoms = [g for g, _ in noise_polys]
    dbs = np.array([db for _, db in noise_polys])
    tree = STRtree(geoms)

    centers = [h3.cell_to_latlng(c) for c in cell_ids]
    points = [Point(lon, lat) for lat, lon in centers]

    max_db = np.zeros(len(cell_ids))
    pairs = tree.query(points, predicate="intersects")
    for point_idx, geom_idx in pairs.T:
        if dbs[geom_idx] > max_db[point_idx]:
            max_db[point_idx] = dbs[geom_idx]

    return {c: db_to_score(max_db[i]) for i, c in enumerate(cell_ids)}
