"""
ETL orchestrator for Czech Geo Portal.

Run:
    python main.py           # full run, uploads to GitHub Releases
    python main.py --dry-run # skips upload (local testing)
    python main.py --city praha  # single city only

Fetches POIs for 8 Czech cities, scores H3 cells per city,
combines into one PMTiles file per layer covering all cities.
"""
import json
import os
import sys
from pathlib import Path

import src.net  # noqa: F401  — force IPv4 (GitHub runners lack IPv6)
from src.fetch.osm import fetch_osm_pois
from src.fetch.msmt import fetch_msmt_pois
from src.fetch.nrpzs import fetch_nrpzs_pois
from src.fetch.gtfs import fetch_gtfs_stops
from src.fetch.noise import fetch_noise_polygons
from src.fetch.crime import fetch_crime_points
from src.fetch.school_quality import fetch_school_quality
from src.fetch.air import fetch_air
from src.fetch.rent import fetch_rent, load_mf_rent
from src.score.h3_scorer import get_city_cells, score_cells, count_cells
from src.score.rent_scorer import score_cells_rent
from src.score.noise_scorer import score_cells_quiet, cell_max_db
from src.score.quality_scorer import score_cells_quality
from src.score.air_scorer import score_cells_air
from src.build.pmtiles import build_pmtiles, build_combined_pmtiles

OUTPUT_DIR = Path("output/cities")
RESOLUTION = 10

# ── City configs ──────────────────────────────────────────────────────────────
# bbox: (south, west, north, east)
CITIES: list[dict] = [
    {
        "id": "praha",
        "name": "Praha",
        "bbox": (49.94, 14.22, 50.18, 14.71),
        "center": [14.437, 50.073],
    },
    {
        "id": "brno",
        "name": "Brno",
        "bbox": (49.1099, 16.4280, 49.2944, 16.7278),
        "center": [16.608, 49.195],
    },
    {
        "id": "ostrava",
        "name": "Ostrava",
        "bbox": (49.7258, 18.0984, 49.9138, 18.3763),
        "center": [18.292, 49.820],
    },
    {
        "id": "plzen",
        "name": "Plzeň",
        "bbox": (49.6792, 13.2680, 49.8058, 13.4758),
        "center": [13.377, 49.738],
    },
    {
        "id": "liberec",
        "name": "Liberec",
        "bbox": (50.7080, 14.9530, 50.8243, 15.1469),
        "center": [15.057, 50.767],
    },
    {
        "id": "olomouc",
        "name": "Olomouc",
        "bbox": (49.5347, 17.1621, 49.6620, 17.3961),
        "center": [17.251, 49.593],
    },
    {
        "id": "ceske_budejovice",
        "name": "České Budějovice",
        "bbox": (48.9334, 14.3869, 49.0199, 14.5952),
        "center": [14.475, 48.975],
    },
    {
        "id": "hradec_kralove",
        "name": "Hradec Králové",
        "bbox": (50.1600, 15.7468, 50.2659, 15.9350),
        "center": [15.832, 50.209],
    },
]

# ── Layer definitions ─────────────────────────────────────────────────────────
LAYERS: list[dict] = [
    {"name": "schools",       "fetcher": lambda bbox: fetch_msmt_pois("schools", bbox)},
    {"name": "kindergartens", "fetcher": lambda bbox: fetch_msmt_pois("kindergartens", bbox)},
    {"name": "playgrounds",   "fetcher": lambda bbox: fetch_osm_pois("playgrounds", bbox)},
    {"name": "clinics",       "fetcher": lambda bbox: fetch_nrpzs_pois("clinics", bbox)},
    {"name": "pharmacies",    "fetcher": lambda bbox: fetch_nrpzs_pois("pharmacies", bbox)},
    {"name": "transport",     "fetcher": lambda bbox: fetch_gtfs_stops(bbox)},
    {"name": "parks",         "fetcher": lambda bbox: fetch_osm_pois("parks", bbox)},
    {"name": "sports",        "fetcher": lambda bbox: fetch_osm_pois("sports", bbox)},
    {"name": "shops",         "fetcher": lambda bbox: fetch_osm_pois("shops", bbox)},
    # zonal layers: fetcher returns polygons, scored by coverage instead of POI count
    {"name": "quiet",         "fetcher": fetch_noise_polygons, "kind": "zonal"},
    # inverted layers: density is bad — score flipped so 1.0 = safest
    {"name": "safety",        "fetcher": fetch_crime_points, "invert": True},
    # quality layer: best nearby secondary school by CERMAT percentile (not a count)
    {"name": "highschool",    "fetcher": fetch_school_quality, "kind": "quality"},
    # air layer: PM2.5 5-year average; score inverted (clean = 1), metric = µg/m³
    {"name": "air",           "fetcher": fetch_air, "kind": "air"},
]


def load_prev_rent(tag: str = "data-latest") -> dict:
    """Last good rent.json from the release, so a source outage or format
    change never silently drops prices from the site."""
    import requests as req
    repo = os.environ.get("GITHUB_REPOSITORY", "n07name7/czech-geo-portal")
    url = f"https://github.com/{repo}/releases/download/{tag}/rent.json"
    try:
        r = req.get(url, timeout=600)
        if r.status_code == 200 and r.content:
            return r.json()
        print(f"  no previous rent.json (HTTP {r.status_code})")
    except Exception as e:
        print(f"  load previous rent.json failed: {e}")
    return {}


def backfill_from_release(filenames: list[str], tag: str = "data-latest") -> None:
    """Download last good assets for things that weren't produced this run.

    The upload recreates the release, so anything not re-uploaded vanishes.
    Pull the previous copy first (filenames include extension).
    """
    import requests as req
    repo = os.environ.get("GITHUB_REPOSITORY", "n07name7/czech-geo-portal")
    base = f"https://github.com/{repo}/releases/download/{tag}"
    for name in filenames:
        dest = OUTPUT_DIR / name
        try:
            r = req.get(f"{base}/{name}", timeout=600)
            if r.status_code == 200 and r.content:
                dest.write_bytes(r.content)
                print(f"  backfilled {name} ({len(r.content)//1024} KB)")
            else:
                print(f"  no previous {name} to backfill (HTTP {r.status_code})")
        except req.RequestException as e:
            print(f"  backfill {name} failed: {e}")


def upload_to_github_release(files: list[Path], tag: str = "data-latest") -> None:
    import requests as req
    token = os.environ["GITHUB_TOKEN"]
    repo = os.environ.get("GITHUB_REPOSITORY", "n07name7/czech-geo-portal")
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    api = "https://api.github.com"

    # Delete ALL releases carrying this tag, including drafts. The previous
    # code used GET /releases/tags/{tag}, which never returns drafts — so
    # draft releases piled up and the public download URL served a stale one.
    page = 1
    while True:
        r = req.get(f"{api}/repos/{repo}/releases",
                    headers=headers, params={"per_page": 100, "page": page})
        r.raise_for_status()
        releases = r.json()
        if not releases:
            break
        for rel in releases:
            if rel.get("tag_name") == tag:
                req.delete(f"{api}/repos/{repo}/releases/{rel['id']}", headers=headers)
        page += 1
    req.delete(f"{api}/repos/{repo}/git/refs/tags/{tag}", headers=headers)

    # target_commitish + draft=false → tag is created on master and the
    # release is published, so releases/download/{tag}/… resolves publicly.
    r = req.post(f"{api}/repos/{repo}/releases", headers=headers, json={
        "tag_name": tag,
        "target_commitish": "master",
        "name": "PMTiles data (auto-updated)",
        "draft": False,
        "prerelease": True,
    })
    r.raise_for_status()
    created = r.json()
    upload_url = created["upload_url"].split("{")[0]
    release_id = created["id"]

    for path in files:
        print(f"  uploading {path.name}...")
        with open(path, "rb") as f:
            r = req.post(
                f"{upload_url}?name={path.name}",
                headers={**headers, "Content-Type": "application/octet-stream"},
                data=f,
            )
            r.raise_for_status()
        print(f"  done -> github:{tag}/{path.name}")

    # Ensure it's published — creating a release right after deleting the tag
    # can leave it as a draft, whose assets 404 on the public download URL.
    req.patch(f"{api}/repos/{repo}/releases/{release_id}",
              headers=headers, json={"draft": False})
    print("  release published")


def main(dry_run: bool = False, only_city: str | None = None) -> None:
    cities = CITIES if not only_city else [c for c in CITIES if c["id"] == only_city]
    if not cities:
        print(f"Unknown city: {only_city}. Valid: {[c['id'] for c in CITIES]}")
        sys.exit(1)

    print(f"Running ETL for: {[c['name'] for c in cities]}\n")

    failed_layers: list[str] = []
    # cell -> {layer_name: score} accumulated across layers for the combined file
    combined: dict[str, dict[str, float]] = {}
    # per-city per-layer mean score, for the PDF "vs city average" comparison
    city_avgs: dict[str, dict[str, float]] = {c["id"]: {} for c in cities}
    for layer in LAYERS:
        layer_name = layer["name"]
        all_scores: dict[str, float] = {}
        # concrete metric per cell: object count (POI/crime) or dB (quiet),
        # stored as `n_<layer>` so the report can show real numbers.
        all_metrics: dict[str, int] = {}

        for city in cities:
            print(f"[{layer_name}] {city['name']}: fetching...")
            try:
                fetched = layer["fetcher"](city["bbox"])
                print(f"  {len(fetched)} objects")
            except Exception as e:
                print(f"  ERROR: {e}")
                continue

            cells = get_city_cells(city["bbox"], RESOLUTION)
            kind = layer.get("kind")
            if kind == "zonal":
                scores = score_cells_quiet(fetched, cells)
                all_metrics.update({c: int(round(db)) for c, db in cell_max_db(fetched, cells).items()})
            elif kind == "quality":
                scores, metric = score_cells_quality(fetched, cells)
                all_metrics.update(metric)
            elif kind == "air":
                scores, metric = score_cells_air(fetched, cells)
                all_metrics.update(metric)
            else:
                counts = count_cells(fetched, cells)
                all_metrics.update(counts)
                max_count = max(counts.values()) if counts else 0
                scores = {c: (n / max_count if max_count else 0.0) for c, n in counts.items()}
                if layer.get("invert"):
                    scores = {c: 1.0 - v for c, v in scores.items()}
            all_scores.update(scores)
            if scores:
                city_avgs[city["id"]][layer_name] = round(sum(scores.values()) / len(scores), 3)
            print(f"  {len(cells)} cells scored")

        # A source outage must not wipe a layer: skip the build and keep
        # the previous release file rather than overwriting with nothing.
        if not all_scores:
            print(f"[{layer_name}] no data fetched — keeping previous file, SKIP\n")
            failed_layers.append(layer_name)
            continue

        for cell, score in all_scores.items():
            entry = combined.setdefault(cell, {})
            entry[layer_name] = score
            entry[f"n_{layer_name}"] = all_metrics.get(cell, 0)

        out = OUTPUT_DIR / f"{layer_name}.pmtiles"
        print(f"[{layer_name}] building PMTiles ({len(all_scores)} cells) -> {out}")
        build_pmtiles(all_scores, out)
        print(f"  {out.stat().st_size // 1024} KB\n")

    # Rent level per cell (CZK/m²) from MF ČR cenová mapa joined to k.ú.
    # polygons. Informational, not a scored layer. To make sure a MF outage or
    # format change never silently drops prices, fresh values are overlaid on
    # the last good rent.json from the release — a failed source keeps the
    # previous prices instead of vanishing.
    RENT_SOURCE = "MF ČR – cenová mapa nájemního bydlení"
    prev_rent = load_prev_rent()
    rent_cells: dict[str, int] = {}
    rent_cities: dict[str, int] = {}
    rent_quarter: str | None = None
    try:
        _, rent_quarter = load_mf_rent()
        mf_ok = True
    except Exception as e:
        print(f"[rent] MF cenová mapa unavailable ({e}) — using last good prices")
        mf_ok = False
    if mf_ok:
        for city in cities:
            try:
                areas, rent_quarter = fetch_rent(city["bbox"])
            except Exception as e:
                print(f"[rent] {city['name']} ERROR: {e}")
                continue
            cell_rent = score_cells_rent(areas, get_city_cells(city["bbox"], RESOLUTION))
            rent_cells.update(cell_rent)
            vals = sorted(cell_rent.values())
            if vals:
                rent_cities[city["id"]] = vals[len(vals) // 2]
            print(f"[rent] {city['name']}: {len(areas)} k.ú., {len(cell_rent)} cells")

    # Overlay fresh on last good (string cell keys merge cleanly).
    final_cells = {**prev_rent.get("cells", {}), **rent_cells}
    final_cities = {**prev_rent.get("cities", {}), **rent_cities}
    final_quarter = rent_quarter or (prev_rent.get("meta") or {}).get("rentQuarter")
    if final_cells:
        for cell, rent in final_cells.items():
            if cell in combined:
                combined[cell]["rent"] = rent
        for cid, med in final_cities.items():
            if cid in city_avgs:
                city_avgs[cid]["rent"] = med
        if final_quarter:
            city_avgs["_meta"] = {"rentQuarter": final_quarter, "rentSource": RENT_SOURCE}
        (OUTPUT_DIR / "rent.json").write_text(json.dumps({
            "cells": final_cells, "cities": final_cities,
            "meta": {"rentQuarter": final_quarter, "rentSource": RENT_SOURCE},
        }))
        print(f"[rent] {len(final_cells)} cells, quarter {final_quarter} "
              f"({'fresh' if rent_cells else 'last-good fallback'})")

    # Combined dataset for the weighted "match" mode (every layer score per
    # cell). Only rebuild it when ALL layers succeeded — a partial combined
    # (missing a failed layer) would make the report show that layer as 0.
    # On a partial run, keep the previous complete combined (backfilled below).
    if combined and not failed_layers:
        out = OUTPUT_DIR / "combined.pmtiles"
        print(f"[combined] building PMTiles ({len(combined)} cells) -> {out}")
        build_combined_pmtiles(combined, out)
        print(f"  {out.stat().st_size // 1024} KB\n")
    elif failed_layers:
        print("[combined] some layers failed — keeping previous combined.pmtiles\n")

    # City averages for the PDF comparison (only on a complete run)
    import json as _json
    avg_path = OUTPUT_DIR / "averages.json"
    if not failed_layers:
        avg_path.write_text(_json.dumps(city_avgs))
        print(f"[averages] wrote {avg_path} ({len(city_avgs)} cities)")

    if failed_layers:
        print(f"WARNING: layers with no data this run: {failed_layers}")
    print("All layers done.")

    if not dry_run:
        # On a partial run, restore the previous combined/averages too, so the
        # published data stays internally consistent (the upload recreates the
        # release, dropping anything not re-uploaded).
        backfill = [f"{n}.pmtiles" for n in failed_layers]
        if failed_layers:
            # keep rent.json in sync with the combined we're keeping
            backfill += ["combined.pmtiles", "averages.json", "rent.json"]
        if backfill:
            print(f"\nBackfilling from previous release: {backfill}")
            backfill_from_release(backfill)

        print("\nUploading to GitHub Releases...")
        names = [l["name"] for l in LAYERS] + ["combined"]
        files = [OUTPUT_DIR / f"{n}.pmtiles" for n in names
                 if (OUTPUT_DIR / f"{n}.pmtiles").exists()]
        if avg_path.exists():
            files.append(avg_path)
        rent_path = OUTPUT_DIR / "rent.json"
        if rent_path.exists():
            files.append(rent_path)
        upload_to_github_release(files)
        print("Upload complete.")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    only_city = next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == "--city"), None)
    main(dry_run=dry_run, only_city=only_city)
