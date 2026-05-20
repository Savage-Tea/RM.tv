#!/usr/bin/env python3
"""
RM.tv 数据更新流水线

自动执行 CDN 爬取 → 数据库更新 → Rating 重算 全流程。

用法:
  python3 scripts/update_pipeline.py              # 完整流水线
  python3 scripts/update_pipeline.py --skip-fetch # 跳过CDN爬取，只重算Rating
  python3 scripts/update_pipeline.py --ratings-only  # 仅重算Rating
  python3 scripts/update_pipeline.py --dry-run    # 预览而不写入

流程:
  1. CDN 爬取 ── 从 rm-static.djicdn.com 拉取 schedule.json / robot_data.json
  2. 数据库更新 ── 导入新赛事、阶段、比赛、战队
  3. Rating 重算 ── 基于最新 CDN 场均数据重算全部 Rating
  4. 汇总输出 ── 打印更新摘要
"""

import argparse
import json
import os
import subprocess
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from urllib.request import Request, urlopen

import psycopg2
import psycopg2.extras

psycopg2.extras.register_uuid()

# ── Config ─────────────────────────────────────────────────────────

DB_URL = os.environ.get("DATABASE_URL", "postgresql://rmtv:rmtv_dev@localhost:5432/rmtv")
CDN_BASE = "https://rm-static.djicdn.com/live_json"
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))


# ── Step 1: CDN Fetch ──────────────────────────────────────────────

def fetch_json(name: str) -> dict:
    """Fetch a JSON endpoint from CDN, with local cache."""
    cache_path = f"/tmp/rmtv_pipeline_{name}.json"

    # Try CDN first
    url = f"{CDN_BASE}/{name}.json"
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 (RMtv pipeline)"})
    try:
        with urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        with open(cache_path, "w") as f:
            json.dump(data, f, ensure_ascii=False)
        print(f"  ✓ fetched {name}.json ({len(json.dumps(data))} bytes)")
        return data
    except Exception as e:
        print(f"  ⚠ CDN fetch failed for {name}: {e}")
        # Fall back to cache
        if os.path.exists(cache_path):
            with open(cache_path) as f:
                print(f"  → using cached {name}.json")
                return json.load(f)
        raise


def check_cdn_updated(schedule: dict) -> dict:
    """Check which zones have new/updated data since last fetch."""
    status = {}
    for zone in schedule["data"]["event"]["zones"]["nodes"]:
        zone_name = zone["name"]
        gm = zone.get("groupMatches", {}).get("nodes", [])
        km = zone.get("knockoutMatches", {}).get("nodes", [])

        done_gm = sum(1 for m in gm if m.get("status") == "DONE")
        done_km = sum(1 for m in km if m.get("status") == "DONE")
        total = len(gm) + len(km)

        status[zone_name] = {
            "total": total,
            "done": done_gm + done_km,
            "group_done": done_gm,
            "knockout_done": done_km,
            "dates": zone.get("matchDates", []),
        }
    return status


# ── Step 2: DB Update ──────────────────────────────────────────────

def run_import_script(dry_run: bool = False):
    """Execute the existing import_rm_data.py as a subprocess."""
    script = os.path.join(SCRIPTS_DIR, "import_rm_data.py")
    if not os.path.exists(script):
        print("  ⚠ import_rm_data.py not found, skipping DB update")
        return False

    cmd = [sys.executable, script]
    if dry_run:
        print(f"  [dry-run] would run: {' '.join(cmd)}")
        return True

    print("  running import_rm_data.py ...")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

    if result.returncode != 0:
        print(f"  ⚠ import failed (exit {result.returncode})")
        print(f"  stderr: {result.stderr[-500:]}")
        return False

    # Print last few lines of output
    for line in result.stdout.strip().split("\n")[-5:]:
        print(f"  {line}")
    return True


# ── Step 3: Rating Recompute ───────────────────────────────────────

def run_rating_recompute(dry_run: bool = False):
    """Execute compute_ratings.py as a subprocess."""
    script = os.path.join(SCRIPTS_DIR, "compute_ratings.py")
    if not os.path.exists(script):
        print("  ⚠ compute_ratings.py not found, recomputing inline ...")
        return _recompute_ratings_inline(dry_run)

    if dry_run:
        print(f"  [dry-run] would run: {sys.executable} {script}")
        return True

    print("  running compute_ratings.py ...")
    result = subprocess.run(
        [sys.executable, script], capture_output=True, text=True, timeout=120
    )
    if result.returncode != 0:
        print(f"  ⚠ rating recompute failed (exit {result.returncode})")
        print(f"  stderr: {result.stderr[-500:]}")
        return False

    for line in result.stdout.strip().split("\n")[-8:]:
        print(f"  {line}")
    return True


def _recompute_ratings_inline(dry_run: bool = False):
    """Fallback: recompute ratings directly."""
    import urllib.request

    CDN_ROBOT_URL = f"{CDN_BASE}/robot_data.json"
    CDN_SCHEDULE_URL = f"{CDN_BASE}/schedule.json"

    CDN_TO_DB = {
        "Infantry": "infantry", "Hero": "hero", "Sapper": "engineer",
        "Airplane": "uav", "Guard": "sentinel", "Dart": "dart", "Radar": "radar",
    }

    cdn_data = json.loads(urlopen(CDN_ROBOT_URL).read())
    cdn_robots = {}
    for zone in cdn_data["zones"]:
        for team in zone["teams"]:
            cdn_robots[team["name"]] = {
                CDN_TO_DB.get(r["type"], r["type"].lower()): r
                for r in team["robots"]
            }

    sched = json.loads(urlopen(CDN_SCHEDULE_URL).read())
    matches = Counter()
    for zone in sched["data"]["event"]["zones"]["nodes"]:
        for key in ("groupMatches", "knockoutMatches"):
            for m in zone.get(key, {}).get("nodes", []):
                if m.get("status") != "DONE":
                    continue
                for side in ("blueSide", "redSide"):
                    t = m.get(side, {}).get("player", {}).get("team", {})
                    if t.get("name"):
                        matches[t["name"]] += 1

    from compute_ratings import (
        rating_engineer, rating_radar, rating_dart, rating_combat,
    )

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute(
        """SELECT rr.id AS rid, rr.robot_type::text, t.name AS tn
           FROM robot_rating rr JOIN teams t ON rr.team_id = t.id
           WHERE rr.season = '2026'"""
    )
    updated = 0
    for row in cur.fetchall():
        cdn_team = cdn_robots.get(row["tn"])
        if not cdn_team:
            continue
        cr = cdn_team.get(row["robot_type"])
        if not cr:
            continue

        rt = row["robot_type"]
        if rt == "engineer":
            rating = rating_engineer(cr)
        elif rt == "radar":
            rating = rating_radar(cr)
        elif rt == "dart":
            rating = rating_dart(cr)
        else:
            rating = rating_combat(rt, cr)

        rating = max(0.1, min(5.0, rating))
        if not dry_run:
            cur.execute(
                "UPDATE robot_rating SET rating=%s, matches_played=%s, updated_at=now() WHERE id=%s",
                (rating, matches.get(row["tn"], 0), row["rid"]),
            )
        updated += 1

    if not dry_run:
        conn.commit()
    print(f"  ratings: {updated} rows {'(dry-run)' if dry_run else 'updated'}")
    conn.close()
    return True


# ── Step 4: Summary ────────────────────────────────────────────────

def print_summary(cdn_status: dict):
    """Print a human-readable summary of current data state."""
    print("\n" + "=" * 60)
    print("  数据状态摘要")
    print("=" * 60)

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # Events
    cur.execute("SELECT season, name FROM events ORDER BY season DESC LIMIT 5")
    print("\n  赛事:")
    for season, name in cur.fetchall():
        cur.execute(
            "SELECT COUNT(*) FROM matches WHERE event_id = (SELECT id FROM events WHERE season = %s LIMIT 1)",
            (season,),
        )
        mc = cur.fetchone()[0]
        print(f"    {season}  {name}: {mc} 场比赛")

    # Stages for 2026
    cur.execute(
        """SELECT es.name, es.stage_format::text,
                  COUNT(m.id) AS total,
                  COUNT(m.id) FILTER (WHERE m.status = 'finished') AS done
           FROM event_stages es
           JOIN events e ON es.event_id = e.id
           LEFT JOIN matches m ON m.stage_id = es.id
           WHERE e.season = '2026'
           GROUP BY es.id, es.name, es.stage_format, es.order_index
           ORDER BY es.order_index"""
    )
    print("\n  2026 赛区:")
    for name, fmt, total, done in cur.fetchall():
        bar = "█" * (done * 10 // max(total, 1)) + "░" * ((total - done) * 10 // max(total, 1))
        print(f"    {name} ({fmt}): {done}/{total} {bar}")

    # CDN zones
    if cdn_status:
        print("\n  CDN 数据:")
        for zone_name, s in cdn_status.items():
            done = s["done"]
            total = s["total"]
            pct = f"{done / max(total, 1) * 100:.0f}%" if total > 0 else "N/A"
            print(f"    {zone_name}: {done}/{total} done ({pct})  dates={s['dates']}")

    # Top Ratings
    cur.execute(
        """SELECT t.name, rr.robot_type::text, ROUND(rr.rating::numeric, 2) AS r
           FROM robot_rating rr JOIN teams t ON rr.team_id = t.id
           WHERE rr.season = '2026' AND rr.matches_played > 0
           ORDER BY rr.rating::float8 DESC LIMIT 5"""
    )
    print("\n  Top 5 Ratings:")
    for name, rt, r in cur.fetchall():
        print(f"    {name}  {rt}: {r}")

    cur.close()
    conn.close()
    print("=" * 60)


# ── Main ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="RM.tv 数据更新流水线")
    parser.add_argument("--skip-fetch", action="store_true", help="跳过 CDN 爬取")
    parser.add_argument("--skip-import", action="store_true", help="跳过数据库导入")
    parser.add_argument("--ratings-only", action="store_true", help="仅重算 Rating")
    parser.add_argument("--dry-run", action="store_true", help="预览而不写入数据库")
    args = parser.parse_args()

    start = time.time()
    cdn_status = {}

    # ── Step 1: CDN Fetch ──────────────────────────────────────
    if args.ratings_only:
        args.skip_fetch = True
        args.skip_import = True

    if not args.skip_fetch:
        print("\n── Step 1: CDN 爬取 ──")
        try:
            schedule = fetch_json("schedule")
            cdn_status = check_cdn_updated(schedule)
            # Also fetch robot_data for rating compute
            fetch_json("robot_data")
        except Exception as e:
            print(f"  CDN fetch failed: {e}")
            if not os.path.exists("/tmp/rmtv_pipeline_schedule.json"):
                print("  No cached data available, aborting.")
                sys.exit(1)
            print("  Continuing with cached data.")

    # ── Step 2: DB Import ─────────────────────────────────────
    if not args.skip_import:
        print("\n── Step 2: 数据库更新 ──")
        ok = run_import_script(dry_run=args.dry_run)
        if not ok and not args.dry_run:
            print("  ⚠ DB import had issues, continuing anyway...")

    # ── Step 3: Rating Recompute ───────────────────────────────
    print("\n── Step 3: Rating 重算 ──")
    run_rating_recompute(dry_run=args.dry_run)

    # ── Step 4: Summary ────────────────────────────────────────
    if not args.dry_run:
        print_summary(cdn_status)

    elapsed = time.time() - start
    print(f"\n流水线完成 ({elapsed:.1f}s)")


if __name__ == "__main__":
    main()
