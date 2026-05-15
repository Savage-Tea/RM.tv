use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Match {
    pub id: Uuid,
    pub event_id: Uuid,
    pub stage_id: Option<Uuid>,
    pub team_a_id: Uuid,
    pub team_b_id: Uuid,
    pub score_a: Option<i32>,
    pub score_b: Option<i32>,
    pub format: String,
    pub status: String,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub bracket_position: Option<String>,
    pub round: Option<i32>,
    pub group_name: Option<String>,
    pub vod_url: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MatchMap {
    pub id: Uuid,
    pub match_id: Uuid,
    pub map_name: String,
    pub order_index: i32,
    pub score_a: Option<i32>,
    pub score_b: Option<i32>,
    pub duration_seconds: Option<i32>,
    pub played_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MatchParticipant {
    pub id: Uuid,
    pub match_id: Uuid,
    pub team_id: Uuid,
    pub member_id: Uuid,
    pub robot_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MapRobotStats {
    pub id: Uuid,
    pub match_map_id: Uuid,
    pub member_id: Uuid,
    pub robot_type: String,
    pub kills: i32,
    pub deaths: i32,
    pub damage: i32,
    pub hp_healed: i32,
    pub base_damage: i32,
    pub alive_time_seconds: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchDetail {
    #[serde(flatten)]
    pub match_data: Match,
    pub team_a_name: String,
    pub team_b_name: String,
    pub team_a_abbreviation: Option<String>,
    pub team_b_abbreviation: Option<String>,
    pub maps: Vec<MatchMap>,
    pub participants: Vec<MatchParticipant>,
    pub robot_stats: Vec<MapRobotStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MatchSummary {
    pub id: Uuid,
    pub event_id: Uuid,
    pub event_name: String,
    pub team_a_id: Uuid,
    pub team_a_name: String,
    pub team_b_id: Uuid,
    pub team_b_name: String,
    pub score_a: Option<i32>,
    pub score_b: Option<i32>,
    pub format: String,
    pub status: String,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub group_name: Option<String>,
}
