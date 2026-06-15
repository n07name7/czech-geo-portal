import h3
from shapely.geometry import Polygon
from pyproj import Transformer

from src.score.air_scorer import pm25_to_score, score_cells_air

_TO = Transformer.from_crs("EPSG:4326", "EPSG:5514", always_xy=True)


def test_pm25_to_score():
    assert pm25_to_score(5) == 1.0
    assert pm25_to_score(8) == 1.0
    assert pm25_to_score(22) == 0.0
    assert pm25_to_score(30) == 0.0
    assert 0.0 < pm25_to_score(15) < 1.0


def _sjtsk_square(lat, lon, half=0.02):
    pts = [(lon - half, lat - half), (lon + half, lat - half),
           (lon + half, lat + half), (lon - half, lat + half)]
    xy = [_TO.transform(x, y) for x, y in pts]
    return Polygon(xy)


def test_score_cells_air_matches_polygon():
    cell = h3.latlng_to_cell(50.08, 14.44, 10)
    lat, lon = h3.cell_to_latlng(cell)
    grid = [(_sjtsk_square(lat, lon), 12.0)]
    scores, metric = score_cells_air(grid, [cell])
    assert metric[cell] == 12
    assert scores[cell] == pm25_to_score(12.0)


def test_score_cells_air_no_grid():
    cell = h3.latlng_to_cell(50.08, 14.44, 10)
    scores, metric = score_cells_air([], [cell])
    assert scores[cell] == 0.0 and metric[cell] == 0
