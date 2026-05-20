use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Event {
    pub id: Uuid,
    pub name: String,
    pub series: String,
    pub season: String,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub location: Option<String>,
    pub status: String,
    pub logo_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EventStage {
    pub id: Uuid,
    pub event_id: Uuid,
    pub name: String,
    pub stage_format: String,
    pub stage_type: String,
    pub order_index: i32,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EventEntrySummary {
    pub id: Uuid,
    pub event_id: Uuid,
    pub team_id: Uuid,
    pub team_name: String,
    pub team_abbreviation: Option<String>,
    pub university: String,
    pub logo_url: Option<String>,
    pub seed: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventDetail {
    #[serde(flatten)]
    pub event: Event,
    pub stages: Vec<EventStage>,
    pub entries: Vec<EventEntrySummary>,
}
