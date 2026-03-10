import json
from pathlib import Path

INDEX = Path(r"D:\lila-visualizer\frontend\public\data\matches_index.json")

with open(INDEX) as f:
    matches = json.load(f)

print("\n" + "="*65)
print("  MATCHES WITH MOST HUMANS")
print("="*65)
by_humans = sorted(matches, key=lambda x: x['human_count'], reverse=True)
for m in by_humans[:10]:
    print(f"  {m['map_id']:<15} "
          f"Humans:{m['human_count']:>2}  "
          f"BotKills:{m['bot_kills']:>3}  "
          f"Loot:{m['loot_count']:>3}  "
          f"Storm:{m['storm_deaths']}  "
          f"ID: {m['match_id'][:25]}...")

print("\n" + "="*65)
print("  MATCHES WITH MOST ACTION (bot kills + loot + storm)")
print("="*65)
# Rescore: bot_kills matter more than human kills for demo
for m in matches:
    m['demo_score'] = (m['human_count']*10 + 
                       m['bot_kills']*3 + 
                       m['loot_count'] + 
                       m['storm_deaths']*5)

by_demo = sorted(matches, key=lambda x: x['demo_score'], reverse=True)
for m in by_demo[:10]:
    print(f"  {m['map_id']:<15} "
          f"Humans:{m['human_count']:>2}  "
          f"BotKills:{m['bot_kills']:>3}  "
          f"Loot:{m['loot_count']:>3}  "
          f"Storm:{m['storm_deaths']}  "
          f"Dur:{m['duration_sec']//60}m  "
          f"ID: {m['match_id'][:25]}...")

print("\n" + "="*65)
print("  MAP DISTRIBUTION ACROSS ALL 796 MATCHES")
print("="*65)
from collections import Counter
map_counts = Counter(m['map_id'] for m in matches)
for map_name, count in map_counts.most_common():
    pct = count/len(matches)*100
    bar = "█" * int(pct/3)
    print(f"  {map_name:<15} {bar} {count} matches ({pct:.1f}%)")

print("\n" + "="*65)
print("  OVERALL STATS")
print("="*65)
total_humans = sum(m['human_count'] for m in matches)
total_botkills = sum(m['bot_kills'] for m in matches)
total_loot = sum(m['loot_count'] for m in matches)
total_storm = sum(m['storm_deaths'] for m in matches)
total_kills = sum(m['kills'] for m in matches)
print(f"  Total human players across all matches : {total_humans}")
print(f"  Total human kills (PvP)               : {total_kills}")
print(f"  Total bot kills                        : {total_botkills}")
print(f"  Total loot pickups                     : {total_loot}")
print(f"  Total storm deaths                     : {total_storm}")
max_humans = max(m['human_count'] for m in matches)
print(f"  Max humans in a single match           : {max_humans}")