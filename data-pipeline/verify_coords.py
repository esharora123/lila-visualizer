import pandas as pd
import pyarrow.parquet as pq
from pathlib import Path
import os
from PIL import Image, ImageDraw
import random

# ── CONFIG ──────────────────────────────────────────────
DATA_DIR = Path(r"D:\player_data\player_data")
MINIMAP_DIR = Path(r"D:\lila-visualizer\frontend\public\minimaps")

MAP_CONFIG = {
    'AmbroseValley': {'scale': 900, 'origin_x': -370, 'origin_z': -473},
    'GrandRift':     {'scale': 581, 'origin_x': -290, 'origin_z': -290},
    'Lockdown':      {'scale': 1000,'origin_x': -500, 'origin_z': -500},
}

MINIMAP_FILES = {
    'AmbroseValley': 'AmbroseValley_Minimap.png',
    'GrandRift':     'GrandRift_Minimap.png',
    'Lockdown':      'Lockdown_Minimap.jpg',
}

# ── COORDINATE CONVERSION ───────────────────────────────
def world_to_pixel(x, z, map_id):
    cfg = MAP_CONFIG[map_id]
    u = (x - cfg['origin_x']) / cfg['scale']
    v = (z - cfg['origin_z']) / cfg['scale']
    px = u * 1024
    py = (1 - v) * 1024
    return int(px), int(py)

# ── LOAD ONE MATCH WORTH OF DATA ────────────────────────
def load_match_for_map(target_map):
    """Find files for a specific map and load one match"""
    day_path = DATA_DIR / "February_10"
    files = list(day_path.iterdir())
    random.shuffle(files)
    
    for filepath in files[:100]:
        try:
            df = pq.read_table(filepath).to_pandas()
            df['event'] = df['event'].apply(
                lambda x: x.decode('utf-8') if isinstance(x, bytes) else x
            )
            if df['map_id'].iloc[0] == target_map:
                match_id = df['match_id'].iloc[0]
                print(f"  Found {target_map} match: {match_id[:30]}...")
                return df, match_id
        except:
            continue
    return None, None

# ── DRAW PLAYERS ON MINIMAP ─────────────────────────────
def draw_verification(map_id):
    print(f"\n  Drawing {map_id}...")
    
    minimap_path = MINIMAP_DIR / MINIMAP_FILES[map_id]
    if not minimap_path.exists():
        print(f"  ❌ Minimap not found: {minimap_path}")
        print(f"     Please copy minimap images to: {MINIMAP_DIR}")
        return
    
    df, match_id = load_match_for_map(map_id)
    if df is None:
        print(f"  ❌ No {map_id} match found in February_10")
        return
    
    # Open minimap
    img = Image.open(minimap_path).convert('RGBA')
    img = img.resize((1024, 1024))
    draw = ImageDraw.Draw(img)
    
    # Plot position events only
    positions = df[df['event'] == 'Position'].head(200)
    bot_positions = df[df['event'] == 'BotPosition'].head(100)
    
    # Draw human trail (blue dots)
    for _, row in positions.iterrows():
        px, py = world_to_pixel(row['x'], row['z'], map_id)
        if 0 <= px <= 1024 and 0 <= py <= 1024:
            draw.ellipse([px-3, py-3, px+3, py+3], fill=(0, 150, 255, 200))
    
    # Draw bot trail (gray dots)
    for _, row in bot_positions.iterrows():
        px, py = world_to_pixel(row['x'], row['z'], map_id)
        if 0 <= px <= 1024 and 0 <= py <= 1024:
            draw.ellipse([px-2, py-2, px+2, py+2], fill=(180, 180, 180, 150))
    
    # Draw special events
    event_colors = {
        'Kill':           (255, 50,  50,  255),   # red
        'Killed':         (255, 150, 0,   255),   # orange
        'BotKill':        (200, 0,   200, 255),   # purple
        'KilledByStorm':  (0,   255, 255, 255),   # cyan
        'Loot':           (50,  255, 50,  255),   # green
    }
    
    special = df[df['event'].isin(event_colors.keys())]
    for _, row in special.iterrows():
        px, py = world_to_pixel(row['x'], row['z'], map_id)
        if 0 <= px <= 1024 and 0 <= py <= 1024:
            color = event_colors[row['event']]
            draw.ellipse([px-6, py-6, px+6, py+6], fill=color, outline=(255,255,255,255))
    
    # Save
    out_path = Path(r"D:\lila-visualizer") / f"verify_{map_id}.png"
    img.save(out_path)
    
    positions_plotted = len([_ for _, row in positions.iterrows() 
                             if 0 <= world_to_pixel(row['x'], row['z'], map_id)[0] <= 1024])
    print(f"  ✅ Saved: {out_path}")
    print(f"     Human positions plotted : {len(positions)}")
    print(f"     Bot positions plotted   : {len(bot_positions)}")
    print(f"     Special events          : {len(special)}")

# ── MAIN ────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "="*55)
    print("  COORDINATE VERIFICATION")
    print("="*55)
    
    # First install Pillow if needed
    try:
        from PIL import Image
    except ImportError:
        print("  Installing Pillow...")
        os.system("pip install Pillow")
        from PIL import Image, ImageDraw
    
    for map_id in ['AmbroseValley', 'GrandRift', 'Lockdown']:
        draw_verification(map_id)
    
    print("\n" + "="*55)
    print("  CHECK the 3 PNG files in D:\\lila-visualizer\\")
    print("  Do the dots appear ON the map terrain?")
    print("  If yes → coordinate math is CORRECT ✅")
    print("  If dots are in black corners → math needs fixing")
    print("="*55)