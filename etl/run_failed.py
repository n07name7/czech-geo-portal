import sys
from main import main, LAYERS

# Keep only the layers that failed
failed_names = ["shops"]
LAYERS[:] = [l for l in LAYERS if l["name"] in failed_names]

if __name__ == "__main__":
    print("Running ONLY failed layers:", failed_names)
    main(dry_run=True)
