use crate::db::Pool;
use axum::{Router, extract::State, response::Json, routing::get};
use serde_json::{Value, json};

pub fn routes() -> Router<Pool> {
    Router::new().route("/health", get(health_check))
}

async fn health_check(State(pool): State<Pool>) -> Result<Json<Value>, crate::error::AppError> {
    sqlx::query("SELECT 1").execute(&pool).await?;

    Ok(Json(json!({
        "status": "ok",
        "database": "connected"
    })))
}
