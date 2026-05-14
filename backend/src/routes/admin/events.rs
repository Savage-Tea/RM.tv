use crate::auth::middleware::require_auth;
use crate::config::Config;
use crate::db::Pool;
use crate::error::AppError;
use crate::models::{Event, EventStage};
use crate::services::event_service::{self, CreateEventInput, CreateStageInput, UpdateEventInput};
use axum::routing::{post, put};
use axum::{
    Extension, Json, Router,
    extract::{Path, State},
};
use uuid::Uuid;

async fn create_event(
    State(pool): State<Pool>,
    Extension(_config): Extension<Config>,
    Json(input): Json<CreateEventInput>,
) -> Result<Json<Event>, AppError> {
    let event = event_service::create_event(&pool, input).await?;
    Ok(Json(event))
}

async fn update_event(
    State(pool): State<Pool>,
    Extension(_config): Extension<Config>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateEventInput>,
) -> Result<Json<Event>, AppError> {
    let event = event_service::update_event(&pool, id, input).await?;
    Ok(Json(event))
}

async fn delete_event(
    State(pool): State<Pool>,
    Extension(_config): Extension<Config>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    event_service::delete_event(&pool, id).await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

async fn create_event_stage(
    State(pool): State<Pool>,
    Extension(_config): Extension<Config>,
    Path(event_id): Path<Uuid>,
    Json(input): Json<CreateStageInput>,
) -> Result<Json<EventStage>, AppError> {
    let stage = event_service::create_stage(&pool, event_id, input).await?;
    Ok(Json(stage))
}

pub fn routes() -> Router<Pool> {
    Router::new()
        .route("/", post(create_event))
        .route("/:id", put(update_event).delete(delete_event))
        .route("/:event_id/stages", post(create_event_stage))
        .route_layer(axum::middleware::from_fn_with_state((), require_auth))
}
