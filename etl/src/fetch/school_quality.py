"""Secondary-school quality points: each school's location + its CERMAT percentile.

Joins the MŠMT registry (secondary schools, druh C00, with RÚIAN address
codes) to CERMAT entrance-exam percentiles by IZO, geocoding via the ČÚZK
address dump. Returns (lat, lon, percentile) triples for scoring.
"""
from .registry import load_registry
from .ruian import geocode_codes
from .cermat import school_percentiles

_SECONDARY = {"C00"}  # střední škola

# country-wide [(lat, lon, percentile)], built once per run
_country: list[tuple[float, float, float]] | None = None


def _norm_izo(raw) -> str:
    return str(raw).lstrip("0")


def _build_country() -> list[tuple[float, float, float]]:
    global _country
    if _country is not None:
        return _country

    percentiles = school_percentiles()

    # secondary school place → (RÚIAN code, percentile), for schools we have a score for
    code_perc: dict[int, float] = {}
    for entity in load_registry():
        for facility in entity.get("skolyAZarizeni", []):
            if facility.get("druh") not in _SECONDARY:
                continue
            izo = _norm_izo(facility.get("izo", ""))
            perc = percentiles.get(izo)
            if perc is None:
                continue
            for place in facility.get("mistaVyuky") or []:
                code = (place.get("adresa") or {}).get("kodRUIAN")
                if code:
                    code_perc[int(code)] = perc

    coords = geocode_codes(set(code_perc))
    _country = [
        (coords[c][0], coords[c][1], perc)
        for c, perc in code_perc.items()
        if c in coords
    ]
    return _country


def fetch_school_quality(
    bbox: tuple[float, float, float, float],
) -> list[tuple[float, float, float]]:
    """Return (lat, lon, percentile) for secondary schools within bbox."""
    south, west, north, east = bbox
    return [
        (lat, lon, perc)
        for lat, lon, perc in _build_country()
        if south <= lat <= north and west <= lon <= east
    ]
