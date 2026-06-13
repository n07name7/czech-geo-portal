import pytest
import src.fetch.nrpzs as nrpzs
from src.fetch.nrpzs import fetch_nrpzs_pois, _parse_gps


def test_parse_gps():
    assert _parse_gps("POINT(50.1487 15.1196)") == (50.1487, 15.1196)
    assert _parse_gps("") is None
    assert _parse_gps("50.1, 15.1") is None
    assert _parse_gps("POINT(abc def)") is None


def test_bbox_filter_uses_cache(monkeypatch):
    monkeypatch.setattr(nrpzs, "_country_cache", {
        "clinics": [(50.08, 14.44), (49.20, 16.61)],  # Praha, Brno
        "pharmacies": [(50.08, 14.44)],
    })
    praha_bbox = (49.94, 14.22, 50.18, 14.71)
    assert fetch_nrpzs_pois("clinics", praha_bbox) == [(50.08, 14.44)]
    assert fetch_nrpzs_pois("pharmacies", praha_bbox) == [(50.08, 14.44)]


def test_unknown_layer_raises():
    with pytest.raises(ValueError):
        fetch_nrpzs_pois("dentists")


def test_live_registry_prague():
    """Live smoke test against the NRPZS open data CSV (~25 MB download)."""
    clinics = fetch_nrpzs_pois("clinics")
    pharmacies = fetch_nrpzs_pois("pharmacies")
    assert len(clinics) > 1000      # Prague has thousands of practices
    assert len(pharmacies) > 100
    assert all(49 < lat < 51 and 14 < lon < 15 for lat, lon in pharmacies)
