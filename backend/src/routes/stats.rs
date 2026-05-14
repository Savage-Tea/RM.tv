use axum::{
    extract::Query,
    extract::State,
    Json, Router,
};
use axum::routing::get;
use serde::Deserialize;
use crate::db::Pool;
use crate::error::AppError;
use crate::models::{RobotRating, PaginatedResponse};
use crate::services::stats_service;

#[derive(Deserialize)]
pub struct RobotStatsQuery {
    pub season: Option<String>,
    pub robot_type: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub sort: Option<String>,
    pub order: Option<String>,
}

async fn list_robot_stats(
    State(pool): State<Pool>,
    Query(params): Query<RobotStatsQuery>,
) -> Result<Json<PaginatedResponse<RobotRating>>, AppError> {
    let season = params.season.unwrap_or_else(|| "2025".into());
    let result = stats_service::list_robot_ratings(
        &pool,
        &season,
        params.robot_type.as_deref(),
        params.page.unwrap_or(1),
        params.per_page.unwrap_or(20),
        params.sort.as_deref().unwrap_or("rating"),
        params.order.as_deref().unwrap_or("desc"),
    ).await?;
    Ok(Json(result))
}

pub fn routes() -> Router<Pool> {
    Router::new()
        .route("/robots", get(list_robot_stats))
}
