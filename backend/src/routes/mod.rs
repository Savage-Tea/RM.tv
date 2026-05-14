mod health;
mod events;
mod matches;
mod teams;
mod rankings;
mod stats;
mod auth;
mod admin;

use axum::Router;
use crate::db::Pool;

pub fn api_routes() -> Router<Pool> {
    Router::new()
        .merge(health::routes())
        .nest("/events", events::routes())
        .nest("/matches", matches::routes())
        .nest("/teams", teams::routes())
        .nest("/rankings", rankings::routes())
        .nest("/stats", stats::routes())
        .nest("/auth", auth::routes())
        .nest("/admin", admin::admin_routes())
}
