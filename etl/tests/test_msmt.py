import os

import pytest
import src.fetch.msmt as msmt
from src.fetch.msmt import fetch_msmt_pois


def test_bbox_filter_uses_cache(monkeypatch):
    monkeypatch.setattr(msmt, "_country_cache", {
        "schools": [(50.08, 14.44), (49.20, 16.61)],  # Praha, Brno
        "kindergartens": [(49.84, 18.29)],            # Ostrava
    })
    praha_bbox = (49.94, 14.22, 50.18, 14.71)
    assert fetch_msmt_pois("schools", praha_bbox) == [(50.08, 14.44)]
    assert fetch_msmt_pois("kindergartens", praha_bbox) == []


def test_fetch_unknown_raises():
    with pytest.raises(ValueError):
        fetch_msmt_pois("universities")


@pytest.mark.skipif(
    not os.environ.get("RUN_HEAVY_TESTS"),
    reason="downloads ~95 MB (MŠMT registry + ČÚZK address points); set RUN_HEAVY_TESTS=1",
)
def test_live_registry_prague():
    schools = fetch_msmt_pois("schools")
    kindergartens = fetch_msmt_pois("kindergartens")
    assert len(schools) > 200        # Prague has 200+ základní školy
    assert len(kindergartens) > 300
    assert all(49 < lat < 51 and 14 < lon < 15 for lat, lon in schools)
