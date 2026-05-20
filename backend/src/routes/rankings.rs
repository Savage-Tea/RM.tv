use crate::db::Pool;
use crate::error::AppError;
use crate::models::{PaginatedResponse, RankingEntry, TeamEloHistory};
use crate::services::ranking_service;
use axum::routing::get;
use axum::{
    Json, Router,
    extract::{Path, Query, State},
};
use serde::Deserialize;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct ListRankingsQuery {
    pub season: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

async fn list_rankings(
    State(pool): State<Pool>,
    Query(params): Query<ListRankingsQuery>,
) -> Result<Json<PaginatedResponse<RankingEntry>>, AppError> {
    let season = params.season.unwrap_or_else(|| "blended".into());
    let result = ranking_service::list_rankings(
        &pool,
        &season,
        params.page.unwrap_or(1),
        params.per_page.unwrap_or(50),
    )
    .await?;
    Ok(Json(result))
}

#[derive(Deserialize)]
pub struct RankingHistoryQuery {
    pub season: Option<String>,
}

async fn get_ranking_history(
    State(pool): State<Pool>,
    Path(team_id): Path<Uuid>,
    Query(params): Query<RankingHistoryQuery>,
) -> Result<Json<Vec<TeamEloHistory>>, AppError> {
    let season = params.season.unwrap_or_else(|| "blended".into());
    let result = ranking_service::get_ranking_history(&pool, team_id, &season).await?;
    Ok(Json(result))
}

pub fn routes() -> Router<Pool> {
    Router::new()
        .route("/", get(list_rankings))
        .route("/:team_id/history", get(get_ranking_history))
}
