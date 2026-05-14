use chrono::NaiveDate;
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;
use crate::error::AppError;
use crate::models::{Event, EventStage, EventEntry, EventDetail, PaginatedResponse};

#[derive(Deserialize)]
pub struct CreateEventInput {
    pub name: String,
    pub series: String,
    pub season: String,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub location: Option<String>,
    pub status: Option<String>,
    pub logo_url: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateEventInput {
    pub name: Option<String>,
    pub series: Option<String>,
    pub season: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub location: Option<String>,
    pub status: Option<String>,
    pub logo_url: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateStageInput {
    pub name: String,
    pub stage_format: String,
    pub stage_type: String,
    pub order_index: i32,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
}

pub async fn list_events(
    pool: &PgPool,
    season: Option<&str>,
    status: Option<&str>,
    page: i64,
    per_page: i64,
    sort: &str,
    order: &str,
) -> Result<PaginatedResponse<Event>, AppError> {
    let offset = (page - 1) * per_page;

    // Build dynamic query safely with whitelisted sort column
    let sort_col = match sort {
        "name" => "name",
        "start_date" => "start_date",
        "created_at" => "created_at",
        _ => "start_date",
    };
    let sort_order = if order.eq_ignore_ascii_case("asc") { "ASC" } else { "DESC" };

    let (total, events) = match (season, status) {
        (Some(s), Some(st)) => {
            let total: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM events WHERE season = $1 AND status = $2"
            )
            .bind(s).bind(st).fetch_one(pool).await?;

            let events: Vec<Event> = sqlx::query_as(&format!(
                "SELECT * FROM events WHERE season = $1 AND status = $2 ORDER BY {} {} LIMIT $3 OFFSET $4",
                sort_col, sort_order
            ))
            .bind(s).bind(st).bind(per_page).bind(offset)
            .fetch_all(pool).await?;

            (total.0, events)
        }
        (Some(s), None) => {
            let total: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM events WHERE season = $1"
            )
            .bind(s).fetch_one(pool).await?;

            let events: Vec<Event> = sqlx::query_as(&format!(
                "SELECT * FROM events WHERE season = $1 ORDER BY {} {} LIMIT $2 OFFSET $3",
                sort_col, sort_order
            ))
            .bind(s).bind(per_page).bind(offset)
            .fetch_all(pool).await?;

            (total.0, events)
        }
        (None, Some(st)) => {
            let total: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM events WHERE status = $1"
            )
            .bind(st).fetch_one(pool).await?;

            let events: Vec<Event> = sqlx::query_as(&format!(
                "SELECT * FROM events WHERE status = $1 ORDER BY {} {} LIMIT $2 OFFSET $3",
                sort_col, sort_order
            ))
            .bind(st).bind(per_page).bind(offset)
            .fetch_all(pool).await?;

            (total.0, events)
        }
        (None, None) => {
            let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM events")
                .fetch_one(pool).await?;

            let events: Vec<Event> = sqlx::query_as(&format!(
                "SELECT * FROM events ORDER BY {} {} LIMIT $1 OFFSET $2",
                sort_col, sort_order
            ))
            .bind(per_page).bind(offset)
            .fetch_all(pool).await?;

            (total.0, events)
        }
    };

    Ok(PaginatedResponse::new(events, total, page, per_page))
}

pub async fn get_event(pool: &PgPool, id: Uuid) -> Result<EventDetail, AppError> {
    let event: Event = sqlx::query_as("SELECT * FROM events WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Event not found".into()))?;

    let stages: Vec<EventStage> = sqlx::query_as(
        "SELECT * FROM event_stages WHERE event_id = $1 ORDER BY order_index"
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    let entries: Vec<EventEntry> = sqlx::query_as(
        "SELECT * FROM event_entries WHERE event_id = $1 ORDER BY seed ASC NULLS LAST"
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    Ok(EventDetail { event, stages, entries })
}

pub async fn create_event(pool: &PgPool, input: CreateEventInput) -> Result<Event, AppError> {
    let event: Event = sqlx::query_as(
        "INSERT INTO events (name, series, season, start_date, end_date, location, status, logo_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *"
    )
    .bind(&input.name)
    .bind(&input.series)
    .bind(&input.season)
    .bind(input.start_date)
    .bind(input.end_date)
    .bind(&input.location)
    .bind(input.status.as_deref().unwrap_or("upcoming"))
    .bind(&input.logo_url)
    .fetch_one(pool)
    .await?;
    Ok(event)
}

pub async fn update_event(pool: &PgPool, id: Uuid, input: UpdateEventInput) -> Result<Event, AppError> {
    let existing: Event = sqlx::query_as("SELECT * FROM events WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Event not found".into()))?;

    let event: Event = sqlx::query_as(
        "UPDATE events SET name = $1, series = $2, season = $3, start_date = $4, end_date = $5, location = $6, status = $7, logo_url = $8, updated_at = now() WHERE id = $9 RETURNING *"
    )
    .bind(input.name.as_deref().unwrap_or(&existing.name))
    .bind(input.series.as_deref().unwrap_or(&existing.series))
    .bind(input.season.as_deref().unwrap_or(&existing.season))
    .bind(input.start_date.or(existing.start_date))
    .bind(input.end_date.or(existing.end_date))
    .bind(input.location.as_deref().or(existing.location.as_deref()))
    .bind(input.status.as_deref().unwrap_or(&existing.status))
    .bind(input.logo_url.as_deref().or(existing.logo_url.as_deref()))
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(event)
}

pub async fn delete_event(pool: &PgPool, id: Uuid) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM events WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Event not found".into()));
    }
    Ok(())
}

pub async fn create_stage(pool: &PgPool, event_id: Uuid, input: CreateStageInput) -> Result<EventStage, AppError> {
    let event_exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM events WHERE id = $1")
        .bind(event_id)
        .fetch_one(pool)
        .await?;
    if event_exists.0 == 0 {
        return Err(AppError::NotFound("Event not found".into()));
    }

    let stage: EventStage = sqlx::query_as(
        "INSERT INTO event_stages (event_id, name, stage_format, stage_type, order_index, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *"
    )
    .bind(event_id)
    .bind(&input.name)
    .bind(&input.stage_format)
    .bind(&input.stage_type)
    .bind(input.order_index)
    .bind(input.start_date)
    .bind(input.end_date)
    .fetch_one(pool)
    .await?;
    Ok(stage)
}
