use axum::{
    extract::{Path, State},
    Extension, Json, Router,
};
use axum::routing::{post, put};
use uuid::Uuid;
use crate::auth::middleware::require_auth;
use crate::config::Config;
use crate::db::Pool;
use crate::error::AppError;
use crate::models::Match;
use crate::services::match_service::{self, CreateMatchInput, UpdateMatchInput};

async fn create_match(
    State(pool): State<Pool>,
    Extension(_config): Extension<Config>,
    Json(input): Json<CreateMatchInput>,
) -> Result<Json<Match>, AppError> {
    let m = match_service::create_match(&pool, input).await?;
    Ok(Json(m))
}

async fn update_match(
    State(pool): State<Pool>,
    Extension(_config): Extension<Config>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateMatchInput>,
) -> Result<Json<Match>, AppError> {
    let m = match_service::update_match(&pool, id, input).await?;
    Ok(Json(m))
}

pub fn routes() -> Router<Pool> {
    Router::new()
        .route("/", post(create_match))
        .route("/{id}", put(update_match))
        .route_layer(axum::middleware::from_fn_with_state((), require_auth))
}
