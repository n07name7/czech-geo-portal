import pytest
from src.fetch.nrpzs import fetch_nrpzs_pois


def test_fetch_clinics_returns_list():
    result = fetch_nrpzs_pois("clinics")
    assert isinstance(result, list)
    assert len(result) > 100
    assert all(isinstance(p, tuple) and len(p) == 2 for p in result)


def test_fetch_pharmacies_returns_list():
    result = fetch_nrpzs_pois("pharmacies")
    assert isinstance(result, list)
    assert len(result) > 50


def test_unknown_layer_raises():
    with pytest.raises(ValueError):
        fetch_nrpzs_pois("dentists")
