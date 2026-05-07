import pytest
from src.fetch.osm import fetch_osm_pois

def test_fetch_playgrounds_returns_list():
    result = fetch_osm_pois("playgrounds", bbox=(50.1, 14.3, 50.15, 14.35))
    assert isinstance(result, list)
    assert len(result) > 0
    assert all(isinstance(p, tuple) and len(p) == 2 for p in result)
    assert all(-90 <= p[0] <= 90 and -180 <= p[1] <= 180 for p in result)

def test_fetch_unknown_layer_raises():
    with pytest.raises(ValueError, match="Unknown OSM layer"):
        fetch_osm_pois("unicorns", bbox=(50.1, 14.3, 50.15, 14.35))
