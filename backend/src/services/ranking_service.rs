use sqlx::PgPool;
use uuid::Uuid;
use crate::error::AppError;
use crate::models::{TeamEloHistory, RankingEntry, PaginatedResponse};

pub async fn list_rankings(
    pool: &PgPool,
    season: &str,
    page: i64,
    per_page: i64,
) -> Result<PaginatedResponse<RankingEntry>, AppError> {
    let offset = (page - 1) * per_page;

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM team_elo WHERE season = $1"
    )
    .bind(season)
    .fetch_one(pool)
    .await?;

    let rankings: Vec<RankingEntry> = sqlx::query_as(
        r#"SELECT
            ROW_NUMBER() OVER (ORDER BY te.rating DESC) as rank,
            te.team_id,
            t.name as team_name,
            t.abbreviation as team_abbreviation,
            te.rating,
            te.matches_played
        FROM team_elo te
        JOIN teams t ON te.team_id = t.id
        WHERE te.season = $1
        ORDER BY te.rating DESC
        LIMIT $2 OFFSET $3"#
    )
    .bind(season)
    .bind(per_page)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    Ok(PaginatedResponse::new(rankings, total.0, page, per_page))
}

pub async fn get_ranking_history(
    pool: &PgPool,
    team_id: Uuid,
    season: &str,
) -> Result<Vec<TeamEloHistory>, AppError> {
    let history: Vec<TeamEloHistory> = sqlx::query_as(
        r#"SELECT * FROM team_elo_history
        WHERE team_id = $1 AND season = $2
        ORDER BY recorded_at ASC"#
    )
    .bind(team_id)
    .bind(season)
    .fetch_all(pool)
    .await?;

    Ok(history)
}
