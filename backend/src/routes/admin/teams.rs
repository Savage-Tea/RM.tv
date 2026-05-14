use crate::auth::middleware::require_auth;
use crate::config::Config;
use crate::db::Pool;
use crate::error::AppError;
use crate::models::Team;
use crate::services::team_service::{self, CreateTeamInput, UpdateTeamInput};
use axum::routing::{post, put};
use axum::{
    Extension, Json, Router,
    extract::{Path, State},
};
use uuid::Uuid;

async fn create_team(
    State(pool): State<Pool>,
    Extension(_config): Extension<Config>,
    Json(input): Json<CreateTeamInput>,
) -> Result<Json<Team>, AppError> {
    let team = team_service::create_team(&pool, input).await?;
    Ok(Json(team))
}

async fn update_team(
    State(pool): State<Pool>,
    Extension(_config): Extension<Config>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateTeamInput>,
) -> Result<Json<Team>, AppError> {
    let team = team_service::update_team(&pool, id, input).await?;
    Ok(Json(team))
}

pub fn routes() -> Router<Pool> {
    Router::new()
        .route("/", post(create_team))
        .route("/{id}", put(update_team))
        .route_layer(axum::middleware::from_fn_with_state((), require_auth))
}
