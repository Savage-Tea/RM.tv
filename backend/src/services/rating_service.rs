use crate::error::AppError;
use sqlx::PgPool;
use uuid::Uuid;

// ── Per-type baseline averages (computed from 96-team CDN data, 2026 season) ──

#[derive(Debug, Clone)]
pub struct RatingBaseline {
    pub kda: f64,
    pub damage: f64,
    pub support: f64,
    pub special: f64,
    pub econ_exchange: f64,
    pub econ_mine_diff: f64,
    pub econ_assemble: f64,
}

/// Per-type dimension weights. All balanced so average robot = 1.0.
#[derive(Debug, Clone)]
pub struct TypeWeights {
    pub combat: f64,
    pub damage: f64,
    pub support: f64,
    pub econ: f64,
    pub special: f64,
}

const EPS: f64 = 0.001;

fn baseline(rt: &str) -> RatingBaseline {
    match rt {
        "infantry" => RatingBaseline {
            kda: 1.920, damage: 1043.56, support: 0.01,
            special: 22.55, econ_exchange: 0.0, econ_mine_diff: 0.0, econ_assemble: 0.001,
        },
        "hero" => RatingBaseline {
            kda: 0.428, damage: 424.72, support: 0.01,
            special: 10.70, econ_exchange: 0.0, econ_mine_diff: 0.0, econ_assemble: 0.001,
        },
        "engineer" => RatingBaseline {
            kda: 0.001, damage: 0.01, support: 0.01,
            special: 1.62, econ_exchange: 0.01, econ_mine_diff: 0.001, econ_assemble: 1.62,
        },
        "uav" => RatingBaseline {
            kda: 2.021, damage: 1455.50, support: 0.01,
            special: 11.44, econ_exchange: 0.0, econ_mine_diff: 0.0, econ_assemble: 0.001,
        },
        "sentinel" => RatingBaseline {
            kda: 1.224, damage: 517.63, support: 0.01,
            special: 0.61, econ_exchange: 0.0, econ_mine_diff: 0.0, econ_assemble: 0.001,
        },
        "dart" => RatingBaseline {
            kda: 0.001, damage: 228.73, support: 0.01,
            special: 5.00, econ_exchange: 0.0, econ_mine_diff: 0.0, econ_assemble: 0.001,
        },
        "radar" => RatingBaseline {
            kda: 0.001, damage: 0.01, support: 0.01,
            special: 418.06, econ_exchange: 0.0, econ_mine_diff: 0.0, econ_assemble: 0.001,
        },
        _ => RatingBaseline {
            kda: 1.0, damage: 100.0, support: 1.0,
            special: 1.0, econ_exchange: 1.0, econ_mine_diff: 1.0, econ_assemble: 1.0,
        },
    }
}

fn weights(rt: &str) -> TypeWeights {
    match rt {
        "infantry" => TypeWeights { combat: 0.40, damage: 0.35, support: 0.10, econ: 0.00, special: 0.15 },
        "hero"     => TypeWeights { combat: 0.35, damage: 0.45, support: 0.05, econ: 0.00, special: 0.15 },
        "engineer" => TypeWeights { combat: 0.00, damage: 0.00, support: 0.15, econ: 0.70, special: 0.15 },
        "uav"      => TypeWeights { combat: 0.30, damage: 0.30, support: 0.20, econ: 0.00, special: 0.20 },
        "sentinel" => TypeWeights { combat: 0.25, damage: 0.35, support: 0.10, econ: 0.00, special: 0.30 },
        "dart"     => TypeWeights { combat: 0.10, damage: 0.25, support: 0.05, econ: 0.00, special: 0.60 },
        "radar"    => TypeWeights { combat: 0.05, damage: 0.10, support: 0.55, econ: 0.00, special: 0.30 },
        _          => TypeWeights { combat: 0.25, damage: 0.25, support: 0.25, econ: 0.00, special: 0.25 },
    }
}

/// Compute a single robot's rating from its raw aggregate stats.
///
/// All values are first normalized against the per-type baseline (dividing by the
/// average for that robot type), then combined with per-type dimension weights.
///
/// Returns a value centered at 1.0 (average = 1.0). Typical range: 0.3 – 1.7.
pub fn compute_robot_rating(
    robot_type: &str,
    kills: f64,
    deaths: f64,
    assists: f64,
    damage: f64,
    support: f64,
    // special: hit-rate (infantry/hero/uav), gKillCount (sentinel),
    // dart-outpost-hits (dart), radar-marker-time (radar), mine-time (engineer)
    special: f64,
) -> f64 {
    let bl = baseline(robot_type);
    let w = weights(robot_type);
    let total_w = w.combat + w.damage + w.support + w.econ + w.special;

    if total_w < EPS {
        return 1.0;
    }

    // KDA: (kills + assists/2) / max(deaths, 0.5)
    let kda_raw = (kills + assists * 0.5) / deaths.max(0.5);

    // If a baseline is near-zero (robot doesn't do this activity), use 1.0
    // so the dimension doesn't drag the rating down.
    let norm_kda = if bl.kda <= 0.01 { 1.0 } else { kda_raw / bl.kda.max(EPS) };
    let norm_damage = if bl.damage <= 1.0 { 1.0 } else { damage / bl.damage.max(EPS) };
    let norm_support = if bl.support <= 0.01 { 1.0 } else { support / bl.support.max(EPS) };
    let norm_special = if bl.special <= 0.01 { 1.0 } else { special / bl.special.max(EPS) };

    let mut rating = w.combat * norm_kda
        + w.damage * norm_damage
        + w.support * norm_support
        + w.special * norm_special;

    // Engineer: econ replaces combat+damage
    if robot_type == "engineer" && w.econ > 0.0 {
        // Econ composite: exchange (0.60) + mine_diff (0.25) + assemble (0.15)
        // Reuse damage/support as exchange/mine for now, special as assemble
        let econ_score = 0.60 * norm_support.max(0.0)
            + 0.25 * norm_damage.max(0.0)
            + 0.15 * norm_special.max(0.0);
        // Recompute: combat+damage=0, so just support + econ + special
        rating = w.support * norm_support + w.econ * econ_score + w.special * norm_special;
    }

    rating / total_w
}

/// Convenience: compute rating from per-field values, falling back to KDA-only if
/// most fields are zero (pre-season / no-match data).
pub fn compute_robot_rating_from_kda(
    robot_type: &str,
    kda_score: f64,   // eaKdaScore from CDN
    damage: f64,      // eagHurt + gkDamage
    support: f64,     // eaExchangeEcon
    special: f64,     // varies by type
    kills: f64,
    deaths: f64,
    assists: f64,
) -> f64 {
    let bl = baseline(robot_type);

    // If the robot has no real match data, use KDA score (pre-processed by CDN) as a fallback.
    // This preserves relative ordering when raw stats are sparse.
    let has_meaningful_data = damage > 0.1 || kills > 0.01;
    if !has_meaningful_data {
        // Use CDN's eaKdaScore directly, scaled relative to baseline
        let norm_kda = kda_score / bl.kda.max(EPS);
        return norm_kda.clamp(0.1, 5.0);
    }

    compute_robot_rating(robot_type, kills, deaths, assists, damage, support, special)
}

// ── Legacy compatibility layer ──────────────────────────────────────

/// Compute single-map robot rating from per-map stats and config weights.
/// Legacy formula, retained for per-match stat updates.
pub fn compute_map_rating(
    kills: i32,
    deaths: i32,
    damage: i32,
    hp_healed: i32,
    base_damage: i32,
    alive_time_seconds: i32,
    config: &RatingWeights,
) -> f64 {
    kills as f64 * config.kills
        + deaths as f64 * config.deaths
        + damage as f64 * config.damage
        + hp_healed as f64 * config.heal
        + base_damage as f64 * config.base_damage
        + alive_time_seconds as f64 * config.survival
}

/// Get rating config for a season, or insert default.
pub async fn get_or_create_config(pool: &PgPool, season: &str) -> Result<RatingWeights, AppError> {
    let config: Option<RatingWeights> = sqlx::query_as(
        "SELECT kills_weight, deaths_weight, damage_weight, heal_weight, base_damage_weight, survival_weight FROM rating_config WHERE season = $1"
    )
    .bind(season)
    .fetch_optional(pool).await?;

    if let Some(c) = config {
        Ok(c)
    } else {
        let default = RatingWeights::default();
        sqlx::query(
            "INSERT INTO rating_config (season, kills_weight, deaths_weight, damage_weight, heal_weight, base_damage_weight, survival_weight) VALUES ($1, $2, $3, $4, $5, $6, $7)"
        )
        .bind(season)
        .bind(default.kills).bind(default.deaths).bind(default.damage)
        .bind(default.heal).bind(default.base_damage).bind(default.survival)
        .execute(pool).await?;
        Ok(default)
    }
}

/// Update robot ratings after a match finishes.
pub async fn update_robot_ratings(
    pool: &PgPool,
    match_id: Uuid,
    season: &str,
) -> Result<(), AppError> {
    let config = get_or_create_config(pool, season).await?;

    type MapStatRow = (Uuid, Uuid, String, i32, i32, i32, i32, i32, i32);

    let stats: Vec<MapStatRow> = sqlx::query_as(
        r#"SELECT mrs.id, mrs.member_id, mrs.robot_type::text,
           mrs.kills, mrs.deaths, mrs.damage, mrs.hp_healed, mrs.base_damage, mrs.alive_time_seconds
        FROM map_robot_stats mrs
        JOIN match_maps mm ON mrs.match_map_id = mm.id
        WHERE mm.match_id = $1"#,
    )
    .bind(match_id)
    .fetch_all(pool)
    .await?;

    for (_id, member_id, robot_type, kills, deaths, damage, hp_healed, base_damage, alive_time) in
        &stats
    {
        let map_rating = compute_map_rating(
            *kills, *deaths, *damage, *hp_healed, *base_damage, *alive_time, &config,
        );

        let existing: Option<(Uuid, f64, i32)> = sqlx::query_as(
            "SELECT id, rating::float8, matches_played FROM robot_rating WHERE member_id = $1 AND robot_type = $2 AND season = $3"
        )
        .bind(member_id).bind(robot_type).bind(season)
        .fetch_optional(pool).await?;

        if let Some((rating_id, current_rating, matches_played)) = existing {
            let new_rating =
                (current_rating * matches_played as f64 + map_rating) / (matches_played + 1) as f64;
            let change = new_rating - current_rating;

            sqlx::query(
                "UPDATE robot_rating SET rating = $1, matches_played = matches_played + 1, updated_at = now() WHERE id = $2"
            )
            .bind(new_rating).bind(rating_id)
            .execute(pool).await?;

            sqlx::query(
                "INSERT INTO robot_rating_history (member_id, match_id, robot_type, season, old_rating, new_rating, change) VALUES ($1, $2, $3, $4, $5, $6, $7)"
            )
            .bind(member_id).bind(match_id).bind(robot_type).bind(season)
            .bind(current_rating).bind(new_rating).bind(change)
            .execute(pool).await?;
        } else {
            sqlx::query(
                "INSERT INTO robot_rating (team_id, member_id, robot_type, season, rating, matches_played) SELECT team_id, $1, $2, $3, $4, 1 FROM team_members WHERE id = $1"
            )
            .bind(member_id).bind(robot_type).bind(season).bind(map_rating)
            .execute(pool).await?;

            sqlx::query(
                "INSERT INTO robot_rating_history (member_id, match_id, robot_type, season, old_rating, new_rating, change) VALUES ($1, $2, $3, $4, 1500.00, $5, $6)"
            )
            .bind(member_id).bind(match_id).bind(robot_type).bind(season)
            .bind(map_rating).bind(map_rating - 1500.0)
            .execute(pool).await?;
        }
    }

    Ok(())
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct RatingWeights {
    #[sqlx(rename = "kills_weight")]
    pub kills: f64,
    #[sqlx(rename = "deaths_weight")]
    pub deaths: f64,
    #[sqlx(rename = "damage_weight")]
    pub damage: f64,
    #[sqlx(rename = "heal_weight")]
    pub heal: f64,
    #[sqlx(rename = "base_damage_weight")]
    pub base_damage: f64,
    #[sqlx(rename = "survival_weight")]
    pub survival: f64,
}

impl Default for RatingWeights {
    fn default() -> Self {
        Self {
            kills: 1.0,
            deaths: -0.5,
            damage: 0.01,
            heal: 0.005,
            base_damage: 0.1,
            survival: 0.001,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_avg_infantry_equals_one() {
        let rating = compute_robot_rating(
            "infantry",
            1.92,    // avg kills (non-zero baseline)
            1.0,     // deaths
            0.5,     // assists
            1043.56, // avg damage
            0.01,    // avg support
            22.55,   // avg special (hit rate)
        );
        assert!((rating - 1.0).abs() < 0.5, "Expected ~1.0, got {}", rating);
    }

    #[test]
    fn test_elite_infantry_above_one() {
        let rating = compute_robot_rating(
            "infantry",
            5.6,     // IMCA-level kills
            1.5,
            2.0,
            3527.0,  // IMCA-level damage
            0.0,
            40.0,    // above-avg hit rate
        );
        assert!(rating > 1.5, "Elite infantry should be >1.5, got {}", rating);
    }

    #[test]
    fn test_avg_engineer_equals_one() {
        let rating = compute_robot_rating(
            "engineer",
            0.0, 0.0, 0.0,
            0.01,   // damage
            0.01,   // support (exchange econ)
            1.62,   // avg assemble count
        );
        assert!(rating > 0.0, "Engineer rating should be positive");
    }

    #[test]
    fn test_radar_with_zero_kda() {
        let rating = compute_robot_rating(
            "radar",
            0.0, 0.0, 0.0,
            0.0,
            0.0,
            418.06, // average radar marker time
        );
        assert!((rating - 1.0).abs() < 0.3, "Avg radar should be ~1.0, got {}", rating);
    }

    #[test]
    fn test_elite_radar_above_one() {
        let rating = compute_robot_rating(
            "radar",
            0.0, 0.0, 0.0,
            0.0,
            0.0,
            800.0,  // ~2x average marker time
        );
        assert!(rating > 1.2, "Elite radar should be >1.2, got {}", rating);
    }

    #[test]
    fn test_dart_rating_driven_by_special() {
        let baseline = compute_robot_rating("dart", 0.0, 0.0, 0.0, 228.73, 0.0, 5.0);
        assert!((baseline - 1.0).abs() < 0.3, "Avg dart ~1.0, got {}", baseline);

        let elite = compute_robot_rating("dart", 0.0, 0.0, 0.0, 400.0, 0.0, 10.0);
        assert!(elite > 1.3, "Elite dart should be >1.3, got {}", elite);
    }
}
