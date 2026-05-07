import pytest
from src.score.h3_scorer import score_cells, get_prague_cells

def test_get_prague_cells_returns_h3_ids():
    cells = get_prague_cells(resolution=10)
    assert len(cells) > 5000  # Prague at res 10 ≈ 33000 cells
    assert all(isinstance(c, str) and len(c) == 15 for c in cells)

def test_score_cells_with_no_pois():
    cells = get_prague_cells(resolution=10)[:100]
    scores = score_cells([], cells)
    assert all(v == 0.0 for v in scores.values())

def test_score_cells_normalizes_to_0_1():
    cells = get_prague_cells(resolution=10)[:200]
    pois = [(50.08, 14.44)] * 5  # POI in middle of Prague
    scores = score_cells(pois, cells)
    values = list(scores.values())
    assert max(values) == pytest.approx(1.0)
    assert min(values) >= 0.0

def test_score_cells_returns_all_input_cells():
    cells = get_prague_cells(resolution=10)[:50]
    scores = score_cells([(50.08, 14.44)], cells)
    assert set(scores.keys()) == set(cells)
