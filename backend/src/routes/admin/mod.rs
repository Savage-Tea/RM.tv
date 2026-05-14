pub mod events;
pub mod matches;
pub mod teams;

use axum::Router;
use crate::db::Pool;

pub fn admin_routes() -> Router<Pool> {
    Router::new()
        .nest("/events", events::routes())
        .nest("/matches", matches::routes())
        .nest("/teams", teams::routes())
}
