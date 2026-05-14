mod health;

use axum::Router;
use crate::db::Pool;

pub fn api_routes() -> Router<Pool> {
    Router::new()
        .merge(health::routes())
}
