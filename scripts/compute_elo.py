#!/usr/bin/env python3
"""Compute Elo ratings with Margin-of-Victory (MOV) and seasonal blending.

Per-season Elo is computed independently (each season starts at 1500), then
blended with time decay:

    blended = (current * 1.0 + prev * 0.5 + prev_prev * 0.25)
            / sum_of_available_weights

Run:
    python compute_elo.py                  # MOV-Elo + seasonal blend (default)
    python compute_elo.py --basic          # Standard Elo, no MOV
    python compute_elo.py --no-blend       # Current season only, no time decay
    python compute_elo.py --lambda 0.8     # Custom MOV strength
"""

import argparse
import math
import os
import uuid
import hashlib
import sys

import psycopg2

DB_URL = os.environ.get("DATABASE_URL", "postgresql://rmtv:rmtv_dev@localhost:5432/rmtv")

# ── MOV parameters ────────────────────────────────────────────────────
MOV_LAMBDA = 0.6
MAX_MAPS = {"bo1": 1, "bo3": 3, "bo5": 5, "bo7": 7}

# ── Seasonal blending weights ─────────────────────────────────────────
# Most recent season = 1.0, previous = 0.5, two seasons back = 0.25
SEASON_WEIGHTS = [1.0, 0.5, 0.25]


def stable_uuid(*parts):
    s = "|".join(str(p) for p in parts)
    return str(uuid.UUID(hashlib.md5(s.encode()).hexdigest()))


def expected(rating_a, rating_b):
    return 1.0 / (1.0 + 10.0 ** ((rating_b - rating_a) / 400.0))


def k_factor(matches_played):
    if matches_played < 10:
        return 32.0
    elif matches_played < 30:
        return 24.0
    else:
        return 16.0


def max_maps_for_format(fmt):
    if fmt is None:
        return 3
    return MAX_MAPS.get(fmt.lower(), 3)


def margin_factor(mov, max_maps, lam=MOV_LAMBDA):
    if mov <= 0 or max_maps <= 1:
        return 1.0
    return 1.0 + lam * (mov / max_maps)


def get_seasons(cur):
    """Return all seasons with finished matches, ordered most recent first."""
    cur.execute("""
        SELECT DISTINCT e.season
        FROM matches m
        JOIN event_stages es ON m.stage_id = es.id
        JOIN events e ON es.event_id = e.id
        WHERE m.status = 'finished'
          AND m.score_a IS NOT NULL
          AND m.score_b IS NOT NULL
        ORDER BY e.season DESC
    """)
    return [row[0] for row in cur.fetchall()]


def compute_season_elo(cur, season, lam):
    """Compute per-season Elo ratings. Returns {team_id: (rating, match_count)}."""
    cur.execute("""
        SELECT m.id, m.team_a_id, m.team_b_id,
               m.score_a, m.score_b,
               m.format::text AS fmt
        FROM matches m
        JOIN event_stages es ON m.stage_id = es.id
        JOIN events e ON es.event_id = e.id
        WHERE m.status = 'finished'
          AND m.score_a IS NOT NULL
          AND m.score_b IS NOT NULL
          AND e.season = %s
        ORDER BY m.scheduled_at, m.round
    """, (season,))
    matches = cur.fetchall()

    ratings = {}
    counts = {}

    for match_id, team_a, team_b, score_a, score_b, fmt in matches:
        for tid in (team_a, team_b):
            if tid not in ratings:
                ratings[tid] = 1500.0
                counts[tid] = 0

        ra = ratings[team_a]
        rb = ratings[team_b]

        if score_a > score_b:
            sa, sb = 1.0, 0.0
        elif score_b > score_a:
            sa, sb = 0.0, 1.0
        else:
            sa, sb = 0.5, 0.5

        ea = expected(ra, rb)

        mov = abs((score_a or 0) - (score_b or 0))
        max_maps = max_maps_for_format(fmt)
        mf = margin_factor(mov, max_maps, lam)

        ka = k_factor(counts[team_a]) * mf
        kb = k_factor(counts[team_b]) * mf

        ratings[team_a] = ra + ka * (sa - ea)
        ratings[team_b] = rb + kb * (sb - (1.0 - ea))

        counts[team_a] += 1
        counts[team_b] += 1

    return {tid: (round(ratings[tid], 2), counts[tid]) for tid in ratings}


def blend_seasons(seasonal_data):
    """Blend per-season ratings with time decay.

    seasonal_data: list of (season, {team_id: (rating, matches)})
                   ordered most recent first.

    All teams share the same denominator (sum of SEASON_WEIGHTS[0:N]).
    Missing seasons default to 1500 (Elo neutral starting point).
    """
    # Collect all teams
    all_teams = set()
    for _season, data in seasonal_data:
        all_teams.update(data.keys())

    # Fixed weights for the most recent N seasons
    n = min(len(seasonal_data), len(SEASON_WEIGHTS))
    weights = SEASON_WEIGHTS[:n]
    weight_total = sum(weights)

    blended = {}
    for tid in all_teams:
        weighted_sum = 0.0
        total_matches = 0

        for i in range(n):
            _season, data = seasonal_data[i]
            w = weights[i]
            if tid in data:
                rating, matches = data[tid]
                weighted_sum += rating * w
                total_matches += matches
            else:
                # Team absent this season — default to 1500
                weighted_sum += 1500.0 * w

        blended[tid] = (round(weighted_sum / weight_total, 2), total_matches)

    return blended


def write_elo(cur, data, season, clear=True):
    """Write Elo ratings to team_elo and team_elo_history."""
    if clear:
        cur.execute("DELETE FROM team_elo_history WHERE season = %s", (season,))
        cur.execute("DELETE FROM team_elo WHERE season = %s", (season,))

    for tid, (rating, matches) in data.items():
        cur.execute(
            """INSERT INTO team_elo (id, team_id, season, rating, matches_played, updated_at)
               VALUES (%s, %s, %s, %s, %s, now())
               ON CONFLICT (team_id, season)
               DO UPDATE SET rating = EXCLUDED.rating,
                             matches_played = EXCLUDED.matches_played,
                             updated_at = now()""",
            (stable_uuid("elo", str(tid), season), str(tid), season, rating, matches),
        )


def compute_elo(lam=MOV_LAMBDA, blend=True):
    """Main entry: compute per-season Elo and optionally blend."""
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    seasons = get_seasons(cur)
    if not seasons:
        print("No seasons with finished matches found.")
        conn.close()
        return

    mov_label = f"MOV-λ={lam}" if lam > 0 else "standard Elo"
    print(f"Seasons: {', '.join(seasons[:5])}{'...' if len(seasons) > 5 else ''}")
    print(f"Algorithm: {mov_label}")
    print(f"Blend:     {'current×1.0 + prev×0.5 + prev_prev×0.25' if blend else 'none (current season only)'}")
    print()

    # ── Per-season computation ────────────────────────────────────────
    seasonal_data = []
    for season in seasons:
        data = compute_season_elo(cur, season, lam)
        if data:
            n_teams = len(data)
            n_matches = sum(c for _, (_, c) in data.items()) // 2
            print(f"  {season}: {n_matches} matches, {n_teams} teams rated")
            write_elo(cur, data, season)
            seasonal_data.append((season, data))
        else:
            print(f"  {season}: no data")

    conn.commit()

    # ── Seasonal blending ─────────────────────────────────────────────
    if blend and len(seasonal_data) >= 1:
        blended = blend_seasons(seasonal_data)
        write_elo(cur, blended, "blended", clear=True)
        conn.commit()

        # Show top blended rankings
        sorted_teams = sorted(blended.items(), key=lambda x: -x[1][0])
        print(f"\n  Blended top 10 ({len(blended)} teams):")
        cur.execute("SELECT id, name FROM teams")
        team_names = {str(r[0]): r[1] for r in cur.fetchall()}

        for rank, (tid, (rating, matches)) in enumerate(sorted_teams[:10], 1):
            name = team_names.get(str(tid), str(tid)[:8])
            print(f"    {rank:2d}. {name:30s}  {rating:7.1f}  ({matches} matches)")

    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compute Elo ratings with MOV and seasonal blending")
    parser.add_argument("--basic", action="store_true",
                        help="Use standard Elo (no MOV)")
    parser.add_argument("--no-blend", action="store_true",
                        help="Skip seasonal blending, store per-season only")
    parser.add_argument("--lambda", type=float, default=None, dest="lam",
                        help="MOV strength (0 = no MOV, default 0.6)")
    args = parser.parse_args()

    lam = 0.0 if args.basic else (args.lam if args.lam is not None else MOV_LAMBDA)
    compute_elo(lam=lam, blend=not args.no_blend)
