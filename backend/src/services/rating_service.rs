use sqlx::PgPool;
use uuid::Uuid;
use crate::error::AppError;

/// Compute single-map robot rating from stats and config weights.
///
/// Formula: Rating = kills*w_k + deaths*w_d + damage*w_dmg + heal*w_h + base_damage*w_b + survival_seconds*w_s
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

    // Get all map stats for this match
    let stats: Vec<(Uuid, Uuid, String, i32, i32, i32, i32, i32, i32)> = sqlx::query_as(
        r#"SELECT mrs.id, mrs.member_id, mrs.robot_type,
           mrs.kills, mrs.deaths, mrs.damage, mrs.hp_healed, mrs.base_damage, mrs.alive_time_seconds
        FROM map_robot_stats mrs
        JOIN match_maps mm ON mrs.match_map_id = mm.id
        WHERE mm.match_id = $1"#
    )
    .bind(match_id)
    .fetch_all(pool).await?;

    for (_id, member_id, robot_type, kills, deaths, damage, hp_healed, base_damage, alive_time) in &stats {
        let map_rating = compute_map_rating(*kills, *deaths, *damage, *hp_healed, *base_damage, *alive_time, &config);

        // Get or create robot_rating
        let existing: Option<(Uuid, f64, i32)> = sqlx::query_as(
            "SELECT id, rating, matches_played FROM robot_rating WHERE member_id = $1 AND robot_type = $2 AND season = $3"
        )
        .bind(member_id).bind(robot_type).bind(season)
        .fetch_optional(pool).await?;

        if let Some((rating_id, current_rating, matches_played)) = existing {
            // Weighted average: new rating counts as 1 match
            let new_rating = (current_rating * matches_played as f64 + map_rating) / (matches_played + 1) as f64;
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
            // First match for this member/robot/season combo
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
    fn test_compute_map_rating_default_weights() {
        let config = RatingWeights::default();
        let rating = compute_map_rating(10, 5, 5000, 2000, 1000, 300, &config);
        // 10*1.0 + 5*(-0.5) + 5000*0.01 + 2000*0.005 + 1000*0.1 + 300*0.001
        // = 10 - 2.5 + 50 + 10 + 100 + 0.3 = 167.8
        assert!((rating - 167.8).abs() < 0.01);
    }

    #[test]
    fn test_compute_map_rating_zero_stats() {
        let config = RatingWeights::default();
        let rating = compute_map_rating(0, 0, 0, 0, 0, 0, &config);
        assert!((rating - 0.0).abs() < 0.01);
    }

    #[test]
    fn test_compute_map_rating_custom_weights() {
        let config = RatingWeights {
            kills: 2.0, deaths: -1.0, damage: 0.02,
            heal: 0.01, base_damage: 0.2, survival: 0.002,
        };
        let rating = compute_map_rating(5, 2, 1000, 500, 200, 100, &config);
        // 5*2 + 2*(-1) + 1000*0.02 + 500*0.01 + 200*0.2 + 100*0.002
        // = 10 - 2 + 20 + 5 + 40 + 0.2 = 73.2
        assert!((rating - 73.2).abs() < 0.01);
    }
}
