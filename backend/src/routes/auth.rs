use crate::auth::{jwt, password};
use crate::config::Config;
use crate::db::Pool;
use crate::error::AppError;
use axum::routing::post;
use axum::{Extension, Json, Router, extract::State};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

#[derive(Deserialize)]
struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Serialize)]
struct LoginResponse {
    access_token: String,
    user: UserInfo,
}

#[derive(Serialize)]
struct UserInfo {
    id: Uuid,
    username: String,
}

#[derive(Deserialize, Serialize, sqlx::FromRow)]
struct AdminUser {
    id: Uuid,
    username: String,
    password_hash: String,
}

async fn login(
    State(pool): State<Pool>,
    Extension(config): Extension<Config>,
    jar: CookieJar,
    Json(body): Json<LoginRequest>,
) -> Result<(CookieJar, Json<LoginResponse>), AppError> {
    let user: Option<AdminUser> =
        sqlx::query_as("SELECT id, username, password_hash FROM admin_users WHERE username = $1")
            .bind(&body.username)
            .fetch_optional(&pool)
            .await?;

    let user = match user {
        Some(u) => u,
        None => return Err(AppError::BadRequest("Invalid username or password".into())),
    };

    let valid = password::verify_password(&body.password, &user.password_hash)
        .map_err(|e| AppError::Internal(format!("Password verification failed: {}", e)))?;

    if !valid {
        return Err(AppError::BadRequest("Invalid username or password".into()));
    }

    let access_token = jwt::encode_token(user.id, &user.username, &config.jwt_secret, 15)
        .map_err(|e| AppError::Internal(format!("Token generation failed: {}", e)))?;

    let refresh_token = jwt::encode_token(user.id, &user.username, &config.jwt_secret, 60 * 24 * 7)
        .map_err(|e| AppError::Internal(format!("Token generation failed: {}", e)))?;

    let refresh_cookie = Cookie::build(("refresh_token", refresh_token))
        .path("/api/auth")
        .http_only(true)
        .secure(false)
        .same_site(axum_extra::extract::cookie::SameSite::Strict)
        .build();

    Ok((
        jar.add(refresh_cookie),
        Json(LoginResponse {
            access_token,
            user: UserInfo {
                id: user.id,
                username: user.username,
            },
        }),
    ))
}

async fn refresh(
    _pool: State<Pool>,
    Extension(config): Extension<Config>,
    jar: CookieJar,
) -> Result<(CookieJar, Json<serde_json::Value>), AppError> {
    let refresh_token = jar
        .get("refresh_token")
        .map(|c| c.value().to_string())
        .ok_or_else(|| AppError::BadRequest("Missing refresh token".into()))?;

    let claims = jwt::decode_token(&refresh_token, &config.jwt_secret)
        .map_err(|_| AppError::BadRequest("Invalid or expired refresh token".into()))?;

    let new_access = jwt::encode_token(claims.sub, &claims.username, &config.jwt_secret, 15)
        .map_err(|e| AppError::Internal(format!("Token generation failed: {}", e)))?;

    Ok((jar, Json(json!({ "access_token": new_access }))))
}

async fn logout(jar: CookieJar) -> (CookieJar, Json<serde_json::Value>) {
    let removal = Cookie::build(("refresh_token", ""))
        .path("/api/auth")
        .http_only(true)
        .build();
    (
        jar.remove(removal),
        Json(json!({ "message": "Logged out" })),
    )
}

pub fn routes() -> Router<Pool> {
    Router::new()
        .route("/login", post(login))
        .route("/refresh", post(refresh))
        .route("/logout", post(logout))
}
