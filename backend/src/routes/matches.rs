use axum::{
    extract::{Path, Query, State},
    Json, Router,
};
use axum::routing::get;
use serde::Deserialize;
use uuid::Uuid;
use crate::db::Pool;
use crate::error::AppError;
use crate::models::{MatchSummary, MatchDetail, PaginatedResponse};
use crate::services::match_service;

#[derive(Deserialize)]
pub struct ListMatchesQuery {
    pub event_id: Option<Uuid>,
    pub stage_id: Option<Uuid>,
    pub team_id: Option<Uuid>,
    pub status: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub sort: Option<String>,
    pub order: Option<String>,
}

async fn list_matches(
    State(pool): State<Pool>,
    Query(params): Query<ListMatchesQuery>,
) -> Result<Json<PaginatedResponse<MatchSummary>>, AppError> {
    let result = match_service::list_matches(
        &pool,
        params.event_id,
        params.stage_id,
        params.team_id,
        params.status.as_deref(),
        params.page.unwrap_or(1),
        params.per_page.unwrap_or(20),
        params.sort.as_deref().unwrap_or("scheduled_at"),
        params.order.as_deref().unwrap_or("desc"),
    ).await?;
    Ok(Json(result))
}

async fn get_match(
    State(pool): State<Pool>,
    Path(id): Path<Uuid>,
) -> Result<Json<MatchDetail>, AppError> {
    let result = match_service::get_match(&pool, id).await?;
    Ok(Json(result))
}

pub fn routes() -> Router<Pool> {
    Router::new()
        .route("/", get(list_matches))
        .route("/{id}", get(get_match))
}
