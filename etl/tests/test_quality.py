import h3
from src.score.quality_scorer import score_cells_quality
from src.fetch.cermat import _norm_izo


def test_norm_izo():
    assert _norm_izo("izo_000013757") == "13757"
    assert _norm_izo("izo_049625918") == "49625918"


def test_quality_best_within_radius():
    center = h3.latlng_to_cell(50.08, 14.44, 10)
    lat, lon = h3.cell_to_latlng(center)
    schools = [
        (lat + 0.005, lon, 40.0),   # ~550 m, percentile 40
        (lat, lon + 0.01, 90.0),    # ~700 m, percentile 90 (best)
    ]
    scores, metric = score_cells_quality(schools, [center], radius_m=3000)
    assert metric[center] == 90      # takes the best nearby school
    assert scores[center] == 0.9


def test_quality_no_school_nearby():
    center = h3.latlng_to_cell(50.08, 14.44, 10)
    far = [(49.0, 16.0, 80.0)]       # different region
    scores, metric = score_cells_quality(far, [center], radius_m=3000)
    assert metric[center] == 0
    assert scores[center] == 0.0


def test_quality_empty():
    center = h3.latlng_to_cell(50.08, 14.44, 10)
    scores, metric = score_cells_quality([], [center])
    assert scores[center] == 0.0 and metric[center] == 0
