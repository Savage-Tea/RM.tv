use crate::error::AppError;
use crate::models::{PaginatedResponse, RobotRating};
use sqlx::PgPool;

pub async fn list_robot_ratings(
    pool: &PgPool,
    season: &str,
    robot_type: Option<&str>,
    page: i64,
    per_page: i64,
    sort: &str,
    order: &str,
) -> Result<PaginatedResponse<RobotRating>, AppError> {
    let offset = (page - 1) * per_page;

    let sort_col = match sort {
        "rating" => "rr.rating",
        "matches_played" => "rr.matches_played",
        _ => "rr.rating",
    };
    let sort_order = if order.eq_ignore_ascii_case("asc") {
        "ASC"
    } else {
        "DESC"
    };

    let cols = "rr.id, rr.team_id, t.name AS team_name, t.abbreviation AS team_abbreviation, rr.member_id, rr.robot_type::text AS robot_type, rr.season, rr.rating::float8 AS rating, rr.matches_played, rr.updated_at";

    let (total, ratings) = match robot_type {
        Some(rt) => {
            let total: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM robot_rating rr JOIN teams t ON rr.team_id = t.id WHERE rr.season = $1 AND rr.robot_type::text = $2",
            )
            .bind(season)
            .bind(rt)
            .fetch_one(pool)
            .await?;

            let ratings: Vec<RobotRating> = sqlx::query_as(&format!(
                "SELECT {} FROM robot_rating rr JOIN teams t ON rr.team_id = t.id WHERE rr.season = $1 AND rr.robot_type::text = $2 ORDER BY {} {} LIMIT $3 OFFSET $4",
                cols, sort_col, sort_order
            ))
            .bind(season).bind(rt).bind(per_page).bind(offset)
            .fetch_all(pool).await?;

            (total.0, ratings)
        }
        None => {
            let total: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM robot_rating rr JOIN teams t ON rr.team_id = t.id WHERE rr.season = $1")
                    .bind(season)
                    .fetch_one(pool)
                    .await?;

            let ratings: Vec<RobotRating> = sqlx::query_as(&format!(
                "SELECT {} FROM robot_rating rr JOIN teams t ON rr.team_id = t.id WHERE rr.season = $1 ORDER BY {} {} LIMIT $2 OFFSET $3",
                cols, sort_col, sort_order
            ))
            .bind(season).bind(per_page).bind(offset)
            .fetch_all(pool).await?;

            (total.0, ratings)
        }
    };

    Ok(PaginatedResponse::new(ratings, total, page, per_page))
}
