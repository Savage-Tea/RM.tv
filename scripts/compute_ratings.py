#!/usr/bin/env python3
"""Recompute all robot ratings from CDN data.

Fetches robot_data.json and schedule.json from rm-static.djicdn.com,
then updates robot_rating rows with per-match-average ratings.
Run after CDN import or when rating formulas change.

Usage:  python3 scripts/compute_ratings.py
"""

import json
import urllib.request
from collections import Counter

import psycopg2
import psycopg2.extras

psycopg2.extras.register_uuid()

DSN = "postgresql://rmtv:rmtv_dev@localhost:5432/rmtv"

CDN_ROBOT_URL = "https://rm-static.djicdn.com/live_json/robot_data.json"
CDN_SCHEDULE_URL = "https://rm-static.djicdn.com/live_json/schedule.json"

# CDN robot type → DB enum
CDN_TO_DB = {
    "Infantry": "infantry",
    "Hero": "hero",
    "Sapper": "engineer",
    "Airplane": "uav",
    "Guard": "sentinel",
    "Dart": "dart",
    "Radar": "radar",
}

EPS = 0.001


def fetch_cdn_robots():
    """Return {team_name: {robot_type: {field: value}}}."""
    data = json.loads(urllib.request.urlopen(CDN_ROBOT_URL).read())
    out = {}
    for zone in data["zones"]:
        for team in zone["teams"]:
            out[team["name"]] = {
                "robots": {
                    CDN_TO_DB.get(r["type"], r["type"].lower()): r
                    for r in team["robots"]
                }
            }
    return out


def count_matches():
    """Return Counter(team_name → total_matches_played)."""
    data = json.loads(urllib.request.urlopen(CDN_SCHEDULE_URL).read())
    cnt = Counter()
    for zone in data["data"]["event"]["zones"]["nodes"]:
        for key in ("groupMatches", "knockoutMatches"):
            for m in zone.get(key, {}).get("nodes", []):
                if m.get("status") != "DONE":
                    continue
                for side in ("blueSide", "redSide"):
                    t = m.get(side, {}).get("player", {}).get("team", {})
                    if t.get("name"):
                        cnt[t["name"]] += 1
    return cnt


# ── Per-type rating functions ──────────────────────────────────────


def rating_engineer(cr):
    econ = float(cr.get("eaAssembleEcon", 0))
    succ = float(cr.get("eaAssembleSuccCnt", 0))
    diff = float(cr.get("avgAssembleDiff", 0))
    if econ <= 1.0 and succ <= 0.01:
        return 1.0
    return 0.55 * econ / 1377.49 + 0.30 * succ / 1.65 + 0.15 * diff / 1.56


def rating_radar(cr):
    marker = float(cr.get("eaRadarMarkerTime", 0))
    counter = float(cr.get("eaRadarCounterTime", 0))
    parse_s = float(cr.get("eaRadarParseSuccCnt", 0))
    if marker <= 1.0 and counter <= 0.1 and parse_s <= 0.01:
        return 1.0
    nm = marker / 417.61 if marker > 0.1 else 1.0
    nc = counter / 38.55 if counter > 0.1 else 1.0
    np = parse_s / 1.04 if parse_s > 0.01 else 1.0
    return 0.50 * nm + 0.30 * nc + 0.20 * np


def rating_dart(cr):
    special = (
        float(cr.get("etDartOutpostCnt", 0)) * 1.0
        + float(cr.get("etDartFixedCnt", 0)) * 1.0
        + float(cr.get("etDartRDFixCnt", 0)) * 2.0
        + float(cr.get("etDartRDMoveCnt", 0)) * 3.5
        + float(cr.get("etDartEndMoveCnt", 0)) * 5.0
    )
    damage = float(cr.get("gkDamage", 0)) + float(cr.get("eagHurt", 0))
    if damage <= 0.1:
        return 1.0
    return (
        0.10 * 1.0
        + 0.25 * damage / 228.73
        + 0.60 * special / 3.62
        + 0.05 * 1.0
    )


_BL = {
    "infantry": {"kda": 1.920, "damage": 1043.56, "special": 22.55},
    "hero": {"kda": 0.428, "damage": 424.72, "special": 10.70},
    "uav": {"kda": 2.021, "damage": 1455.50, "special": 11.44},
    "sentinel": {"kda": 1.224, "damage": 517.63, "special": 0.61},
}

_W = {
    "infantry": {"combat": 0.40, "damage": 0.35, "support": 0.10, "special": 0.15},
    "hero": {"combat": 0.25, "damage": 0.55, "support": 0.05, "special": 0.15},
    "uav": {"combat": 0.30, "damage": 0.30, "support": 0.20, "special": 0.20},
    "sentinel": {"combat": 0.25, "damage": 0.35, "support": 0.10, "special": 0.30},
}


def rating_combat(rt, cr):
    """Standard combat rating for infantry / hero / uav / sentinel."""
    kda_str = str(cr.get("eaKDA", "0/0/0"))
    parts = kda_str.split("/")
    kills = float(parts[0])
    deaths = max(float(parts[1]) if len(parts) > 1 else 0.0, 0.5)
    assists = float(parts[2]) if len(parts) > 2 else 0.0
    damage = float(cr.get("gkDamage", 0)) + float(cr.get("eagHurt", 0))

    if damage <= 0.1 and kills <= 0.01:
        return 1.0

    b = _BL.get(rt, _BL["infantry"])
    w = _W.get(rt, _W["infantry"])
    tw = sum(w.values())

    kda_raw = (kills + assists * 0.5) / deaths
    special = (
        float(cr.get("gKillCount", 0))
        if rt == "sentinel"
        else float(cr.get("eaBigHitRate", 0)) + float(cr.get("eaSmallHitRate", 0))
    )

    return (
        w["combat"] * (kda_raw / max(b["kda"], EPS))
        + w["damage"] * (damage / max(b["damage"], EPS))
        + w["special"] * (special / max(b["special"], EPS) if b["special"] > 0.01 else 1.0)
        + w["support"] * 1.0
    ) / tw


# ── Main ───────────────────────────────────────────────────────────


def main():
    print("Fetching CDN robot data ...")
    cdn_robots = fetch_cdn_robots()
    print(f"  {len(cdn_robots)} teams")

    print("Fetching CDN schedule ...")
    matches = count_matches()
    print(f"  {len(matches)} teams with completed matches")

    conn = psycopg2.connect(DSN)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute(
        """SELECT rr.id AS rid, rr.robot_type::text, t.name AS tn
           FROM robot_rating rr
           JOIN teams t ON rr.team_id = t.id
           WHERE rr.season = '2026'"""
    )
    rows = cur.fetchall()
    print(f"Updating {len(rows)} rating rows ...")

    updated = 0
    for row in rows:
        tn = row["tn"]
        rt = row["robot_type"]
        cdn_team = cdn_robots.get(tn)
        if not cdn_team:
            continue
        cr = cdn_team["robots"].get(rt)
        if not cr:
            continue

        if rt == "engineer":
            rating = rating_engineer(cr)
        elif rt == "radar":
            rating = rating_radar(cr)
        elif rt == "dart":
            rating = rating_dart(cr)
        else:
            rating = rating_combat(rt, cr)

        rating = max(0.1, min(5.0, rating))
        mp = matches.get(tn, 0)

        cur.execute(
            "UPDATE robot_rating SET rating = %s, matches_played = %s, updated_at = now() WHERE id = %s",
            (rating, mp, row["rid"]),
        )
        updated += 1

    conn.commit()
    print(f"Done. {updated} ratings updated.")

    # Print summary
    cur.execute(
        """SELECT rr.robot_type::text, COUNT(*),
                  ROUND(AVG(rr.rating::float8)::numeric, 2) AS av,
                  ROUND(MIN(rr.rating::float8)::numeric, 2) AS mn,
                  ROUND(MAX(rr.rating::float8)::numeric, 2) AS mx
           FROM robot_rating rr WHERE rr.season = '2026'
           GROUP BY rr.robot_type::text ORDER BY rr.robot_type::text"""
    )
    print("\nRating summary by type:")
    for r in cur.fetchall():
        print(f"  {r['robot_type']:12s}  avg={str(r['av']):>7s}  min={str(r['mn']):>7s}  max={str(r['mx']):>7s}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
