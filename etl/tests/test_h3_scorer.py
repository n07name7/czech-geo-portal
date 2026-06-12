import pytest
from src.score.h3_scorer import score_cells, get_city_cells

PRAGUE_BBOX = (49.94, 14.22, 50.18, 14.71)  # south, west, north, east

def test_get_city_cells_returns_h3_ids():
    cells = get_city_cells(PRAGUE_BBOX, resolution=10)
    assert len(cells) > 5000  # Prague at res 10 ≈ 33000 cells
    assert all(isinstance(c, str) and len(c) == 15 for c in cells)

def test_score_cells_with_no_pois():
    cells = get_city_cells(PRAGUE_BBOX, resolution=10)[:100]
    scores = score_cells([], cells)
    assert all(v == 0.0 for v in scores.values())

def test_score_cells_normalizes_to_0_1():
    # tight bbox around the POI so at least one cell center is within 800m
    cells = get_city_cells((50.07, 14.43, 50.09, 14.45), resolution=10)
    pois = [(50.08, 14.44)] * 5
    scores = score_cells(pois, cells)
    values = list(scores.values())
    assert max(values) == pytest.approx(1.0)
    assert min(values) >= 0.0

def test_score_cells_returns_all_input_cells():
    cells = get_city_cells(PRAGUE_BBOX, resolution=10)[:50]
    scores = score_cells([(50.08, 14.44)], cells)
    assert set(scores.keys()) == set(cells)
