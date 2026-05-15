use crate::db::Pool;
use crate::error::AppError;
use crate::models::{Event, EventDetail, PaginatedResponse};
use crate::services::stage_service::StageOverview;
use crate::services::{event_service, stage_service};
use axum::routing::get;
use axum::{
    Json, Router,
    extract::{Path, Query, State},
};
use serde::Deserialize;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct ListEventsQuery {
    pub season: Option<String>,
    pub status: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub sort: Option<String>,
    pub order: Option<String>,
}

async fn list_events(
    State(pool): State<Pool>,
    Query(params): Query<ListEventsQuery>,
) -> Result<Json<PaginatedResponse<Event>>, AppError> {
    let result = event_service::list_events(
        &pool,
        params.season.as_deref(),
        params.status.as_deref(),
        params.page.unwrap_or(1),
        params.per_page.unwrap_or(20),
        params.sort.as_deref().unwrap_or("start_date"),
        params.order.as_deref().unwrap_or("desc"),
    )
    .await?;
    Ok(Json(result))
}

async fn get_event(
    State(pool): State<Pool>,
    Path(id): Path<Uuid>,
) -> Result<Json<EventDetail>, AppError> {
    let result = event_service::get_event(&pool, id).await?;
    Ok(Json(result))
}

async fn get_stage_overview(
    State(pool): State<Pool>,
    Path((_event_id, stage_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<StageOverview>, AppError> {
    let result = stage_service::get_stage_overview(&pool, stage_id).await?;
    Ok(Json(result))
}

pub fn routes() -> Router<Pool> {
    Router::new()
        .route("/", get(list_events))
        .route("/:id", get(get_event))
        .route("/:event_id/stages/:stage_id", get(get_stage_overview))
}
