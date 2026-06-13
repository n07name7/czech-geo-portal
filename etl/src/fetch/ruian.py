"""RÚIAN address points (ČÚZK) — geocode address codes to WGS84.

ČÚZK publishes a monthly zip of per-municipality CSVs with every address
point in Czechia (kód ADM + S-JTSK coordinates). Open data, free reuse.
"""
import csv
import io
import zipfile
from datetime import date, timedelta

import requests
from pyproj import Transformer

URL_TEMPLATE = "https://vdp.cuzk.gov.cz/vymenny_format/csv/{stamp}_OB_ADR_csv.zip"

# CSV stores S-JTSK as positive values; EPSG:5514 axes are negative.
_TRANSFORMER = Transformer.from_crs("EPSG:5514", "EPSG:4326", always_xy=True)

_zip_bytes: bytes | None = None


def _month_end_stamps(count: int = 3) -> list[str]:
    """Last day of recent months, newest first (dump appears early next month)."""
    stamps = []
    d = date.today().replace(day=1)
    for _ in range(count):
        last = d - timedelta(days=1)
        stamps.append(last.strftime("%Y%m%d"))
        d = last.replace(day=1)
    return stamps


def _download_zip() -> bytes:
    global _zip_bytes
    if _zip_bytes is not None:
        return _zip_bytes
    last_err: Exception | None = None
    for stamp in _month_end_stamps():
        url = URL_TEMPLATE.format(stamp=stamp)
        try:
            r = requests.get(url, timeout=600)
            if r.status_code == 200:
                _zip_bytes = r.content
                return _zip_bytes
        except requests.RequestException as e:
            last_err = e
    raise RuntimeError(f"No RÚIAN address dump found ({last_err})")


def geocode_codes(codes: set[int]) -> dict[int, tuple[float, float]]:
    """Return {kód ADM: (lat, lon)} for the requested address codes only.

    Scans all per-municipality CSVs but keeps just the needed codes, so
    memory stays small (the full dump has ~3M address points).
    """
    if not codes:
        return {}
    result: dict[int, tuple[float, float]] = {}
    with zipfile.ZipFile(io.BytesIO(_download_zip())) as z:
        for name in z.namelist():
            if not name.endswith("_ADR.csv"):
                continue
            with z.open(name) as f:
                text = io.TextIOWrapper(f, encoding="cp1250")
                reader = csv.reader(text, delimiter=";")
                next(reader, None)  # header
                for row in reader:
                    try:
                        adm = int(row[0])
                        if adm not in codes:
                            continue
                        y, x = float(row[16]), float(row[17])
                    except (ValueError, IndexError):
                        continue
                    lon, lat = _TRANSFORMER.transform(-y, -x)
                    result[adm] = (lat, lon)
    return result
