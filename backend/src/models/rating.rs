use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TeamElo {
    pub id: Uuid,
    pub team_id: Uuid,
    pub season: String,
    pub rating: f64,
    pub matches_played: i32,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TeamEloHistory {
    pub id: Uuid,
    pub team_id: Uuid,
    pub match_id: Option<Uuid>,
    pub season: String,
    pub old_rating: f64,
    pub new_rating: f64,
    pub change: f64,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RatingConfig {
    pub id: Uuid,
    pub season: String,
    pub kills_weight: f64,
    pub deaths_weight: f64,
    pub damage_weight: f64,
    pub heal_weight: f64,
    pub base_damage_weight: f64,
    pub survival_weight: f64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RobotRating {
    pub id: Uuid,
    pub team_id: Uuid,
    pub member_id: Uuid,
    pub robot_type: String,
    pub season: String,
    pub rating: f64,
    pub matches_played: i32,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RobotRatingHistory {
    pub id: Uuid,
    pub member_id: Uuid,
    pub match_id: Option<Uuid>,
    pub robot_type: String,
    pub season: String,
    pub old_rating: f64,
    pub new_rating: f64,
    pub change: f64,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RankingEntry {
    pub rank: i64,
    pub team_id: Uuid,
    pub team_name: String,
    pub team_abbreviation: Option<String>,
    pub rating: f64,
    pub matches_played: i32,
}
