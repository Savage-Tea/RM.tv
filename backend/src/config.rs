#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub api_host: String,
    pub api_port: u16,
    pub cors_origin: String,
    pub jwt_secret: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();

        Ok(Self {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://rmtv:rmtv_dev@localhost:5432/rmtv".into()),
            api_host: std::env::var("API_HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            api_port: std::env::var("API_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3000),
            cors_origin: std::env::var("CORS_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:5173".into()),
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "dev-secret-change-me".into()),
        })
    }
}
