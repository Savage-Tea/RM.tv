use axum::{
    http::{header, StatusCode},
    response::IntoResponse,
    Extension, Json,
};
use serde_json::json;
use crate::auth::jwt;
use crate::config::Config;

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: uuid::Uuid,
    pub username: String,
}

pub async fn require_auth(
    Extension(config): Extension<Config>,
    headers: axum::http::HeaderMap,
    mut request: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> Result<axum::http::Response<axum::body::Body>, StatusCode> {
    let auth_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "));

    let token = match auth_header {
        Some(t) => t,
        None => {
            return Ok((
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Missing authorization token" })),
            ).into_response());
        }
    };

    let claims = match jwt::decode_token(token, &config.jwt_secret) {
        Ok(c) => c,
        Err(_) => {
            return Ok((
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Invalid or expired token" })),
            ).into_response());
        }
    };

    let user = AuthUser {
        user_id: claims.sub,
        username: claims.username,
    };

    request.extensions_mut().insert(user);

    Ok(next.run(request).await)
}
