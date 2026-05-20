use crate::datasource::{DataSource, EventInput, MatchInput, RankingInput, TeamInput};
use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

pub struct ManualSource {
    pool: PgPool,
}

impl ManualSource {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl DataSource for ManualSource {
    fn name(&self) -> &str {
        "manual"
    }

    fn enabled(&self) -> bool {
        true
    }

    async fn fetch_events(&self, season: Option<&str>) -> Result<Vec<EventInput>, anyhow::Error> {
        let events: Vec<(Uuid, String, String, String)> = if let Some(s) = season {
            sqlx::query_as("SELECT id, name, series, season FROM events WHERE season = $1")
                .bind(s)
                .fetch_all(&self.pool)
                .await?
        } else {
            sqlx::query_as("SELECT id, name, series, season FROM events")
                .fetch_all(&self.pool)
                .await?
        };

        let mut result = Vec::new();
        for (id, name, series, season) in events {
            let entries: Vec<(Uuid,)> =
                sqlx::query_as("SELECT team_id FROM event_entries WHERE event_id = $1")
                    .bind(id)
                    .fetch_all(&self.pool)
                    .await?;

            result.push(EventInput {
                name,
                series,
                season,
                start_date: None,
                end_date: None,
                location: None,
                stages: vec![],
                entries: entries.into_iter().map(|e| e.0).collect(),
            });
        }
        Ok(result)
    }

    async fn fetch_matches(&self, _event_id: Uuid) -> Result<Vec<MatchInput>, anyhow::Error> {
        Ok(vec![])
    }

    async fn fetch_teams(&self) -> Result<Vec<TeamInput>, anyhow::Error> {
        let teams: Vec<(Uuid, String, Option<String>, String, Option<String>, Option<String>, Option<i32>, Option<String>)> = sqlx::query_as(
            "SELECT id, name, name_en, university, abbreviation, logo_url, founded_year, description FROM teams"
        )
        .fetch_all(&self.pool)
        .await?;

        let mut result = Vec::new();
        for (id, name, name_en, university, abbreviation, logo_url, founded_year, description) in teams {
            let members: Vec<(String, String, Option<i32>)> = sqlx::query_as(
                "SELECT name, role, joined_year FROM team_members WHERE team_id = $1 AND is_active = true"
            )
            .bind(id)
            .fetch_all(&self.pool)
            .await?;

            result.push(TeamInput {
                name,
                name_en,
                university,
                abbreviation,
                logo_url,
                founded_year,
                description,
                members: members
                    .into_iter()
                    .map(|(n, r, y)| crate::datasource::MemberInput {
                        name: n,
                        role: r,
                        joined_year: y,
                        robot_roles: vec![],
                    })
                    .collect(),
            });
        }
        Ok(result)
    }

    async fn fetch_rankings(&self, _season: &str) -> Result<Vec<RankingInput>, anyhow::Error> {
        Ok(vec![])
    }
}
