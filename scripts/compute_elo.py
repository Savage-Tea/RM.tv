#!/usr/bin/env python3
"""Compute initial Elo ratings from finished matches and populate team_elo/team_elo_history."""

import os
import uuid
import hashlib
from datetime import datetime, timezone

import psycopg2

DB_URL = os.environ.get("DATABASE_URL", "postgresql://rmtv:rmtv_dev@localhost:5432/rmtv")

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

def compute_elo():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # Get all finished matches ordered by round/scheduled_at
    cur.execute("""
        SELECT m.id, m.team_a_id, m.team_b_id, m.score_a, m.score_b, m.round
        FROM matches m
        WHERE m.status = 'finished' AND m.score_a IS NOT NULL AND m.score_b IS NOT NULL
        ORDER BY m.round, m.scheduled_at
    """)
    matches = cur.fetchall()

    if not matches:
        print("No finished matches found.")
        conn.close()
        return

    print(f"Computing Elo for {len(matches)} finished matches...")

    # Track current ratings and match counts per team
    ratings = {}  # team_id -> rating
    match_counts = {}  # team_id -> count

    updates = 0

    for match_id, team_a, team_b, score_a, score_b, round_num in matches:
        # Initialize ratings
        for tid in (team_a, team_b):
            if tid not in ratings:
                ratings[tid] = 1500.0
                match_counts[tid] = 0

        ra = ratings[team_a]
        rb = ratings[team_b]

        # Determine winner
        if score_a > score_b:
            sa, sb = 1.0, 0.0
        elif score_b > score_a:
            sa, sb = 0.0, 1.0
        else:
            sa, sb = 0.5, 0.5

        ea = expected(ra, rb)
        eb = 1.0 - ea

        ka = k_factor(match_counts[team_a])
        kb = k_factor(match_counts[team_b])

        new_ra = ra + ka * (sa - ea)
        new_rb = rb + kb * (sb - eb)

        change_a = new_ra - ra
        change_b = new_rb - rb

        # Upsert team_elo
        for tid, rating, count in [(team_a, new_ra, match_counts[team_a] + 1),
                                     (team_b, new_rb, match_counts[team_b] + 1)]:
            cur.execute("""
                INSERT INTO team_elo (id, team_id, season, rating, matches_played, updated_at)
                VALUES (%s, %s, '2026', %s, %s, now())
                ON CONFLICT (team_id, season)
                DO UPDATE SET rating = EXCLUDED.rating,
                              matches_played = EXCLUDED.matches_played,
                              updated_at = now()
            """, (stable_uuid("elo", str(tid), "2026"), str(tid), round(rating, 2), count))

        # Insert history records
        for tid, old_r, new_r, change in [(team_a, ra, new_ra, change_a),
                                             (team_b, rb, new_rb, change_b)]:
            cur.execute("""
                INSERT INTO team_elo_history (id, team_id, match_id, season, old_rating, new_rating, change, recorded_at)
                VALUES (%s, %s, %s, '2026', %s, %s, %s, now())
            """, (stable_uuid("elo_hist", str(tid), str(match_id)),
                  str(tid), str(match_id),
                  round(old_r, 2), round(new_r, 2), round(change, 2)))

        ratings[team_a] = new_ra
        ratings[team_b] = new_rb
        match_counts[team_a] += 1
        match_counts[team_b] += 1
        updates += 1

    conn.commit()
    cur.execute("SELECT count(*) FROM team_elo WHERE season = '2026'")
    count = cur.fetchone()[0]
    print(f"Done. {updates} match results processed, {count} team Elo ratings written.")
    conn.close()

if __name__ == "__main__":
    compute_elo()
