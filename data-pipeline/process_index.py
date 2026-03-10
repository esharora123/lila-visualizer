import pandas as pd
import pyarrow.parquet as pq
import os, json
from pathlib import Path
from datetime import datetime

# ── CONFIG ──────────────────────────────────────────────
DATA_DIR = Path(r"D:\player_data\player_data")
OUTPUT_FILE = Path(r"D:\lila-visualizer\frontend\public\data\matches_index.json")
DAYS = ["February_10","February_11","February_12","February_13","February_14"]

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

# ── MAIN ────────────────────────────────────────────────
def build_index():
    print("\n" + "="*55)
    print("  BUILDING MATCHES INDEX")
    print("="*55)

    # match_id → aggregated info
    matches = {}
    total_files = 0

    for day in DAYS:
        day_path = DATA_DIR / day
        if not day_path.exists():
            print(f"  ⚠️  Skipping {day} — folder not found")
            continue

        files = list(day_path.iterdir())
        print(f"\n  📁 Processing {day} ({len(files)} files)...")

        for i, filepath in enumerate(files):
            df = load_file(filepath)
            if df is None or len(df) == 0:
                continue

            total_files += 1
            match_id = df['match_id'].iloc[0]
            # strip .nakama-0 suffix for cleaner IDs
            clean_match_id = match_id.replace('.nakama-0', '')
            map_id   = df['map_id'].iloc[0]

            if clean_match_id not in matches:
                matches[clean_match_id] = {
                    'match_id':      clean_match_id,
                    'map_id':        map_id,
                    'day':           day,
                    'human_players': set(),
                    'bot_players':   set(),
                    'kills':         0,
                    'bot_kills':     0,
                    'deaths':        0,
                    'storm_deaths':  0,
                    'loot_count':    0,
                    'ts_min':        None,
                    'ts_max':        None,
                }

            m = matches[clean_match_id]

            # Players
            uid = str(df['user_id'].iloc[0])
            if is_human(uid):
                m['human_players'].add(uid)
            else:
                m['bot_players'].add(uid)

            # Events
            events = df['event'].value_counts().to_dict()
            m['kills']        += events.get('Kill', 0)
            m['bot_kills']    += events.get('BotKill', 0)
            m['deaths']       += events.get('Killed', 0) + events.get('BotKilled', 0)
            m['storm_deaths'] += events.get('KilledByStorm', 0)
            m['loot_count']   += events.get('Loot', 0)

            # Timestamps → match duration
            ts_vals = df['ts'].dropna()
            if len(ts_vals) > 0:
                ts_min = ts_vals.min()
                ts_max = ts_vals.max()
                if m['ts_min'] is None or ts_min < m['ts_min']:
                    m['ts_min'] = ts_min
                if m['ts_max'] is None or ts_max > m['ts_max']:
                    m['ts_max'] = ts_max

            # Progress
            if (i + 1) % 50 == 0:
                print(f"    → {i+1}/{len(files)} files done...")

    # ── Serialize & clean up ──
    print(f"\n  Finalizing {len(matches)} matches...")
    output = []
    for mid, m in matches.items():
        # Duration in seconds
        duration_sec = 0
        if m['ts_min'] is not None and m['ts_max'] is not None:
            duration_sec = int(
                (m['ts_max'] - m['ts_min']).total_seconds()
            )

        output.append({
            'match_id':      m['match_id'],
            'map_id':        m['map_id'],
            'day':           m['day'],
            'human_count':   len(m['human_players']),
            'bot_count':     len(m['bot_players']),
            'kills':         m['kills'],
            'bot_kills':     m['bot_kills'],
            'deaths':        m['deaths'],
            'storm_deaths':  m['storm_deaths'],
            'loot_count':    m['loot_count'],
            'duration_sec':  duration_sec,
            # activity score for sorting
            'activity_score': m['kills']*3 + m['loot_count'] + m['storm_deaths']*2
        })

    # Sort by activity (most interesting matches first)
    output.sort(key=lambda x: x['activity_score'], reverse=True)

    # Save
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n{'='*55}")
    print(f"  ✅ Index built!")
    print(f"     Total files processed : {total_files}")
    print(f"     Total unique matches  : {len(output)}")
    print(f"     Output: {OUTPUT_FILE}")
    print(f"\n  🏆 TOP 5 MOST ACTIVE MATCHES:")
    for i, m in enumerate(output[:5], 1):
        print(f"  #{i} {m['map_id']:<15} "
              f"Humans:{m['human_count']} "
              f"Kills:{m['kills']} "
              f"Loot:{m['loot_count']} "
              f"Storm:{m['storm_deaths']}")
    print(f"{'='*55}\n")

if __name__ == "__main__":
    build_index()