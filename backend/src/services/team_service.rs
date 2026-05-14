use sqlx::PgPool;
use uuid::Uuid;
use crate::error::AppError;
use crate::models::{Team, TeamDetail, TeamMember, TeamMemberWithRoles, MemberRobotRole, PaginatedResponse};

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
