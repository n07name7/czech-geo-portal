"""Shared loader for the MŠMT school registry (RSSZ, full-country JSON-LD).

Both the school/kindergarten layer (msmt.py) and the secondary-school
quality layer (school_quality.py) read this 31 MB dump — load it once.
"""
import requests

REGISTRY_URL = (
    "https://lkod-ftp.msmt.gov.cz/00022985/"
    "88a7c12b-6084-4e47-8b50-46097c6e683f/RSSZ-cela-CR.jsonld"
)

_registry: list[dict] | None = None


def load_registry() -> list[dict]:
    """Return the list of legal entities (each with skolyAZarizeni)."""
    global _registry
    if _registry is None:
        _registry = requests.get(REGISTRY_URL, timeout=600).json().get("list", [])
    return _registry
