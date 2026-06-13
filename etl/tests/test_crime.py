import src.fetch.crime as crime
from src.fetch.crime import fetch_crime_points


def test_bbox_filter_uses_cache(monkeypatch):
    monkeypatch.setattr(crime, "_country_cache", [
        (50.08, 14.44),  # Praha
        (49.20, 16.61),  # Brno
    ])
    praha_bbox = (49.94, 14.22, 50.18, 14.71)
    assert fetch_crime_points(praha_bbox) == [(50.08, 14.44)]


def test_live_one_month():
    """Live smoke test: month list + one month download (~2 MB gzip)."""
    months = crime._available_months()
    assert len(months) == crime.MONTHS
    points = crime._fetch_month(months[0])
    assert len(points) > 50000  # ~125k incidents registered per month
    assert all(48 < lat < 51.2 and 12 < lon < 19 for lat, lon in points[:1000])
