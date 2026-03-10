import pandas as pd
import pyarrow.parquet as pq
import json, math
from pathlib import Path
from collections import defaultdict

# ── CONFIG ──────────────────────────────────────────────
DATA_DIR = Path(r"D:\player_data\player_data")
OUTPUT_DIR = Path(r"D:\lila-visualizer\frontend\public\data\heatmaps")
DAYS       = ["February_10","February_11","February_12","February_13","February_14"]

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Grid resolution — 64x64 cells over 1024x1024 minimap
# Each cell = 16x16 pixels
GRID_SIZE = 64

MAP_CONFIG = {
    'AmbroseValley': {'scale': 900,  'origin_x': -370, 'origin_z': -473},
    'GrandRift':     {'scale': 581,  'origin_x': -290, 'origin_z': -290},
    'Lockdown':      {'scale': 1000, 'origin_x': -500, 'origin_z': -500},
}

def is_human(user_id):
    return "-" in str(user_id)

def world_to_grid(x, z, map_id):
    """Convert world coords to grid cell (0 to GRID_SIZE-1)"""
    cfg = MAP_CONFIG[map_id]
    u = (x - cfg['origin_x']) / cfg['scale']
    v = (z - cfg['origin_z']) / cfg['scale']
    gx = int(u * GRID_SIZE)
    gy = int((1 - v) * GRID_SIZE)
    # Clamp to grid bounds
    gx = max(0, min(GRID_SIZE - 1, gx))
    gy = max(0, min(GRID_SIZE - 1, gy))
    return gx, gy

def load_file(filepath):
    try:
        df = pq.read_table(filepath).to_pandas()
        df['event'] = df['event'].apply(
            lambda x: x.decode('utf-8') if isinstance(x, bytes) else x
        )
        return df
    except:
        return None

def build_heatmaps():
    print("\n" + "="*55)
    print("  BUILDING HEATMAPS")
    print("="*55)
    print(f"  Grid resolution: {GRID_SIZE}x{GRID_SIZE} cells")

    # One grid per map per heatmap type
    # grid[map_id][type][(gx,gy)] = count
    grids = {
        map_id: {
            'kills':   defaultdict(int),  # BotKill + Kill
            'deaths':  defaultdict(int),  # Killed + BotKilled + KilledByStorm
            'loot':    defaultdict(int),  # Loot
            'traffic': defaultdict(int),  # Position (human only)
            'storm':   defaultdict(int),  # KilledByStorm specifically
        }
        for map_id in MAP_CONFIG
    }

    files_processed = 0

    for day in DAYS:
        day_path = DATA_DIR / day
        if not day_path.exists():
            continue

        files = list(day_path.iterdir())
        print(f"\n  📁 {day} ({len(files)} files)...")

        for i, filepath in enumerate(files):
            df = load_file(filepath)
            if df is None or len(df) == 0:
                continue

            map_id = df['map_id'].iloc[0]
            if map_id not in grids:
                continue

            files_processed += 1

            for _, row in df.iterrows():
                try:
                    x = float(row['x'])
                    z = float(row['z'])
                    event = row['event']
                    gx, gy = world_to_grid(x, z, map_id)
                    cell = (gx, gy)

                    if event in ('Kill', 'BotKill'):
                        grids[map_id]['kills'][cell] += 1

                    elif event in ('Killed', 'BotKilled', 'KilledByStorm'):
                        grids[map_id]['deaths'][cell] += 1
                        if event == 'KilledByStorm':
                            grids[map_id]['storm'][cell] += 1

                    elif event == 'Loot':
                        grids[map_id]['loot'][cell] += 1

                    elif event == 'Position':
                        if is_human(str(row['user_id'])):
                            grids[map_id]['traffic'][cell] += 1

                except (ValueError, TypeError):
                    continue

            if (i + 1) % 100 == 0:
                print(f"    → {i+1}/{len(files)} done...")

    # ── Save one JSON per map ──────────────────────────
    print(f"\n  Saving heatmap JSONs...")

    for map_id, types in grids.items():
        output = {'map_id': map_id, 'grid_size': GRID_SIZE, 'layers': {}}

        for layer_name, grid in types.items():
            if not grid:
                output['layers'][layer_name] = []
                continue

            max_val = max(grid.values()) if grid else 1

            # Normalize to 0-1 and output as flat array
            # Each entry: [gx, gy, normalized_intensity]
            cells = []
            for (gx, gy), count in grid.items():
                intensity = round(count / max_val, 4)
                if intensity > 0.05:  # skip near-zero cells
                    cells.append([gx, gy, intensity])

            # Sort by intensity descending
            cells.sort(key=lambda c: c[2], reverse=True)
            output['layers'][layer_name] = cells

            # Stats
            total = sum(grid.values())
            hottest = max(grid.values()) if grid else 0
            print(f"    {map_id:<15} {layer_name:<10} "
                  f"cells:{len(cells):>5}  "
                  f"total_events:{total:>6}  "
                  f"hottest_cell:{hottest}")

        out_path = OUTPUT_DIR / f"{map_id}.json"
        with open(out_path, 'w') as f:
            json.dump(output, f)

        print(f"  ✅ Saved {map_id}.json")

    print(f"\n{'='*55}")
    print(f"  ✅ Heatmaps complete!")
    print(f"     Files processed : {files_processed}")
    print(f"     Output folder   : {OUTPUT_DIR}")
    print(f"\n  📊 PM INSIGHT:")

    # Find hottest zones
    for map_id in MAP_CONFIG:
        traffic = grids[map_id]['traffic']
        if traffic:
            hottest_cell = max(traffic, key=traffic.get)
            pct_coverage = len(traffic) / (GRID_SIZE * GRID_SIZE) * 100
            print(f"  {map_id}: players used "
                  f"{pct_coverage:.1f}% of map area")
    print(f"{'='*55}\n")

if __name__ == "__main__":
    build_heatmaps()