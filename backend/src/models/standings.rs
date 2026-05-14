use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StageStandings {
    pub id: Uuid,
    pub stage_id: Uuid,
    pub team_id: Uuid,
    pub rank: i32,
    pub wins: i32,
    pub losses: i32,
    pub draws: i32,
    pub map_wins: i32,
    pub map_losses: i32,
    pub points: i32,
    pub buchholz_score: Option<f64>,
}
