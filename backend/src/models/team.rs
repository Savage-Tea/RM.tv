use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::models::MatchSummary;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Team {
    pub id: Uuid,
    pub name: String,
    pub name_en: Option<String>,
    pub university: String,
    pub abbreviation: Option<String>,
    pub logo_url: Option<String>,
    pub founded_year: Option<i32>,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TeamMember {
    pub id: Uuid,
    pub team_id: Uuid,
    pub name: String,
    pub role: String,
    pub avatar_url: Option<String>,
    pub joined_year: Option<i32>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MemberRobotRole {
    pub id: Uuid,
    pub member_id: Uuid,
    pub robot_type: String,
    pub is_primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamDetail {
    #[serde(flatten)]
    pub team: Team,
    pub members: Vec<TeamMemberWithRoles>,
    pub robot_ratings: Vec<TeamRobotRating>,
    pub recent_matches: Vec<MatchSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamMemberWithRoles {
    #[serde(flatten)]
    pub member: TeamMember,
    pub robot_roles: Vec<MemberRobotRole>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TeamRobotRating {
    pub robot_type: String,
    pub rating: Option<f64>,
    pub matches_played: Option<i32>,
}
