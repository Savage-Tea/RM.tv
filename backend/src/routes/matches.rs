use crate::db::Pool;
use crate::error::AppError;
use crate::models::{MatchDetail, MatchSummary, PaginatedResponse};
use crate::services::match_service;
use axum::routing::get;
use axum::{
    Json, Router,
    extract::{Path, Query, State},
};
use serde::Deserialize;
use uuid::Uuid;

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
        match_service::ListMatchesParams {
            event_id: params.event_id,
            stage_id: params.stage_id,
            team_id: params.team_id,
            status: params.status.as_deref(),
            page: params.page.unwrap_or(1),
            per_page: params.per_page.unwrap_or(20),
            sort: params.sort.as_deref().unwrap_or("scheduled_at"),
            order: params.order.as_deref().unwrap_or("desc"),
        },
    )
    .await?;
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
        .route("/:id", get(get_match))
}
