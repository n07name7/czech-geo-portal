import pytest
from src.fetch.msmt import fetch_msmt_pois


def test_fetch_schools_returns_list():
    result = fetch_msmt_pois("schools")
    assert isinstance(result, list)
    assert len(result) > 100  # CZ has ~4500 ZŠ
    assert all(isinstance(p, tuple) and len(p) == 2 for p in result)
    # Check that coordinates are valid floats
    assert all(isinstance(p[0], float) and isinstance(p[1], float) for p in result)


def test_fetch_kindergartens_returns_list():
    result = fetch_msmt_pois("kindergartens")
    assert isinstance(result, list)
    assert len(result) > 100
    assert all(isinstance(p, tuple) and len(p) == 2 for p in result)


def test_fetch_unknown_raises():
    with pytest.raises(ValueError):
        fetch_msmt_pois("universities")
