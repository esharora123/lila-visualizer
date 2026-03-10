import pandas as pd
import pyarrow.parquet as pq
import os
from pathlib import Path
from collections import defaultdict

# ── CONFIG ──────────────────────────────────────────────
# Path to your player_data folder
DATA_DIR = Path(r"D:\player_data\player_data")

DAYS = ["February_10", "February_11", "February_12", "February_13", "February_14"]

# ── HELPERS ─────────────────────────────────────────────
def is_human(user_id: str) -> bool:
    """UUIDs = humans, numeric = bots"""
    return "-" in str(user_id)

def load_file(filepath):
    try:
        df = pq.read_table(filepath).to_pandas()
        df['event'] = df['event'].apply(
            lambda x: x.decode('utf-8') if isinstance(x, bytes) else x
        )
        return df
    except Exception as e:
        return None

# ── MAIN EXPLORATION ────────────────────────────────────
def explore():
    print("\n" + "="*55)
    print("   LILA BLACK — DATA EXPLORER")
    print("="*55)

    all_files = []
    for day in DAYS:
        day_path = DATA_DIR / day
        if not day_path.exists():
            print(f"  ⚠️  Folder not found: {day_path}")
            continue
        files = list(day_path.iterdir())
        all_files.extend([(day, f) for f in files])
        print(f"  📁 {day}: {len(files)} files found")

    print(f"\n  Total files: {len(all_files)}")

    # ── Sample 50 files for speed ──
    print("\n  Loading sample data (50 files)...")
    import random
    sample = random.sample(all_files, min(50, len(all_files)))

    frames = []
    for day, filepath in sample:
        df = load_file(filepath)
        if df is not None:
            df['day'] = day
            frames.append(df)

    if not frames:
        print("  ❌ No files loaded. Check your DATA_DIR path.")
        return

    data = pd.concat(frames, ignore_index=True)
    print(f"  ✅ Loaded {len(data):,} rows from {len(frames)} files")

    # ── Map breakdown ──
    print("\n" + "-"*55)
    print("  MAP BREAKDOWN")
    print("-"*55)
    map_counts = data['map_id'].value_counts()
    for map_name, count in map_counts.items():
        pct = count / len(data) * 100
        bar = "█" * int(pct / 3)
        print(f"  {map_name:<20} {bar} {pct:.1f}%")

    # ── Event breakdown ──
    print("\n" + "-"*55)
    print("  EVENT TYPE BREAKDOWN")
    print("-"*55)
    event_counts = data['event'].value_counts()
    for event, count in event_counts.items():
        pct = count / len(data) * 100
        print(f"  {event:<20} {count:>7,} rows  ({pct:.1f}%)")

    # ── Human vs Bot ──
    print("\n" + "-"*55)
    print("  HUMAN vs BOT")
    print("-"*55)
    data['is_human'] = data['user_id'].apply(lambda x: is_human(str(x)))
    human_rows = data['is_human'].sum()
    bot_rows = len(data) - human_rows
    print(f"  Human rows : {human_rows:,} ({human_rows/len(data)*100:.1f}%)")
    print(f"  Bot rows   : {bot_rows:,}  ({bot_rows/len(data)*100:.1f}%)")

    # ── Match stats ──
    print("\n" + "-"*55)
    print("  MATCH STATS")
    print("-"*55)
    unique_matches = data['match_id'].nunique()
    unique_players = data[data['is_human']]['user_id'].nunique()
    print(f"  Unique matches  : {unique_matches}")
    print(f"  Unique humans   : {unique_players}")
    avg_players = data[data['is_human']].groupby('match_id')['user_id'].nunique().mean()
    print(f"  Avg humans/match: {avg_players:.1f}")

    # ── Find best demo match ──
    print("\n" + "-"*55)
    print("  🎯 BEST DEMO MATCH CANDIDATES")
    print("-"*55)
    
    combat_events = ['Kill', 'Killed', 'BotKill', 'BotKilled', 'KilledByStorm', 'Loot']
    combat_data = data[data['event'].isin(combat_events)]
    
    match_scores = []
    for match_id, group in combat_data.groupby('match_id'):
        score = {
            'match_id': match_id,
            'map': group['map_id'].iloc[0],
            'kills': len(group[group['event'] == 'Kill']),
            'deaths': len(group[group['event'].isin(['Killed', 'BotKilled', 'KilledByStorm'])]),
            'loot': len(group[group['event'] == 'Loot']),
            'human_players': group[group['is_human']]['user_id'].nunique(),
        }
        # Score = more events = better demo
        score['total_events'] = score['kills'] + score['deaths'] + score['loot']
        match_scores.append(score)

    top_matches = sorted(match_scores, key=lambda x: x['total_events'], reverse=True)[:5]
    
    for i, m in enumerate(top_matches, 1):
        print(f"\n  #{i} Match: {m['match_id'][:20]}...")
        print(f"     Map    : {m['map']}")
        print(f"     Humans : {m['human_players']}")
        print(f"     Kills  : {m['kills']}  Deaths: {m['deaths']}  Loot: {m['loot']}")

    print("\n" + "="*55)
    print("="*55 + "\n")

if __name__ == "__main__":
    explore()