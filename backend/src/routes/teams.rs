use crate::db::Pool;
use crate::error::AppError;
use crate::models::{PaginatedResponse, Team, TeamDetail};
use crate::services::team_service;
use axum::routing::get;
use axum::{
    Json, Router,
    extract::{Path, Query, State},
};
use serde::Deserialize;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct ListTeamsQuery {
    pub search: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

async fn list_teams(
    State(pool): State<Pool>,
    Query(params): Query<ListTeamsQuery>,
) -> Result<Json<PaginatedResponse<Team>>, AppError> {
    let result = team_service::list_teams(
        &pool,
        params.search.as_deref(),
        params.page.unwrap_or(1),
        params.per_page.unwrap_or(20),
    )
    .await?;
    Ok(Json(result))
}

async fn get_team(
    State(pool): State<Pool>,
    Path(id): Path<Uuid>,
) -> Result<Json<TeamDetail>, AppError> {
    let result = team_service::get_team(&pool, id).await?;
    Ok(Json(result))
}

pub fn routes() -> Router<Pool> {
    Router::new()
        .route("/", get(list_teams))
        .route("/{id}", get(get_team))
}
