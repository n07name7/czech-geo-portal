import h3
import pytest
from shapely.geometry import Polygon

from src.fetch.noise import _db_mid
from src.score.noise_scorer import db_to_score, score_cells_quiet


def test_db_mid():
    assert _db_mid("55 - 60 dB") == 57.5
    assert _db_mid("75 - 80 dB") == 77.5


def test_db_to_score_range():
    assert db_to_score(0) == 1.0
    assert db_to_score(53) == 1.0
    assert db_to_score(80) == 0.0
    assert db_to_score(95) == 0.0
    assert 0.0 < db_to_score(65) < 1.0


def test_score_cells_quiet_no_noise_is_quiet():
    cell = h3.latlng_to_cell(50.08, 14.44, 10)
    scores = score_cells_quiet([], [cell])
    assert scores[cell] == 1.0


def test_score_cells_quiet_loud_polygon():
    cell = h3.latlng_to_cell(50.08, 14.44, 10)
    lat, lon = h3.cell_to_latlng(cell)
    d = 0.01
    loud = Polygon([
        (lon - d, lat - d), (lon + d, lat - d),
        (lon + d, lat + d), (lon - d, lat + d),
    ])
    far = Polygon([(0, 0), (0.1, 0), (0.1, 0.1), (0, 0.1)])

    scores = score_cells_quiet([(loud, 77.5), (far, 57.5)], [cell])
    assert scores[cell] == pytest.approx(db_to_score(77.5))


def test_live_fetch_small_area():
    """Live smoke test against MZČR FeatureServer — central Prague chunk."""
    from src.fetch.noise import fetch_noise_polygons
    polys = fetch_noise_polygons((50.05, 14.40, 50.10, 14.45))
    assert len(polys) > 50  # central Prague is noisy
    assert all(db > 53 for _, db in polys)
