use crate::error::AppError;
use crate::models::{
    MapRobotStats, Match, MatchDetail, MatchMap, MatchParticipant, MatchSummary, PaginatedResponse,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct CreateMatchInput {
    pub event_id: Uuid,
    pub stage_id: Option<Uuid>,
    pub team_a_id: Uuid,
    pub team_b_id: Uuid,
    pub format: Option<String>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub bracket_position: Option<String>,
    pub round: Option<i32>,
    pub group_name: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateMatchInput {
    pub score_a: Option<i32>,
    pub score_b: Option<i32>,
    pub status: Option<String>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub bracket_position: Option<String>,
    pub round: Option<i32>,
    pub group_name: Option<String>,
}

pub struct ListMatchesParams<'a> {
    pub event_id: Option<Uuid>,
    pub stage_id: Option<Uuid>,
    pub team_id: Option<Uuid>,
    pub status: Option<&'a str>,
    pub page: i64,
    pub per_page: i64,
    pub sort: &'a str,
    pub order: &'a str,
}

pub async fn list_matches(
    pool: &PgPool,
    params: ListMatchesParams<'_>,
) -> Result<PaginatedResponse<MatchSummary>, AppError> {
    let ListMatchesParams {
        event_id,
        stage_id,
        team_id,
        status,
        page,
        per_page,
        sort,
        order,
    } = params;

    let offset = (page - 1) * per_page;

    let sort_col = match sort {
        "scheduled_at" => "m.scheduled_at",
        "created_at" => "m.created_at",
        _ => "m.scheduled_at",
    };
    let sort_order = if order.eq_ignore_ascii_case("asc") {
        "ASC"
    } else {
        "DESC"
    };

    let query = format!(
        r#"SELECT m.id, m.event_id, e.name as event_name,
           m.team_a_id, ta.name as team_a_name,
           m.team_b_id, tb.name as team_b_name,
           m.score_a, m.score_b, m.format::text AS format, m.status::text AS status,
           m.scheduled_at, m.group_name
           FROM matches m
           JOIN teams ta ON m.team_a_id = ta.id
           JOIN teams tb ON m.team_b_id = tb.id
           JOIN events e ON m.event_id = e.id
           WHERE ($1::uuid IS NULL OR m.event_id = $1)
             AND ($2::uuid IS NULL OR m.stage_id = $2)
             AND ($3::uuid IS NULL OR m.team_a_id = $3 OR m.team_b_id = $3)
             AND ($4::text IS NULL OR m.status::text = $4)
           ORDER BY {} {}
           LIMIT $5 OFFSET $6"#,
        sort_col, sort_order
    );

    let total: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*)
           FROM matches m
           WHERE ($1::uuid IS NULL OR m.event_id = $1)
             AND ($2::uuid IS NULL OR m.stage_id = $2)
             AND ($3::uuid IS NULL OR m.team_a_id = $3 OR m.team_b_id = $3)
             AND ($4::text IS NULL OR m.status::text = $4)"#,
    )
    .bind(event_id)
    .bind(stage_id)
    .bind(team_id)
    .bind(status)
    .fetch_one(pool)
    .await?;

    let matches: Vec<MatchSummary> = sqlx::query_as(&query)
        .bind(event_id)
        .bind(stage_id)
        .bind(team_id)
        .bind(status)
        .bind(per_page)
        .bind(offset)
        .fetch_all(pool)
        .await?;

    Ok(PaginatedResponse::new(matches, total.0, page, per_page))
}

#[derive(Debug, sqlx::FromRow)]
struct MatchWithTeams {
    id: Uuid,
    event_id: Uuid,
    stage_id: Option<Uuid>,
    team_a_id: Uuid,
    team_b_id: Uuid,
    team_a_name: String,
    team_b_name: String,
    team_a_abbreviation: Option<String>,
    team_b_abbreviation: Option<String>,
    score_a: Option<i32>,
    score_b: Option<i32>,
    format: String,
    status: String,
    scheduled_at: Option<DateTime<Utc>>,
    started_at: Option<DateTime<Utc>>,
    finished_at: Option<DateTime<Utc>>,
    bracket_position: Option<String>,
    round: Option<i32>,
    group_name: Option<String>,
    vod_url: Option<String>,
    created_at: DateTime<Utc>,
}

pub async fn get_match(pool: &PgPool, id: Uuid) -> Result<MatchDetail, AppError> {
    let row = sqlx::query_as::<_, MatchWithTeams>(
        r#"SELECT m.id, m.event_id, m.stage_id,
           m.team_a_id, m.team_b_id,
           ta.name as team_a_name, tb.name as team_b_name,
           ta.abbreviation as team_a_abbreviation,
           tb.abbreviation as team_b_abbreviation,
           m.score_a, m.score_b,
           m.format::text AS format, m.status::text AS status,
           m.scheduled_at, m.started_at, m.finished_at,
           m.bracket_position, m.round, m.group_name,
           m.vod_url, m.created_at
           FROM matches m
           JOIN teams ta ON m.team_a_id = ta.id
           JOIN teams tb ON m.team_b_id = tb.id
           WHERE m.id = $1"#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Match not found".into()))?;

    let match_data = Match {
        id: row.id,
        event_id: row.event_id,
        stage_id: row.stage_id,
        team_a_id: row.team_a_id,
        team_b_id: row.team_b_id,
        score_a: row.score_a,
        score_b: row.score_b,
        format: row.format,
        status: row.status,
        scheduled_at: row.scheduled_at,
        started_at: row.started_at,
        finished_at: row.finished_at,
        bracket_position: row.bracket_position,
        round: row.round,
        group_name: row.group_name,
        vod_url: row.vod_url,
        created_at: row.created_at,
    };

    let maps: Vec<MatchMap> =
        sqlx::query_as("SELECT * FROM match_maps WHERE match_id = $1 ORDER BY order_index")
            .bind(id)
            .fetch_all(pool)
            .await?;

    let participants: Vec<MatchParticipant> =
        sqlx::query_as("SELECT id, match_id, team_id, member_id, robot_type::text AS robot_type FROM match_participants WHERE match_id = $1")
            .bind(id)
            .fetch_all(pool)
            .await?;

    let map_ids: Vec<Uuid> = maps.iter().map(|m| m.id).collect();
    let mut robot_stats = Vec::new();
    for map_id in &map_ids {
        let stats: Vec<MapRobotStats> =
            sqlx::query_as("SELECT id, match_map_id, member_id, robot_type::text AS robot_type, kills, deaths, damage, hp_healed, base_damage, alive_time_seconds FROM map_robot_stats WHERE match_map_id = $1")
                .bind(map_id)
                .fetch_all(pool)
                .await?;
        robot_stats.extend(stats);
    }

    Ok(MatchDetail {
        match_data,
        team_a_name: row.team_a_name,
        team_b_name: row.team_b_name,
        team_a_abbreviation: row.team_a_abbreviation,
        team_b_abbreviation: row.team_b_abbreviation,
        maps,
        participants,
        robot_stats,
    })
}

pub async fn create_match(pool: &PgPool, input: CreateMatchInput) -> Result<Match, AppError> {
    let m: Match = sqlx::query_as(
        "INSERT INTO matches (event_id, stage_id, team_a_id, team_b_id, format, scheduled_at, bracket_position, round, group_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, event_id, stage_id, team_a_id, team_b_id, score_a, score_b, format::text AS format, status::text AS status, scheduled_at, started_at, finished_at, bracket_position, round, group_name, vod_url, created_at"
    )
    .bind(input.event_id)
    .bind(input.stage_id)
    .bind(input.team_a_id)
    .bind(input.team_b_id)
    .bind(input.format.as_deref().unwrap_or("bo3"))
    .bind(input.scheduled_at)
    .bind(&input.bracket_position)
    .bind(input.round)
    .bind(&input.group_name)
    .fetch_one(pool)
    .await?;
    Ok(m)
}

pub async fn update_match(
    pool: &PgPool,
    id: Uuid,
    input: UpdateMatchInput,
) -> Result<Match, AppError> {
    let existing: Match = sqlx::query_as("SELECT id, event_id, stage_id, team_a_id, team_b_id, score_a, score_b, format::text AS format, status::text AS status, scheduled_at, started_at, finished_at, bracket_position, round, group_name, vod_url, created_at FROM matches WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Match not found".into()))?;

    let m: Match = sqlx::query_as(
        "UPDATE matches SET score_a = $1, score_b = $2, status = $3, scheduled_at = $4, started_at = $5, finished_at = $6, bracket_position = $7, round = $8, group_name = $9 WHERE id = $10 RETURNING id, event_id, stage_id, team_a_id, team_b_id, score_a, score_b, format::text AS format, status::text AS status, scheduled_at, started_at, finished_at, bracket_position, round, group_name, vod_url, created_at"
    )
    .bind(input.score_a.or(existing.score_a))
    .bind(input.score_b.or(existing.score_b))
    .bind(input.status.as_deref().unwrap_or(&existing.status))
    .bind(input.scheduled_at.or(existing.scheduled_at))
    .bind(input.started_at.or(existing.started_at))
    .bind(input.finished_at.or(existing.finished_at))
    .bind(input.bracket_position.as_deref().or(existing.bracket_position.as_deref()))
    .bind(input.round.or(existing.round))
    .bind(input.group_name.as_deref().or(existing.group_name.as_deref()))
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(m)
}
