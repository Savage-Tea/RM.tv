pub mod events;
pub mod matches;
pub mod teams;

use crate::db::Pool;
use axum::Router;

pub fn admin_routes() -> Router<Pool> {
    Router::new()
        .nest("/events", events::routes())
        .nest("/matches", matches::routes())
        .nest("/teams", teams::routes())
}
