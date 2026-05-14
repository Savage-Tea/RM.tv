use sqlx::PgPool;
use uuid::Uuid;
use crate::error::AppError;
use crate::models::{Event, EventStage, EventEntry, EventDetail, PaginatedResponse};

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
