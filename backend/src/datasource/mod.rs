use async_trait::async_trait;
use chrono::NaiveDate;
use uuid::Uuid;

pub mod manual;
pub mod mock;

#[derive(Debug, Clone)]
pub struct EventInput {
    pub name: String,
    pub series: String,
    pub season: String,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub location: Option<String>,
    pub stages: Vec<StageInput>,
    pub entries: Vec<Uuid>,
}

#[derive(Debug, Clone)]
pub struct StageInput {
    pub name: String,
    pub stage_format: String,
    pub stage_type: String,
    pub order_index: i32,
    pub progression_to: Vec<ProgressionInput>,
}

#[derive(Debug, Clone)]
pub struct ProgressionInput {
    pub to_stage_index: usize,
    pub slots: i32,
    pub rule_description: Option<String>,
}

#[derive(Debug, Clone)]
pub struct MatchInput {
    pub team_a_id: Uuid,
    pub team_b_id: Uuid,
    pub score_a: Option<i32>,
    pub score_b: Option<i32>,
    pub format: String,
    pub maps: Vec<MapInput>,
    pub participants: Vec<ParticipantInput>,
    pub scheduled_at: Option<chrono::NaiveDateTime>,
    pub group_name: Option<String>,
    pub round: Option<i32>,
}

#[derive(Debug, Clone)]
pub struct MapInput {
    pub map_name: String,
    pub order_index: i32,
    pub score_a: Option<i32>,
    pub score_b: Option<i32>,
    pub duration_seconds: Option<i32>,
    pub robot_stats: Vec<RobotStatsInput>,
}

#[derive(Debug, Clone)]
pub struct RobotStatsInput {
    pub member_id: Uuid,
    pub robot_type: String,
    pub kills: i32,
    pub deaths: i32,
    pub damage: i32,
    pub hp_healed: i32,
    pub base_damage: i32,
    pub alive_time_seconds: i32,
}

#[derive(Debug, Clone)]
pub struct ParticipantInput {
    pub team_id: Uuid,
    pub member_id: Uuid,
    pub robot_type: String,
}

#[derive(Debug, Clone)]
pub struct TeamInput {
    pub name: String,
    pub name_en: Option<String>,
    pub university: String,
    pub abbreviation: Option<String>,
    pub logo_url: Option<String>,
    pub founded_year: Option<i32>,
    pub description: Option<String>,
    pub members: Vec<MemberInput>,
}

#[derive(Debug, Clone)]
pub struct MemberInput {
    pub name: String,
    pub role: String,
    pub joined_year: Option<i32>,
    pub robot_roles: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct RankingInput {
    pub team_id: Uuid,
    pub rank: i32,
    pub rating: f64,
    pub matches_played: i32,
}

#[async_trait]
pub trait DataSource: Send + Sync {
    fn name(&self) -> &str;
    fn enabled(&self) -> bool;

    async fn fetch_events(&self, season: Option<&str>) -> Result<Vec<EventInput>, anyhow::Error>;
    async fn fetch_matches(&self, event_id: Uuid) -> Result<Vec<MatchInput>, anyhow::Error>;
    async fn fetch_teams(&self) -> Result<Vec<TeamInput>, anyhow::Error>;
    async fn fetch_rankings(&self, season: &str) -> Result<Vec<RankingInput>, anyhow::Error>;
}

pub struct DataSourceRegistry {
    sources: Vec<Box<dyn DataSource>>,
}

impl DataSourceRegistry {
    pub fn new() -> Self {
        Self {
            sources: Vec::new(),
        }
    }

    pub fn register(&mut self, source: Box<dyn DataSource>) {
        self.sources.push(source);
    }

    fn active_sources(&self) -> impl Iterator<Item = &Box<dyn DataSource>> {
        self.sources.iter().filter(|s| s.enabled())
    }

    pub async fn fetch_events(&self, season: Option<&str>) -> Vec<EventInput> {
        let mut all = Vec::new();
        for source in self.active_sources() {
            if let Ok(events) = source.fetch_events(season).await {
                all.extend(events);
            }
        }
        all
    }

    pub async fn fetch_matches(&self, event_id: Uuid) -> Vec<MatchInput> {
        let mut all = Vec::new();
        for source in self.active_sources() {
            if let Ok(matches) = source.fetch_matches(event_id).await {
                all.extend(matches);
            }
        }
        all
    }

    pub async fn fetch_teams(&self) -> Vec<TeamInput> {
        let mut all = Vec::new();
        for source in self.active_sources() {
            if let Ok(teams) = source.fetch_teams().await {
                all.extend(teams);
            }
        }
        all
    }

    pub async fn fetch_rankings(&self, season: &str) -> Vec<RankingInput> {
        let mut all = Vec::new();
        for source in self.active_sources() {
            if let Ok(rankings) = source.fetch_rankings(season).await {
                all.extend(rankings);
            }
        }
        all
    }
}

impl Default for DataSourceRegistry {
    fn default() -> Self {
        Self::new()
    }
}
