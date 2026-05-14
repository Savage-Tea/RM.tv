use sqlx::postgres::PgPoolOptions;

pub type Pool = sqlx::PgPool;

pub async fn init_pool(database_url: &str) -> Result<Pool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(20)
        .connect(database_url)
        .await
}
