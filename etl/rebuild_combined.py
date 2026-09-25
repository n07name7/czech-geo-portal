import json
from pathlib import Path
from pmtiles.reader import Reader, MmapSource
from src.score.pmtiles_writer import build_combined_pmtiles

DIR = Path("output/cities")
LAYERS = ["schools", "kindergartens", "playgrounds", "clinics", "pharmacies", 
          "transport", "parks", "sports", "shops", "quiet", "safety", "highschool", "air"]

combined = {}

for layer in LAYERS:
    p = DIR / f"{layer}.pmtiles"
    if not p.exists(): continue
    print(f"Reading {layer}...")
    with open(p, "rb") as f:
        reader = Reader(MmapSource(f))
        for tile, tile_data in reader.tiles():
            # Wait, pmtiles python library doesn't easily expose the raw vector data decoding
            pass

