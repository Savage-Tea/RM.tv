#!/usr/bin/env python3
"""
Import RoboMaster 2015-2025 historical match data from CSV into PostgreSQL.

Data source: RoboMaster 2015-2025 赛果记录.xlsx (converted to CSV)
The CSV has columns: 序号,赛季,赛区,赛次,比赛阶段,红方学校,红队名,蓝方学校,蓝队名,红方比分,蓝方比分,备注

Key rules:
- Team names are normalized by school (latest/most common name per school)
- Missing/broken scores default to 0:0
- Empty rows, byes, and non-match entries are skipped
- Events: one per season ("RMUC 20XX")
- Stages: per season + region + stage_name
"""

import csv
import hashlib
import os
import re
import sys
import uuid
from collections import defaultdict
from datetime import date

import psycopg2
from psycopg2.extras import execute_values

DB_URL = os.environ.get("DATABASE_URL", "postgresql://rmtv:rmtv_dev@localhost:5432/rmtv")

CSV_PATH = "/tmp/rm_sheets/2015-2025赛果全记录.csv"
TEAMS_2026_PATH = "/tmp/rm_sheets/2026分区赛名单.csv"


def stable_uuid(*parts):
    s = "|".join(str(p) for p in parts)
    h = hashlib.md5(s.encode()).hexdigest()
    return str(uuid.UUID(h))


def clean(val):
    """Clean and normalize a string value."""
    if val is None:
        return ""
    s = str(val).strip()
    # Replace non-breaking spaces and other whitespace
    s = s.replace(" ", " ").replace("\xa0", " ")
    # Collapse multiple spaces
    s = re.sub(r"\s+", " ", s)
    # Replace full-width hyphens with regular hyphen
    s = s.replace("–", "-").replace("—", "-")
    return s


def parse_score(val):
    """Parse score value. Default to 0 for missing/broken scores."""
    val = clean(val)
    if val in ("", "-", "?", "??", "不明"):
        return 0
    try:
        # Some scores have decimal points (e.g. "0.5")
        return int(float(val))
    except (ValueError, TypeError):
        return 0


def build_team_mapping():
    """
    Build school -> canonical team name mapping.
    Uses 2026 partition list as authoritative reference for current names.
    For schools not in the 2026 list, uses the most recent team name.
    """
    school_to_name = {}

    # First, load 2026 team list as the most current reference
    if os.path.exists(TEAMS_2026_PATH):
        with open(TEAMS_2026_PATH) as f:
            reader = csv.DictReader(f)
            for row in reader:
                school = clean(row.get("学校名称", ""))
                team = clean(row.get("队伍名称", ""))
                if school and team:
                    school_to_name[school] = team

    # Then, load all historical teams, tracking all names per school
    all_school_names = defaultdict(list)  # school -> [(team_name, season)]
    with open(CSV_PATH) as f:
        reader = csv.DictReader(f)
        for row in reader:
            season = clean(row.get("赛季", ""))
            for prefix in ("红方", "蓝方"):
                school = clean(row.get(f"{prefix}学校", ""))
                team = clean(row.get(f"{prefix}队名", ""))
                if school and team and team not in ("", "-", "?"):
                    if (team, season) not in all_school_names[school]:
                        all_school_names[school].append((team, season))

    # For schools not in 2026 list, use the most recent team name
    for school, names in all_school_names.items():
        if school not in school_to_name:
            # Sort by season (descending) to get most recent name
            names_sorted = sorted(names, key=lambda x: x[1] if x[1] else "0", reverse=True)
            school_to_name[school] = names_sorted[0][0]

    # Build reverse mapping: any historical name -> canonical name
    name_to_canonical = {}  # (school, historical_name) -> canonical_name
    for school, names in all_school_names.items():
        canonical = school_to_name.get(school, names[0][0] if names else "")
        for team_name, _ in names:
            key = (school, team_name)
            name_to_canonical[key] = canonical

    return school_to_name, name_to_canonical


def classify_stage(stage_name, region):
    """Classify a stage as group/bracket/final and determine format."""
    stage_name = clean(stage_name)
    region = clean(region)

    # Final stages
    if any(kw in stage_name for kw in ("决赛", "季军", "冠军", "三四名")):
        return "final", "single_elim"

    if "总决赛" in stage_name or ("总决赛" in region and "小组赛" not in stage_name):
        return "final", "single_elim"

    # Group stages
    if "小组赛" in stage_name or "瑞士轮" in stage_name:
        return "group", "round_robin" if "瑞士轮" not in stage_name else "swiss"

    # Repechage / revival
    if "复活" in stage_name or "复活赛" in region:
        return "bracket", "single_elim"

    # Knockout stages
    if any(kw in stage_name for kw in ("淘汰赛", "进", "胜者", "败者", "争夺", "排位", "半决赛")):
        return "bracket", "double_elim" if ("败者" in stage_name or "胜者" in stage_name) else "single_elim"

    # Default
    if "组第" in stage_name:  # e.g., "A组第1轮"
        return "group", "round_robin"

    return "bracket", "single_elim"


def normalize_region(region):
    """Normalize region names."""
    r = clean(region)
    mapping = {
        "东部": "东部赛区",
        "南部": "南部赛区",
        "西部": "西部赛区",
        "北部": "北部赛区",
        "中部": "中部赛区",
        "中区": "中部赛区",
        "南区": "南部赛区",
        "北区": "北部赛区",
        "东北": "东北赛区",
        "华北": "华北赛区",
        "华东": "华东赛区",
        "西北": "西北赛区",
        "西南": "西南赛区",
        "中南": "中南赛区",
        "国际": "国际赛区",
        "国际赛": "国际赛区",
        "港澳台及海外赛区": "港澳台及海外赛区",
        "全国赛": "总决赛",
        "总决赛": "总决赛",
        "复活赛": "复活赛",
        "复活赛第一赛段": "复活赛第一赛段",
        "复活赛第二赛段": "复活赛第二赛段",
        "踢馆赛": "踢馆赛",
        "邀请赛": "邀请赛",
    }
    return mapping.get(r, r)


def import_all():
    print("=" * 60)
    print("RoboMaster 2015-2025 Historical Data Import")
    print("=" * 60)

    # 1. Build team mapping
    print("\n[1/6] Building team name mapping...")
    school_to_name, name_to_canonical = build_team_mapping()
    print(f"  {len(school_to_name)} schools mapped to canonical team names")

    # 2. Parse matches from CSV
    print("\n[2/6] Parsing match data from CSV...")
    matches = []
    skipped_empty = 0
    skipped_bye = 0
    score_defaults = 0

    with open(CSV_PATH) as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Check if row is essentially empty
            vals = [clean(v) for v in row.values()]
            if all(v == "" for v in vals):
                skipped_empty += 1
                continue

            season = clean(row.get("赛季", ""))
            region = normalize_region(clean(row.get("赛区", "")))
            match_num = clean(row.get("赛次", ""))
            stage_name = clean(row.get("比赛阶段", ""))
            red_school = clean(row.get("红方学校", ""))
            red_team = clean(row.get("红队名", ""))
            blue_school = clean(row.get("蓝方学校", ""))
            blue_team = clean(row.get("蓝队名", ""))
            raw_score_a = clean(row.get("红方比分", ""))
            raw_score_b = clean(row.get("蓝方比分", ""))
            note = clean(row.get("备注", ""))

            if not season or not region:
                skipped_empty += 1
                continue

            # Skip byes
            if "轮空" in red_team or "轮空" in blue_team or "轮空" in note:
                skipped_bye += 1
                continue

            # Skip rows with no schools at all (2016 踢馆赛 has many empty rows)
            if not red_school and not blue_school:
                skipped_empty += 1
                continue

            # Parse scores
            score_a = parse_score(raw_score_a)
            score_b = parse_score(raw_score_b)
            if raw_score_a in ("", "-", "?", "??", "不明") or raw_score_b in ("", "-", "?", "??", "不明"):
                score_defaults += 1

            # If schools are empty but teams aren't, try to use the team name
            if not red_school and red_team:
                red_school = red_team
            if not blue_school and blue_team:
                blue_school = blue_team

            if not red_team and not blue_team:
                skipped_empty += 1
                continue

            # Normalize team names to canonical form
            canonical_red = name_to_canonical.get((red_school, red_team), red_team)
            canonical_blue = name_to_canonical.get((blue_school, blue_team), blue_team)

            # Normalize school to canonical team name (for team lookup)
            if red_school in school_to_name and red_school:
                canonical_red = school_to_name[red_school]
            if blue_school in school_to_name and blue_school:
                canonical_blue = school_to_name[blue_school]

            matches.append({
                "season": season,
                "region": region,
                "match_num": match_num,
                "stage_name": stage_name,
                "red_school": red_school,
                "red_team": red_team,
                "red_team_canonical": canonical_red,
                "blue_school": blue_school,
                "blue_team": blue_team,
                "blue_team_canonical": canonical_blue,
                "score_a": score_a,
                "score_b": score_b,
                "note": note,
            })

    print(f"  {len(matches)} valid matches parsed")
    print(f"  {skipped_empty} empty/invalid rows skipped")
    print(f"  {skipped_bye} bye matches skipped")
    print(f"  {score_defaults} matches with defaulted scores (0:0)")

    # 3. Collect unique teams
    print("\n[3/6] Collecting unique teams...")
    unique_teams = {}  # canonical_name -> (school, team_name)
    for m in matches:
        # Red team
        red_canonical = m["red_team_canonical"]
        if red_canonical and red_canonical not in unique_teams:
            unique_teams[red_canonical] = (m["red_school"], red_canonical)
        # Blue team
        blue_canonical = m["blue_team_canonical"]
        if blue_canonical and blue_canonical not in unique_teams:
            unique_teams[blue_canonical] = (m["blue_school"], blue_canonical)
    print(f"  {len(unique_teams)} unique teams")

    # 4. Import into database
    print("\n[4/6] Importing into database...")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # 4a. Import teams
    print("\n  Importing teams...")
    team_ids = {}  # canonical_name -> team_uuid
    team_count = 0
    for canonical_name, (school, _) in unique_teams.items():
        tid = stable_uuid("team", canonical_name)
        team_ids[canonical_name] = tid
        cur.execute(
            """INSERT INTO teams (id, name, university)
               VALUES (%s, %s, %s)
               ON CONFLICT DO NOTHING""",
            (tid, canonical_name, school or canonical_name),
        )
        team_count += 1
    conn.commit()
    print(f"    {team_count} teams upserted")

    # 4b. Import events (one per season)
    print("\n  Importing events...")
    seasons_seen = set()
    event_ids = {}  # season -> event_uuid
    for m in matches:
        seasons_seen.add(m["season"])

    for season in sorted(seasons_seen):
        if not season:
            continue
        eid = stable_uuid("event", f"rmuc_{season}")
        event_ids[season] = eid

        # Determine start/end dates per season
        season_year = int(season)
        status = "concluded"
        if season_year == 2025:
            status = "concluded"  # 2025 season is over

        cur.execute(
            """INSERT INTO events (id, name, series, season, start_date, end_date, location, status)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT DO NOTHING""",
            (
                eid,
                f"RMUC {season}",
                "全国大学生机器人大赛 RoboMaster",
                season,
                date(season_year, 5, 1),
                date(season_year, 8, 31),
                "中国",
                status,
            ),
        )
    conn.commit()
    print(f"    {len(seasons_seen)} events created")

    # 4c. Import stages (per season + region + stage_name)
    print("\n  Importing stages...")
    stage_combos = {}  # (season, region, stage_name) -> stage_type
    for m in matches:
        key = (m["season"], m["region"], m["stage_name"])
        if key not in stage_combos:
            stage_type, stage_format = classify_stage(m["stage_name"], m["region"])
            stage_combos[key] = (stage_type, stage_format)

    stage_ids = {}  # (season, region, stage_name) -> stage_uuid
    stage_order = {}  # season -> counter

    for (season, region, stage_name), (stage_type, stage_format) in sorted(stage_combos.items()):
        if not season or season not in event_ids:
            continue

        eid = event_ids[season]
        sid = stable_uuid("stage", season, region, stage_name)

        if season not in stage_order:
            stage_order[season] = 0
        stage_order[season] += 1

        display_name = f"{region} - {stage_name}" if stage_name else region
        if stage_name and region in display_name:
            display_name = stage_name if region in stage_name else f"{region}{stage_name}"

        cur.execute(
            """INSERT INTO event_stages (id, event_id, name, stage_format, stage_type, order_index)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON CONFLICT DO NOTHING""",
            (sid, eid, display_name, stage_format, stage_type, stage_order[season]),
        )
        stage_ids[(season, region, stage_name)] = sid

    conn.commit()
    print(f"    {len(stage_combos)} stages created")

    # 4d. Import event entries (team-seed per season)
    print("\n  Importing event entries...")
    entry_count = 0
    entries_seen = set()  # (event_id, canonical_name)
    for m in matches:
        if not m["season"] or m["season"] not in event_ids:
            continue
        eid = event_ids[m["season"]]

        for canonical in (m["red_team_canonical"], m["blue_team_canonical"]):
            if not canonical or canonical not in team_ids:
                continue
            key = (eid, canonical)
            if key in entries_seen:
                continue
            entries_seen.add(key)

            cur.execute(
                """INSERT INTO event_entries (id, event_id, team_id)
                   VALUES (%s, %s, %s)
                   ON CONFLICT DO NOTHING""",
                (stable_uuid("entry", m["season"], canonical), eid, team_ids[canonical]),
            )
            entry_count += 1
    conn.commit()
    print(f"    {entry_count} event entries created")

    # 4e. Import matches
    print("\n  Importing matches...")
    match_count = 0
    for m in matches:
        if not m["season"] or m["season"] not in event_ids:
            continue

        eid = event_ids[m["season"]]
        sid = stage_ids.get((m["season"], m["region"], m["stage_name"]))

        red_canonical = m["red_team_canonical"]
        blue_canonical = m["blue_team_canonical"]

        if red_canonical not in team_ids or blue_canonical not in team_ids:
            continue

        tid_a = team_ids[red_canonical]
        tid_b = team_ids[blue_canonical]

        mid = stable_uuid("match", m["season"], m["region"], m["stage_name"],
                          str(m["match_num"]), red_canonical, blue_canonical)

        # Determine format: use score totals as hint
        total_score = m["score_a"] + m["score_b"]
        if total_score <= 2:
            fmt = "bo3"
        elif total_score <= 3:
            fmt = "bo3"
        elif total_score <= 5:
            fmt = "bo5"
        else:
            fmt = "bo7"

        # Determine group_name from stage_name for group stages
        group_name = None
        stage_name = m["stage_name"]
        group_match = re.match(r"([A-Z]+)组", stage_name)
        if group_match:
            group_name = group_match.group(1)
        else:
            # Try swiss group
            swiss_match = re.match(r"瑞士轮([A-Z]+)组", stage_name)
            if swiss_match:
                group_name = swiss_match.group(1)

        cur.execute(
            """INSERT INTO matches (id, event_id, stage_id, team_a_id, team_b_id,
               score_a, score_b, format, status, round, group_name)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'finished', %s, %s)
               ON CONFLICT DO NOTHING""",
            (
                mid, eid, sid, tid_a, tid_b,
                m["score_a"], m["score_b"], fmt,
                int(m["match_num"]) if m["match_num"].isdigit() else None,
                group_name,
            ),
        )
        match_count += 1

    conn.commit()
    print(f"    {match_count} matches imported")

    # 5. Compute standings for group stages
    print("\n[5/6] Computing stage standings...")
    standing_count = 0

    # Get all group stages
    cur.execute("""
        SELECT id, event_id, name FROM event_stages
        WHERE stage_type = 'group' OR stage_format = 'round_robin'
    """)
    group_stages = cur.fetchall()

    for sid, eid, sname in group_stages:
        # Get all matches in this stage
        cur.execute("""
            SELECT team_a_id, team_b_id, score_a, score_b
            FROM matches
            WHERE stage_id = %s AND status = 'finished'
        """, (sid,))
        stage_matches = cur.fetchall()

        if not stage_matches:
            continue

        # Compute standings
        team_stats = {}  # team_id -> {wins, losses, draws, map_wins, map_losses}
        for ta, tb, sa, sb in stage_matches:
            for tid, scored, conceded in [(ta, sa, sb), (tb, sb, sa)]:
                if tid not in team_stats:
                    team_stats[tid] = {"wins": 0, "losses": 0, "draws": 0,
                                       "map_wins": 0, "map_losses": 0}

            # Update stats
            if sa > sb:
                team_stats[ta]["wins"] += 1
                team_stats[tb]["losses"] += 1
            elif sb > sa:
                team_stats[tb]["wins"] += 1
                team_stats[ta]["losses"] += 1
            else:
                team_stats[ta]["draws"] += 1
                team_stats[tb]["draws"] += 1

            team_stats[ta]["map_wins"] += sa
            team_stats[ta]["map_losses"] += sb
            team_stats[tb]["map_wins"] += sb
            team_stats[tb]["map_losses"] += sa

        # Sort by points (3 for win, 1 for draw), then by map differential
        ranked = []
        for tid, stats in team_stats.items():
            pts = stats["wins"] * 3 + stats["draws"]
            ranked.append((tid, pts, stats))
        ranked.sort(key=lambda x: (-x[1], -(x[2]["map_wins"] - x[2]["map_losses"])))

        for rank, (tid, pts, stats) in enumerate(ranked, 1):
            standing_id = stable_uuid("standing", str(sid), str(tid))
            cur.execute(
                """INSERT INTO stage_standings (id, stage_id, team_id, rank, wins, losses, draws, map_wins, map_losses, points)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (stage_id, team_id) DO UPDATE SET
                     rank = EXCLUDED.rank,
                     wins = EXCLUDED.wins,
                     losses = EXCLUDED.losses,
                     draws = EXCLUDED.draws,
                     map_wins = EXCLUDED.map_wins,
                     map_losses = EXCLUDED.map_losses,
                     points = EXCLUDED.points""",
                (standing_id, sid, tid, rank,
                 stats["wins"], stats["losses"], stats["draws"],
                 stats["map_wins"], stats["map_losses"], pts),
            )
            standing_count += 1

    conn.commit()
    print(f"    {standing_count} standings records created")

    # 6. Summary
    print(f"\n{'='*60}")
    print("Import complete!")
    print(f"  Seasons:   {len(seasons_seen)}")
    print(f"  Teams:     {team_count}")
    print(f"  Events:    {len(event_ids)}")
    print(f"  Stages:    {len(stage_combos)}")
    print(f"  Entries:   {entry_count}")
    print(f"  Matches:   {match_count}")
    print(f"  Standings: {standing_count}")
    print(f"{'='*60}")

    conn.close()


if __name__ == "__main__":
    import_all()
