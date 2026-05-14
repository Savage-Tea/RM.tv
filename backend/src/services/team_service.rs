use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;
use crate::error::AppError;
use crate::models::{Team, TeamDetail, TeamMember, TeamMemberWithRoles, MemberRobotRole, PaginatedResponse};

#[derive(Deserialize)]
pub struct CreateTeamInput {
    pub name: String,
    pub name_en: Option<String>,
    pub university: String,
    pub abbreviation: Option<String>,
    pub logo_url: Option<String>,
    pub founded_year: Option<i32>,
    pub description: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateTeamInput {
    pub name: Option<String>,
    pub name_en: Option<String>,
    pub university: Option<String>,
    pub abbreviation: Option<String>,
    pub logo_url: Option<String>,
    pub founded_year: Option<i32>,
    pub description: Option<String>,
}

pub async fn list_teams(
    pool: &PgPool,
    search: Option<&str>,
    page: i64,
    per_page: i64,
) -> Result<PaginatedResponse<Team>, AppError> {
    let offset = (page - 1) * per_page;

    let (total, teams) = if let Some(q) = search {
        let pattern = format!("%{}%", q);
        let total: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM teams WHERE name ILIKE $1 OR name_en ILIKE $1 OR university ILIKE $1"
        )
        .bind(&pattern)
        .fetch_one(pool)
        .await?;

        let teams: Vec<Team> = sqlx::query_as(
            "SELECT * FROM teams WHERE name ILIKE $1 OR name_en ILIKE $1 OR university ILIKE $1 ORDER BY name LIMIT $2 OFFSET $3"
        )
        .bind(&pattern)
        .bind(per_page)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        (total.0, teams)
    } else {
        let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM teams")
            .fetch_one(pool)
            .await?;

        let teams: Vec<Team> = sqlx::query_as(
            "SELECT * FROM teams ORDER BY name LIMIT $1 OFFSET $2"
        )
        .bind(per_page)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        (total.0, teams)
    };

    Ok(PaginatedResponse::new(teams, total, page, per_page))
}

pub async fn get_team(pool: &PgPool, id: Uuid) -> Result<TeamDetail, AppError> {
    let team: Team = sqlx::query_as("SELECT * FROM teams WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Team not found".into()))?;

    let members: Vec<TeamMember> = sqlx::query_as(
        "SELECT * FROM team_members WHERE team_id = $1 AND is_active = true ORDER BY name"
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    let mut members_with_roles = Vec::new();
    for member in members {
        let roles: Vec<MemberRobotRole> = sqlx::query_as(
            "SELECT * FROM member_robot_roles WHERE member_id = $1"
        )
        .bind(member.id)
        .fetch_all(pool)
        .await?;

        members_with_roles.push(TeamMemberWithRoles {
            member,
            robot_roles: roles,
        });
    }

    Ok(TeamDetail {
        team,
        members: members_with_roles,
    })
}

pub async fn create_team(pool: &PgPool, input: CreateTeamInput) -> Result<Team, AppError> {
    let team: Team = sqlx::query_as(
        "INSERT INTO teams (name, name_en, university, abbreviation, logo_url, founded_year, description) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *"
    )
    .bind(&input.name)
    .bind(&input.name_en)
    .bind(&input.university)
    .bind(&input.abbreviation)
    .bind(&input.logo_url)
    .bind(input.founded_year)
    .bind(&input.description)
    .fetch_one(pool)
    .await?;
    Ok(team)
}

pub async fn update_team(pool: &PgPool, id: Uuid, input: UpdateTeamInput) -> Result<Team, AppError> {
    let existing: Team = sqlx::query_as("SELECT * FROM teams WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Team not found".into()))?;

    let team: Team = sqlx::query_as(
        "UPDATE teams SET name = $1, name_en = $2, university = $3, abbreviation = $4, logo_url = $5, founded_year = $6, description = $7, updated_at = now() WHERE id = $8 RETURNING *"
    )
    .bind(input.name.as_deref().unwrap_or(&existing.name))
    .bind(input.name_en.as_deref().or(existing.name_en.as_deref()))
    .bind(input.university.as_deref().unwrap_or(&existing.university))
    .bind(input.abbreviation.as_deref().or(existing.abbreviation.as_deref()))
    .bind(input.logo_url.as_deref().or(existing.logo_url.as_deref()))
    .bind(input.founded_year.or(existing.founded_year))
    .bind(input.description.as_deref().or(existing.description.as_deref()))
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(team)
}
