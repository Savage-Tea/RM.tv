mod admin;
mod auth;
mod events;
mod health;
mod matches;
mod rankings;
mod stats;
mod teams;

use crate::db::Pool;
use axum::Router;

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
