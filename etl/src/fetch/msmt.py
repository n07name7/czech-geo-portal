"""Schools and kindergartens from the official MŠMT registry (Rejstřík škol).

Source: RSSZ open data (data.gov.cz, publisher 00022985), full-country
JSON-LD dump. Addresses carry RÚIAN codes; coordinates come from the
ČÚZK address-point dump (see ruian.py). License: open data, attribution.
"""
import requests

from .ruian import geocode_codes

REGISTRY_URL = (
    "https://lkod-ftp.msmt.gov.cz/00022985/"
    "88a7c12b-6084-4e47-8b50-46097c6e683f/RSSZ-cela-CR.jsonld"
)

# druh codes in the registry
LAYER_DRUH: dict[str, set[str]] = {
    "kindergartens": {"A00"},  # mateřská škola
    "schools":       {"B00"},  # základní škola
}

# {layer: [(lat, lon), ...]} for the whole country, built once per run
_country_cache: dict[str, list[tuple[float, float]]] | None = None


def _build_country_cache() -> dict[str, list[tuple[float, float]]]:
    global _country_cache
    if _country_cache is not None:
        return _country_cache

    registry = requests.get(REGISTRY_URL, timeout=600).json()

    # collect RÚIAN address codes per layer; one school can teach at
    # several places (mistaVyuky) — each place counts as a POI
    layer_codes: dict[str, set[int]] = {layer: set() for layer in LAYER_DRUH}
    for entity in registry.get("list", []):
        for facility in entity.get("skolyAZarizeni", []):
            druh = facility.get("druh")
            for layer, druhy in LAYER_DRUH.items():
                if druh not in druhy:
                    continue
                places = facility.get("mistaVyuky") or []
                for place in places:
                    code = (place.get("adresa") or {}).get("kodRUIAN")
                    if code:
                        layer_codes[layer].add(int(code))
                # fall back to the legal entity address
                if not places:
                    code = (entity.get("adresa") or {}).get("kodRUIAN")
                    if code:
                        layer_codes[layer].add(int(code))

    all_codes = set().union(*layer_codes.values())
    coords = geocode_codes(all_codes)

    _country_cache = {
        layer: [coords[c] for c in codes if c in coords]
        for layer, codes in layer_codes.items()
    }
    return _country_cache


def fetch_msmt_pois(
    layer: str,
    bbox: tuple[float, float, float, float] = (49.94, 14.22, 50.18, 14.71),
) -> list[tuple[float, float]]:
    """Return list of (lat, lon) for schools or kindergartens within bbox."""
    if layer not in LAYER_DRUH:
        raise ValueError(f"Unknown layer: {layer!r}. Valid: {list(LAYER_DRUH)}")

    south, west, north, east = bbox
    return [
        (lat, lon)
        for lat, lon in _build_country_cache()[layer]
        if south <= lat <= north and west <= lon <= east
    ]
