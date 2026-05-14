use crate::error::AppError;
use sqlx::PgPool;
use uuid::Uuid;

/// Expected win probability using standard Elo formula.
pub fn expected(rating_a: f64, rating_b: f64) -> f64 {
    1.0 / (1.0 + 10.0_f64.powf((rating_b - rating_a) / 400.0))
}

/// K-factor based on match experience.
/// Higher K for newer teams (fewer matches played).
pub fn k_factor(matches_played: i32) -> f64 {
    if matches_played < 10 {
        32.0
    } else if matches_played < 30 {
        24.0
    } else {
        16.0
    }
}

/// Update Elo ratings for both teams after a match.
pub async fn update_after_match(
    pool: &PgPool,
    match_id: Uuid,
    season: &str,
) -> Result<(), AppError> {
    // Get match data
    let match_data: (Uuid, Uuid, Option<i32>, Option<i32>) =
        sqlx::query_as("SELECT team_a_id, team_b_id, score_a, score_b FROM matches WHERE id = $1")
            .bind(match_id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| AppError::NotFound("Match not found".into()))?;

    let (team_a_id, team_b_id, score_a, score_b) = match_data;
    let sa = score_a.ok_or_else(|| AppError::BadRequest("Match has no scores".into()))?;
    let sb = score_b.ok_or_else(|| AppError::BadRequest("Match has no scores".into()))?;

    // Get or create Elo records
    let elo_a = get_or_create_elo(pool, team_a_id, season).await?;
    let elo_b = get_or_create_elo(pool, team_b_id, season).await?;

    // Calculate expected scores
    let ea = expected(elo_a.rating, elo_b.rating);
    let eb = expected(elo_b.rating, elo_a.rating);

    // Actual scores (1 for win, 0 for loss, 0.5 for draw)
    let (sa_actual, sb_actual) = if sa > sb {
        (1.0, 0.0)
    } else if sb > sa {
        (0.0, 1.0)
    } else {
        (0.5, 0.5)
    };

    // K-factors
    let ka = k_factor(elo_a.matches_played);
    let kb = k_factor(elo_b.matches_played);

    // New ratings
    let new_rating_a = elo_a.rating + ka * (sa_actual - ea);
    let new_rating_b = elo_b.rating + kb * (sb_actual - eb);
    let change_a = new_rating_a - elo_a.rating;
    let change_b = new_rating_b - elo_b.rating;

    // Update team_elo table
    sqlx::query(
        "UPDATE team_elo SET rating = $1, matches_played = matches_played + 1, updated_at = now() WHERE id = $2"
    )
    .bind(new_rating_a).bind(elo_a.id)
    .execute(pool).await?;

    sqlx::query(
        "UPDATE team_elo SET rating = $1, matches_played = matches_played + 1, updated_at = now() WHERE id = $2"
    )
    .bind(new_rating_b).bind(elo_b.id)
    .execute(pool).await?;

    // Insert history
    sqlx::query(
        "INSERT INTO team_elo_history (team_id, match_id, season, old_rating, new_rating, change) VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(team_a_id).bind(match_id).bind(season)
    .bind(elo_a.rating).bind(new_rating_a).bind(change_a)
    .execute(pool).await?;

    sqlx::query(
        "INSERT INTO team_elo_history (team_id, match_id, season, old_rating, new_rating, change) VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(team_b_id).bind(match_id).bind(season)
    .bind(elo_b.rating).bind(new_rating_b).bind(change_b)
    .execute(pool).await?;

    Ok(())
}

/// Apply season decay: ratings regress toward 1500 by 33%.
pub async fn season_decay(pool: &PgPool, season: &str) -> Result<(), AppError> {
    sqlx::query("UPDATE team_elo SET rating = 1500.0 + (rating - 1500.0) * 0.67 WHERE season = $1")
        .bind(season)
        .execute(pool)
        .await?;

    Ok(())
}

struct EloRecord {
    id: Uuid,
    rating: f64,
    matches_played: i32,
}

async fn get_or_create_elo(
    pool: &PgPool,
    team_id: Uuid,
    season: &str,
) -> Result<EloRecord, AppError> {
    let existing: Option<(Uuid, f64, i32)> = sqlx::query_as(
        "SELECT id, rating::float8, matches_played FROM team_elo WHERE team_id = $1 AND season = $2",
    )
    .bind(team_id)
    .bind(season)
    .fetch_optional(pool)
    .await?;

    if let Some((id, rating, matches_played)) = existing {
        Ok(EloRecord {
            id,
            rating,
            matches_played,
        })
    } else {
        let id = Uuid::new_v4();
        sqlx::query("INSERT INTO team_elo (id, team_id, season) VALUES ($1, $2, $3)")
            .bind(id)
            .bind(team_id)
            .bind(season)
            .execute(pool)
            .await?;

        Ok(EloRecord {
            id,
            rating: 1500.0,
            matches_played: 0,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_expected_equal() {
        let e = expected(1500.0, 1500.0);
        assert!((e - 0.5).abs() < 0.001);
    }

    #[test]
    fn test_expected_favorite() {
        let e = expected(1600.0, 1400.0);
        assert!(e > 0.5);
        assert!(e < 1.0);
    }

    #[test]
    fn test_k_factor_new() {
        assert_eq!(k_factor(0), 32.0);
        assert_eq!(k_factor(5), 32.0);
    }

    #[test]
    fn test_k_factor_experienced() {
        assert_eq!(k_factor(15), 24.0);
        assert_eq!(k_factor(50), 16.0);
    }
}
