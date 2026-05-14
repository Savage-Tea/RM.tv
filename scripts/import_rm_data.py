#!/usr/bin/env python3
"""
Import RoboMaster 2026 competition data from rm-static.djicdn.com JSON files
into the RM.tv PostgreSQL database.

Data sources:
  - robot_data.json: teams with robot types per zone
  - group_rank_info.json: group standings (W/D/L, opponent scores)
  - schedule.json: tournament structure (zones, groups, match slots)
  - groups_order.json: combined event/zone/group/team data
  - current_and_next_matches.json: live match status

Usage:
  python3 scripts/import_rm_data.py
"""

import json
import os
import sys
import uuid
from datetime import date, datetime, timezone
from urllib.request import urlopen, Request

DB_URL = os.environ.get("DATABASE_URL", "postgresql://rmtv:rmtv_dev@localhost:5432/rmtv")

CDN_BASE = "https://rm-static.djicdn.com/live_json"
JSON_FILES = [
    "robot_data",
    "group_rank_info",
    "schedule",
    "groups_order",
    "current_and_next_matches",
]

# ── Fetch ──────────────────────────────────────────────────────

def fetch_json(name):
    """Fetch JSON from CDN or local cache."""
    cache_path = f"/tmp/rm_{name}.json"
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            return json.load(f)
    url = f"{CDN_BASE}/{name}.json"
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req) as resp:
        data = json.loads(resp.read())
    with open(cache_path, "w") as f:
        json.dump(data, f, ensure_ascii=False)
    return data


# ── SQL helpers ────────────────────────────────────────────────

def pg_connect():
    import psycopg2
    return psycopg2.connect(DB_URL)


def pg_exec(cur, sql, params=None):
    try:
        cur.execute(sql, params)
    except Exception as e:
        print(f"  SQL ERROR: {e}")
        print(f"  SQL: {sql[:200]}")
        raise


# ── UUID helpers ───────────────────────────────────────────────

def stable_uuid(*parts):
    """Generate a deterministic UUID from string parts."""
    import hashlib
    s = "|".join(str(p) for p in parts)
    h = hashlib.md5(s.encode()).hexdigest()
    return str(uuid.UUID(h))


# ── Robot type mapping ─────────────────────────────────────────
# RM website types → DB enum values
ROBOT_TYPE_MAP = {
    "Infantry": "infantry",
    "Hero": "hero",
    "Sapper": "engineer",
    "Airplane": "uav",
    "Guard": "sentinel",
    "Dart": "dart",
    "Radar": "radar",
}


def map_robot_type(rm_type):
    """Map RM website robot type to DB enum value."""
    return ROBOT_TYPE_MAP.get(rm_type, rm_type.lower())


# Per-type baseline averages (computed from 96-team CDN data, 2026 season)
# Non-zero averages: only teams with actual match data (南部赛区 only)
BASELINES = {
    "infantry": {"kda": 1.920, "damage": 1043.56, "support": 0.01, "special": 22.55,  "econ_exchange": 0.0, "econ_mine_diff": 0.0, "econ_assemble": 0.001},
    "hero":     {"kda": 0.428, "damage": 424.72,  "support": 0.01, "special": 10.70,  "econ_exchange": 0.0, "econ_mine_diff": 0.0, "econ_assemble": 0.001},
    "engineer": {"kda": 0.001, "damage": 0.01,    "support": 0.01, "special": 1.62,  "econ_exchange": 0.01, "econ_mine_diff": 0.001, "econ_assemble": 1.62},
    "uav":      {"kda": 2.021, "damage": 1455.50, "support": 0.01, "special": 11.44,  "econ_exchange": 0.0, "econ_mine_diff": 0.0, "econ_assemble": 0.001},
    "sentinel": {"kda": 1.224, "damage": 517.63,  "support": 0.01, "special": 0.61,   "econ_exchange": 0.0, "econ_mine_diff": 0.0, "econ_assemble": 0.001},
    "dart":     {"kda": 0.001, "damage": 228.73,  "support": 0.01, "special": 5.00,   "econ_exchange": 0.0, "econ_mine_diff": 0.0, "econ_assemble": 0.001},
    "radar":    {"kda": 0.001, "damage": 0.01,    "support": 0.01, "special": 418.06, "econ_exchange": 0.0, "econ_mine_diff": 0.0, "econ_assemble": 0.001},
}

WEIGHTS = {
    "infantry": {"combat": 0.40, "damage": 0.35, "support": 0.10, "econ": 0.00, "special": 0.15},
    "hero":     {"combat": 0.35, "damage": 0.45, "support": 0.05, "econ": 0.00, "special": 0.15},
    "engineer": {"combat": 0.00, "damage": 0.00, "support": 0.15, "econ": 0.70, "special": 0.15},
    "uav":      {"combat": 0.30, "damage": 0.30, "support": 0.20, "econ": 0.00, "special": 0.20},
    "sentinel": {"combat": 0.25, "damage": 0.35, "support": 0.10, "econ": 0.00, "special": 0.30},
    "dart":     {"combat": 0.10, "damage": 0.25, "support": 0.05, "econ": 0.00, "special": 0.60},
    "radar":    {"combat": 0.05, "damage": 0.10, "support": 0.55, "econ": 0.00, "special": 0.30},
}


def compute_robot_rating(robot_type, kills, deaths, assists, damage, support, special):
    """Compute a single robot's rating from raw stats.

    All values normalized against per-type baseline, weighted by role dimensions.
    Returns value centered at 1.0. Typical range: 0.3 – 1.7.
    """
    bl = BASELINES.get(robot_type, BASELINES["infantry"])
    w = WEIGHTS.get(robot_type, WEIGHTS["infantry"])
    total_w = w["combat"] + w["damage"] + w["support"] + w["econ"] + w["special"]
    eps = 0.001

    kda_raw = (kills + assists * 0.5) / max(deaths, 0.5)

    norm_kda = 1.0 if bl["kda"] <= 0.01 else min(kda_raw / max(bl["kda"], eps), 4.0)
    norm_damage = 1.0 if bl["damage"] <= 1.0 else min(damage / max(bl["damage"], eps), 4.0)
    norm_support = 1.0 if bl["support"] <= 0.01 else min(support / max(bl["support"], eps), 4.0)
    norm_special = 1.0 if bl["special"] <= 0.01 else min(special / max(bl["special"], eps), 4.0)

    if robot_type == "engineer":
        econ_score = (0.60 * max(norm_support, 0.0)
                      + 0.25 * max(norm_damage, 0.0)
                      + 0.15 * max(norm_special, 0.0))
        rating = (w["support"] * norm_support
                  + w["econ"] * econ_score
                  + w["special"] * norm_special)
    else:
        rating = (w["combat"] * norm_kda
                  + w["damage"] * norm_damage
                  + w["support"] * norm_support
                  + w["special"] * norm_special)

    return rating / total_w


# ── Main import logic ──────────────────────────────────────────

def import_data():
    print("[+] Fetching JSON data...")
    robot_data = fetch_json("robot_data")
    group_rank = fetch_json("group_rank_info")
    schedule = fetch_json("schedule")
    groups_order = fetch_json("groups_order")
    current_matches = fetch_json("current_and_next_matches")

    import psycopg2
    conn = pg_connect()
    cur = conn.cursor()

    # ── 1. Import teams ────────────────────────────────────────
    print("\n[1/5] Importing teams...")
    seen_teams = set()
    team_count = 0

    for zone in robot_data["zones"]:
        for team in zone["teams"]:
            name = team["name"]
            college = team.get("collegeName", "")
            logo = team.get("collegeLogo", "")

            if name in seen_teams:
                continue
            seen_teams.add(name)

            team_id = stable_uuid("team", name)
            pg_exec(cur,
                """INSERT INTO teams (id, name, university, logo_url)
                   VALUES (%s, %s, %s, %s)
                   ON CONFLICT DO NOTHING""",
                (team_id, name, college, logo))
            team_count += 1

    conn.commit()
    print(f"   {team_count} teams imported")

    # ── 2. Import event and stages ─────────────────────────────
    print("\n[2/5] Importing event and stages...")
    event_id = stable_uuid("event", "rmuc_2026")
    pg_exec(cur,
        """INSERT INTO events (id, name, series, season, start_date, end_date, location, status)
           VALUES (%s, %s, %s, %s, %s, %s, %s, 'ongoing')
           ON CONFLICT DO NOTHING""",
        (event_id, "RMUC 2026 超级对抗赛·区域赛", "全国大学生机器人大赛 RoboMaster",
         "2026", date(2026, 5, 13), date(2026, 5, 25),
         "中国"))

    # Create event_stages for each zone+group
    zone_info = [
        ("614", "南部赛区"),
        ("615", "东部赛区"),
        ("616", "北部赛区"),
    ]

    stage_ids = {}
    for zone_id, zone_name in zone_info:
        for group_name in ["A", "B"]:
            stage_name = f"{zone_name}{group_name}组"
            sid = stable_uuid("stage", zone_id, group_name)
            pg_exec(cur,
                """INSERT INTO event_stages (id, event_id, name, stage_format, stage_type, order_index)
                   VALUES (%s, %s, %s, 'round_robin', 'group', %s)
                   ON CONFLICT DO NOTHING""",
                (sid, event_id, stage_name, len(stage_ids) + 1))
            stage_ids[(zone_id, group_name)] = sid

    conn.commit()
    print(f"   Event: RMUC 2026 超级对抗赛·区域赛")
    print(f"   Stages: {len(stage_ids)} group stages")

    # ── 3. Import event entries (team placements) ──────────────
    print("\n[3/5] Importing event entries and standings...")

    # Use groups_order for team-to-group mapping
    groups_event = groups_order["data"]["event"]
    entry_count = 0

    for zone_node in groups_event["zones"]["nodes"]:
        zone_id = zone_node["id"]
        zone_name_map = {"614": "南部赛区", "615": "东部赛区", "616": "北部赛区"}
        zone_name = zone_name_map.get(zone_id, zone_id)

        for group_node in zone_node.get("groups", {}).get("nodes", []):
            group_name = group_node["name"]
            stage_key = (zone_id, group_name)

            for player_node in group_node.get("players", {}).get("nodes", []):
                team_info = player_node.get("team") or {}
                team_name = team_info.get("name", "")
                college = team_info.get("collegeName", "")
                logo = team_info.get("collegeLogo", "")
                rank = player_node.get("rank", 0)
                wins = player_node.get("winGroupMatchCount", 0)
                losses = player_node.get("loseGroupMatchCount", 0)
                pf = player_node.get("groupMatchPointFor", 0)
                pa = player_node.get("groupMatchPointAngist", 0)

                if not team_name:
                    continue

                team_id = stable_uuid("team", team_name)

                # Ensure team exists (some teams might only be in schedule, not robot_data)
                if team_name not in seen_teams:
                    pg_exec(cur,
                        """INSERT INTO teams (id, name, university, logo_url)
                           VALUES (%s, %s, %s, %s)
                           ON CONFLICT DO NOTHING""",
                        (team_id, team_name, college, logo))
                    seen_teams.add(team_name)

                # Event entry
                pg_exec(cur,
                    """INSERT INTO event_entries (id, event_id, team_id, seed)
                       VALUES (%s, %s, %s, %s)
                       ON CONFLICT DO NOTHING""",
                    (stable_uuid("entry", zone_id, group_name, team_name),
                     event_id, team_id, rank))
                entry_count += 1

                # Stage standings
                sid = stage_ids.get(stage_key)
                if sid:
                    pg_exec(cur,
                        """INSERT INTO stage_standings (id, stage_id, team_id, rank, wins, losses, points, map_wins, map_losses)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                           ON CONFLICT DO NOTHING""",
                        (stable_uuid("standing", zone_id, group_name, team_name),
                         sid, team_id, rank, wins, losses, pf - pa, pf, pa))

    conn.commit()
    print(f"   {entry_count} event entries imported")

    # ── 4. Import matches from schedule ────────────────────────
    print("\n[4/5] Importing matches...")
    match_count = 0

    for zone_node in schedule["data"]["event"]["zones"]["nodes"]:
        zone_id = zone_node["id"]
        dates = zone_node.get("matchDates", [])

        # Build player_id -> team_name mapping from all groups
        player_to_team = {}
        group_to_stage = {}
        for group_node in zone_node.get("groups", {}).get("nodes", []):
            gname = group_node["name"]
            group_to_stage[group_node.get("id", "")] = (zone_id, gname)
            for pn in group_node.get("players", {}).get("nodes", []):
                tinfo = pn.get("team") or {}
                tname = tinfo.get("name", "")
                if tname:
                    player_to_team[pn["id"]] = tname

        # Import group matches
        for match_node in zone_node.get("groupMatches", {}).get("nodes", []):
            m = match_node
            group_id = m.get("groupId", "")
            stage_key = group_to_stage.get(group_id, (zone_id, "A"))
            sid = stage_ids.get(stage_key)

            # Get team names from nested player.team
            blue_side = m.get("blueSide", {})
            red_side = m.get("redSide", {})
            def _team_name(side):
                player = (side or {}).get("player") or {}
                team = player.get("team") or {}
                return team.get("name", "")

            team_a_name = _team_name(blue_side)
            team_b_name = _team_name(red_side)

            if not team_a_name or not team_b_name:
                continue

            team_a_id = stable_uuid("team", team_a_name)
            team_b_id = stable_uuid("team", team_b_name)
            match_id = stable_uuid("match", zone_id, str(m.get("id", match_count)))

            status_map = {"DONE": "finished", "WAITING": "scheduled"}
            status = status_map.get(m.get("status", ""), "scheduled")

            score_a = m.get("blueSideScore", 0)
            score_b = m.get("redSideScore", 0)
            map_wins_a = m.get("blueSideWinGameCount", 0)
            map_wins_b = m.get("redSideWinGameCount", 0)
            total_maps = m.get("planGameCount", 3)

            # Schedule time
            scheduled_at = m.get("planStartedAt")
            if not scheduled_at:
                round_num = m.get("orderNumber", 1)
                date_idx = min(round_num - 1, len(dates) - 1) if dates else 0
                if dates and date_idx < len(dates):
                    scheduled_at = f"{dates[date_idx]}T10:00:00+08:00"

            pg_exec(cur,
                """INSERT INTO matches (id, event_id, stage_id, team_a_id, team_b_id,
                   score_a, score_b, format, status, scheduled_at, round, group_name)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT DO NOTHING""",
                (match_id, event_id, sid, team_a_id, team_b_id,
                 score_a, score_b, f"bo{total_maps}", status, scheduled_at,
                 m.get("orderNumber", 1), f"{zone_id}"))

            # Create match_maps entries if we have map scores
            if map_wins_a > 0 or map_wins_b > 0:
                total_played = map_wins_a + map_wins_b
                for game_num in range(1, total_played + 1):
                    map_id = stable_uuid("map", zone_id, str(m.get("id")), str(game_num))
                    winner = "a" if game_num <= map_wins_a else "b"
                    pg_exec(cur,
                        """INSERT INTO match_maps (id, match_id, map_name, order_index,
                           score_a, score_b)
                           VALUES (%s, %s, %s, %s, %s, %s)
                           ON CONFLICT DO NOTHING""",
                        (map_id, match_id, f"Map {game_num}", game_num,
                         1 if winner == "a" else 0,
                         1 if winner == "b" else 0))

            match_count += 1

    conn.commit()
    print(f"   {match_count} matches imported")

    # ── 5. Update standings from group_rank_info ───────────────
    print("\n[5/5] Updating standings from group_rank_info...")
    standing_updates = 0

    for zone in group_rank.get("zones", []):
        zone_name = zone["zoneName"]
        # Find zone_id
        zone_id = None
        for zid, zn in zone_info:
            if zn == zone_name:
                zone_id = zid
                break
        if not zone_id:
            continue

        for group in zone.get("groups", []):
            group_name = group["groupName"].replace("组", "")  # "A组" -> "A"
            rank = 1
            for player_data in group.get("groupPlayers", []):
                if not player_data or len(player_data) < 3:
                    continue

                team_info = player_data[0].get("itemValue", {})
                team_name = team_info.get("teamName", "")
                record = player_data[1].get("itemValue", "0/0/0")  # "2/0/0"
                wins_str = player_data[2].get("itemValue", 0)

                if not team_name or team_name in ("A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5"):
                    continue

                team_id = stable_uuid("team", team_name)
                sid = stage_ids.get((zone_id, group_name))

                if not sid:
                    continue

                # Parse W/L/D
                parts = record.split("/")
                wins = int(parts[0]) if len(parts) > 0 else 0
                draws = int(parts[1]) if len(parts) > 1 else 0
                losses = int(parts[2]) if len(parts) > 2 else 0
                points = wins * 3 + draws

                pg_exec(cur,
                    """UPDATE stage_standings
                       SET rank = %s, wins = %s, losses = %s, draws = %s, points = %s
                       WHERE stage_id = %s AND team_id = %s""",
                    (rank, wins, losses, draws, points, sid, team_id))
                standing_updates += 1
                rank += 1

    conn.commit()
    print(f"   {standing_updates} standings updated")

    # ── 6. Import robot stats ─────────────────────────────────
    print("\n[6/6] Importing robot data...")
    member_count = 0
    stats_count = 0

    for zone in robot_data["zones"]:
        for team in zone["teams"]:
            team_name = team["name"]
            team_id = stable_uuid("team", team_name)

            for robot in team.get("robots", []):
                robot_type = robot.get("type", "Unknown")
                robot_num = robot.get("robotNumber", 0)
                member_name = f"{team_name}_{robot_type}_{robot_num}"
                member_id = stable_uuid("member", team_name, robot_type, str(robot_num))

                # Create team_member
                pg_exec(cur,
                    """INSERT INTO team_members (id, team_id, name, role, is_active)
                       VALUES (%s, %s, %s, '队员', true)
                       ON CONFLICT DO NOTHING""",
                    (member_id, team_id, member_name))
                member_count += 1

                # Create member_robot_role
                db_robot_type = map_robot_type(robot_type)
                pg_exec(cur,
                    """INSERT INTO member_robot_roles (id, member_id, robot_type, is_primary)
                       VALUES (%s, %s, %s, %s)
                       ON CONFLICT DO NOTHING""",
                    (stable_uuid("role", member_name, robot_type),
                     member_id, db_robot_type,
                     robot_num == 1))

                # Parse KDA: "0.5/1.5/0.3" -> kills/deaths/assists
                kda_str = robot.get("eaKDA", "0/0/0")
                kda_parts = kda_str.split("/")
                kills = float(kda_parts[0]) if len(kda_parts) > 0 else 0
                deaths = float(kda_parts[1]) if len(kda_parts) > 1 else 0
                assists = float(kda_parts[2]) if len(kda_parts) > 2 else 0
                damage = float(robot.get("eagHurt", 0)) + float(robot.get("gkDamage", 0))
                support = float(robot.get("eaExchangeEcon", 0))

                # Compute special stat by robot type
                special = 0.0
                if db_robot_type == "sentinel":
                    special = float(robot.get("gKillCount", 0))
                elif db_robot_type == "dart":
                    special = float(robot.get("etDartOutpostCnt", 0)) + float(robot.get("etDartFixedCnt", 0)) + float(robot.get("etDartRDMoveCnt", 0))
                elif db_robot_type == "radar":
                    special = float(robot.get("eaRadarMarkerTime", 0)) + float(robot.get("eaRadarParseSuccCnt", 0)) * 10
                elif db_robot_type == "engineer":
                    special = float(robot.get("eaAssembleSuccCnt", 0))
                else:
                    special = float(robot.get("eaBigHitRate", 0) or robot.get("eaSmallHitRate", 0) or 0)

                rating = compute_robot_rating(db_robot_type, kills, deaths, assists, damage, support, special)

                pg_exec(cur,
                    """INSERT INTO robot_rating (id, team_id, member_id, robot_type, season, rating, matches_played)
                       VALUES (%s, %s, %s, %s, '2026', %s, 1)
                       ON CONFLICT (member_id, robot_type, season) DO UPDATE SET rating = EXCLUDED.rating, updated_at = now()""",
                    (stable_uuid("robot_rating", member_name),
                     team_id, member_id, db_robot_type,
                     rating))
                stats_count += 1

    conn.commit()
    print(f"   {member_count} team members imported")
    print(f"   {stats_count} robot ratings imported")

    conn.close()
    print(f"\n{'='*60}")
    print(f"Import complete!")
    print(f"  Teams:     {team_count}")
    print(f"  Stages:    {len(stage_ids)}")
    print(f"  Entries:   {entry_count}")
    print(f"  Matches:   {match_count}")
    print(f"  Standings: {standing_updates}")
    print(f"  Members:   {member_count}")
    print(f"  Robots:    {stats_count}")
    print(f"{'='*60}")


if __name__ == "__main__":
    import_data()
