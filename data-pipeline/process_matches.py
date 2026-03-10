import pandas as pd
import pyarrow.parquet as pq
import os, json
from pathlib import Path

# ── CONFIG ──────────────────────────────────────────────
DATA_DIR = Path(r"D:\player_data\player_data")
OUTPUT_DIR  = Path(r"D:\lila-visualizer\frontend\public\data\matches")
INDEX_FILE  = Path(r"D:\lila-visualizer\frontend\public\data\matches_index.json")
DAYS        = ["February_10","February_11","February_12","February_13","February_14"]

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def is_human(user_id):
    return "-" in str(user_id)

def load_file(filepath):
    try:
        df = pq.read_table(filepath).to_pandas()
        df['event'] = df['event'].apply(
            lambda x: x.decode('utf-8') if isinstance(x, bytes) else x
        )
        return df
    except:
        return None

def ts_to_ms(ts_val):
    """Convert timestamp to milliseconds integer safely"""
    try:
        ts = pd.Timestamp(ts_val)
        # Try nanoseconds first (pandas default)
        ns = ts.value
        if ns > 0:
            return int(ns // 1_000_000)
        # Fallback: use total seconds
        return int(ts.timestamp() * 1000)
    except:
        return 0

# ── BUILD FILE INDEX: match_id → list of filepaths ──────
def build_file_map():
    print("  Scanning all files...")
    file_map = {}  # clean_match_id → [filepath, ...]
    
    for day in DAYS:
        day_path = DATA_DIR / day
        if not day_path.exists():
            continue
        for filepath in day_path.iterdir():
            # Peek at match_id from filename
            # Format: {user_id}_{match_id}.nakama-0
            name = filepath.name
            parts = name.split('_', 1)
            if len(parts) < 2:
                continue
            # match_id part (everything after first _), strip .nakama-0
            raw_match = parts[1].replace('.nakama-0', '')
            if raw_match not in file_map:
                file_map[raw_match] = []
            file_map[raw_match].append(filepath)
    
    print(f"  Found {len(file_map)} unique matches")
    return file_map

# ── PROCESS ONE MATCH ────────────────────────────────────
def process_match(match_id, filepaths):
    all_dfs = []
    for fp in filepaths:
        df = load_file(fp)
        if df is not None and len(df) > 0:
            all_dfs.append(df)

    if not all_dfs:
        return None

    combined = pd.concat(all_dfs, ignore_index=True)

    # ── Players ──
    humans = combined[combined['user_id'].apply(
        lambda x: is_human(str(x)))]['user_id'].unique()
    bots = combined[~combined['user_id'].apply(
        lambda x: is_human(str(x)))]['user_id'].unique()

    HUMAN_COLORS = ['#00d4ff','#ff6b35','#7fff00','#ff00ff',
                    '#ffd700','#ff1493','#00ff9f','#ff4444']
    players = []
    color_map = {}

    for i, uid in enumerate(humans):
        color = HUMAN_COLORS[i % len(HUMAN_COLORS)]
        color_map[str(uid)] = color
        players.append({'user_id': str(uid), 'is_human': True, 'color': color})
    for uid in bots:
        color_map[str(uid)] = '#888888'
        players.append({'user_id': str(uid), 'is_human': False, 'color': '#888888'})

    # ── Normalize timestamps to 0 → TIMELINE_MS range ──
    # Raw timestamps span milliseconds — we stretch to 5 minutes
    # so playback feels natural in the browser
    TIMELINE_MS = 300_000  # 5 minutes visual timeline

    def raw_ms(ts_val):
        """Get raw ms value from timestamp"""
        try:
            return int(pd.Timestamp(ts_val).value // 1_000_000)
        except:
            return 0

    all_ts_raw = combined['ts'].dropna().apply(raw_ms)
    ts_min = all_ts_raw.min()
    ts_max = all_ts_raw.max()
    ts_range = ts_max - ts_min if ts_max > ts_min else 1

    def normalize_ts(ts_val):
        """Normalize raw timestamp to 0-TIMELINE_MS range"""
        raw = raw_ms(ts_val)
        return int(((raw - ts_min) / ts_range) * TIMELINE_MS)

    # ── Positions ──
    pos_events = ['Position', 'BotPosition']
    pos_df = combined[combined['event'].isin(pos_events)].copy()

    positions = []
    for _, row in pos_df.iterrows():
        positions.append({
            'user_id': str(row['user_id']),
            'x':       round(float(row['x']), 2),
            'z':       round(float(row['z']), 2),
            'ts_ms':   normalize_ts(row['ts']),
        })

    # ── Events ──
    special_events = ['Kill','Killed','BotKill','BotKilled',
                      'KilledByStorm','Loot']
    ev_df = combined[combined['event'].isin(special_events)].copy()

    events = []
    for _, row in ev_df.iterrows():
        events.append({
            'user_id': str(row['user_id']),
            'event':   row['event'],
            'x':       round(float(row['x']), 2),
            'z':       round(float(row['z']), 2),
            'ts_ms':   normalize_ts(row['ts']),
        })

    map_id = combined['map_id'].iloc[0]

    return {
        'match_id': match_id,
        'map_id':   map_id,
        'meta': {
            'map_id':        map_id,
            'duration_ms':   TIMELINE_MS,
            'human_count':   len(humans),
            'bot_count':     len(bots),
            'kill_count':    len(combined[combined['event']=='Kill']),
            'botkill_count': len(combined[combined['event']=='BotKill']),
            'loot_count':    len(combined[combined['event']=='Loot']),
            'storm_deaths':  len(combined[combined['event']=='KilledByStorm']),
        },
        'players':   players,
        'positions': positions,
        'events':    events,
    }

# ── MAIN ─────────────────────────────────────────────────
def main():
    print("\n" + "="*55)
    print("  PROCESSING ALL MATCH FILES")
    print("="*55)

    file_map = build_file_map()
    
    success = 0
    skipped = 0

    for i, (match_id, filepaths) in enumerate(file_map.items()):
        result = process_match(match_id, filepaths)
        
        if result is None:
            skipped += 1
            continue
        
        # Save to JSON
        out_path = OUTPUT_DIR / f"{match_id}.json"
        with open(out_path, 'w') as f:
            json.dump(result, f)  # no indent = smaller file
        
        success += 1

        # Progress
        if (i + 1) % 100 == 0:
            print(f"  → {i+1}/{len(file_map)} matches done...")

    print(f"\n{'='*55}")
    print(f"  ✅ Done!")
    print(f"     Matches saved  : {success}")
    print(f"     Skipped        : {skipped}")
    print(f"     Output folder  : {OUTPUT_DIR}")
    
    # Check our hero match
    hero = OUTPUT_DIR / "b3550292-8f80-493a-a422-9e95b2f8fe03.json"
    # find it (we only have first 25 chars)
    hero_files = list(OUTPUT_DIR.glob("b3550292*.json"))
    if hero_files:
        with open(hero_files[0]) as f:
            h = json.load(f)
        print(f"\n  🎯 HERO MATCH VERIFIED:")
        print(f"     Map      : {h['meta']['map_id']}")
        print(f"     Duration : {h['meta']['duration_ms']//1000}s")
        print(f"     Humans   : {h['meta']['human_count']}")
        print(f"     Bots     : {h['meta']['bot_count']}")
        print(f"     BotKills : {h['meta']['botkill_count']}")
        print(f"     Loot     : {h['meta']['loot_count']}")
        print(f"     Positions: {len(h['positions'])}")
        print(f"     Events   : {len(h['events'])}")
    print(f"{'='*55}\n")

if __name__ == "__main__":
    main()