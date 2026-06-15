"""Assign each H3 cell the rent (CZK/m²) of the cadastral area it sits in."""
import h3
from shapely import STRtree
from shapely.geometry import Point


def score_cells_rent(
    areas: list[tuple[object, int]],
    cell_ids: list[str],
) -> dict[str, int]:
    """areas: [(k.ú. polygon WGS84, rent)]. Return {cell: rent} for cells whose
    centre falls inside a k.ú. that has a rent value."""
    if not cell_ids or not areas:
        return {}
    polys = [a for a, _ in areas]
    rents = [r for _, r in areas]
    tree = STRtree(polys)

    centers = [h3.cell_to_latlng(c) for c in cell_ids]
    points = [Point(lon, lat) for lat, lon in centers]
    pairs = tree.query(points, predicate="within")

    cell_rent: dict[int, int] = {}
    for point_idx, poly_idx in pairs.T:
        cell_rent.setdefault(int(point_idx), rents[int(poly_idx)])
    return {cell_ids[i]: rent for i, rent in cell_rent.items()}
