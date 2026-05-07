import pytest
from src.fetch.gtfs import fetch_gtfs_stops


def test_fetch_pid_stops_returns_list():
    result = fetch_gtfs_stops()
    assert isinstance(result, list)
    assert len(result) > 1000
    assert all(isinstance(p, tuple) and len(p) == 2 for p in result)
    # Czech Republic bounds (south, west, north, east)
    assert all(48.55 <= lat <= 51.06 and 12.09 <= lon <= 18.87 for lat, lon in result)
