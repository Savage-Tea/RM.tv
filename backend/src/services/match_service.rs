use sqlx::PgPool;
use uuid::Uuid;
use crate::error::AppError;
use crate::models::{Match, MatchMap, MatchParticipant, MapRobotStats, MatchDetail, MatchSummary, PaginatedResponse};

pub async fn list_matches(
    pool: &PgPool,
    event_id: Option<Uuid>,
    stage_id: Option<Uuid>,
    team_id: Option<Uuid>,
    status: Option<&str>,
    page: i64,
    per_page: i64,
    sort: &str,
    order: &str,
) -> Result<PaginatedResponse<MatchSummary>, AppError> {
    let offset = (page - 1) * per_page;

    let sort_col = match sort {
        "scheduled_at" => "m.scheduled_at",
        "created_at" => "m.created_at",
        _ => "m.scheduled_at",
    };
    let sort_order = if order.eq_ignore_ascii_case("asc") { "ASC" } else { "DESC" };

    let query = format!(
        r#"SELECT m.id, m.event_id, e.name as event_name,
           m.team_a_id, ta.name as team_a_name,
           m.team_b_id, tb.name as team_b_name,
           m.score_a, m.score_b, m.format, m.status,
           m.scheduled_at, m.group_name
           FROM matches m
           JOIN teams ta ON m.team_a_id = ta.id
           JOIN teams tb ON m.team_b_id = tb.id
           JOIN events e ON m.event_id = e.id
           WHERE ($1::uuid IS NULL OR m.event_id = $1)
             AND ($2::uuid IS NULL OR m.stage_id = $2)
             AND ($3::uuid IS NULL OR m.team_a_id = $3 OR m.team_b_id = $3)
             AND ($4::text IS NULL OR m.status = $4)
           ORDER BY {} {}
           LIMIT $5 OFFSET $6"#,
        sort_col, sort_order
    );

    let count_query = format!(
        r#"SELECT COUNT(*)
           FROM matches m
           WHERE ($1::uuid IS NULL OR m.event_id = $1)
             AND ($2::uuid IS NULL OR m.stage_id = $2)
             AND ($3::uuid IS NULL OR m.team_a_id = $3 OR m.team_b_id = $3)
             AND ($4::text IS NULL OR m.status = $4)"#
    );

    let total: (i64,) = sqlx::query_as(&count_query)
        .bind(event_id).bind(stage_id).bind(team_id).bind(status)
        .fetch_one(pool).await?;

    let matches: Vec<MatchSummary> = sqlx::query_as(&query)
        .bind(event_id).bind(stage_id).bind(team_id).bind(status)
        .bind(per_page).bind(offset)
        .fetch_all(pool).await?;

    Ok(PaginatedResponse::new(matches, total.0, page, per_page))
}

pub async fn get_match(pool: &PgPool, id: Uuid) -> Result<MatchDetail, AppError> {
    let match_data: Match = sqlx::query_as("SELECT * FROM matches WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Match not found".into()))?;

    let maps: Vec<MatchMap> = sqlx::query_as(
        "SELECT * FROM match_maps WHERE match_id = $1 ORDER BY order_index"
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    let participants: Vec<MatchParticipant> = sqlx::query_as(
        "SELECT * FROM match_participants WHERE match_id = $1"
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    let map_ids: Vec<Uuid> = maps.iter().map(|m| m.id).collect();
    let mut robot_stats = Vec::new();
    for map_id in &map_ids {
        let stats: Vec<MapRobotStats> = sqlx::query_as(
            "SELECT * FROM map_robot_stats WHERE match_map_id = $1"
        )
        .bind(map_id)
        .fetch_all(pool)
        .await?;
        robot_stats.extend(stats);
    }

    Ok(MatchDetail { match_data, maps, participants, robot_stats })
}
