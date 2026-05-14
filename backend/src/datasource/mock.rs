use async_trait::async_trait;
use uuid::Uuid;
use crate::datasource::{
    DataSource, EventInput, MatchInput, TeamInput, RankingInput,
    StageInput, MapInput, RobotStatsInput, ParticipantInput, MemberInput,
};

pub struct MockDataSource;

#[async_trait]
impl DataSource for MockDataSource {
    fn name(&self) -> &str {
        "mock"
    }

    fn enabled(&self) -> bool {
        true
    }

    async fn fetch_events(&self, _season: Option<&str>) -> Result<Vec<EventInput>, anyhow::Error> {
        let team1 = Uuid::new_v4();
        let team2 = Uuid::new_v4();
        let team3 = Uuid::new_v4();
        let team4 = Uuid::new_v4();

        Ok(vec![
            EventInput {
                name: "Mock 全国机器人大赛".into(),
                series: "全国大学生机器人大赛".into(),
                season: "2025".into(),
                start_date: Some(chrono::NaiveDate::from_ymd_opt(2025, 6, 1).unwrap()),
                end_date: Some(chrono::NaiveDate::from_ymd_opt(2025, 6, 7).unwrap()),
                location: Some("深圳".into()),
                stages: vec![
                    StageInput {
                        name: "小组赛A组".into(),
                        stage_format: "round_robin".into(),
                        stage_type: "group".into(),
                        order_index: 1,
                        progression_to: vec![],
                    },
                ],
                entries: vec![team1, team2, team3, team4],
            },
            EventInput {
                name: "Mock 春季邀请赛".into(),
                series: "RMUT".into(),
                season: "2025".into(),
                start_date: Some(chrono::NaiveDate::from_ymd_opt(2025, 3, 15).unwrap()),
                end_date: Some(chrono::NaiveDate::from_ymd_opt(2025, 3, 20).unwrap()),
                location: Some("上海".into()),
                stages: vec![],
                entries: vec![team1, team2],
            },
        ])
    }

    async fn fetch_matches(&self, _event_id: Uuid) -> Result<Vec<MatchInput>, anyhow::Error> {
        let member1 = Uuid::new_v4();
        let member2 = Uuid::new_v4();
        let team_a = Uuid::new_v4();
        let team_b = Uuid::new_v4();

        Ok(vec![MatchInput {
            team_a_id: team_a,
            team_b_id: team_b,
            score_a: Some(2),
            score_b: Some(1),
            format: "bo3".into(),
            maps: vec![
                MapInput {
                    map_name: "战场A".into(),
                    order_index: 1,
                    score_a: Some(100),
                    score_b: Some(80),
                    duration_seconds: Some(420),
                    robot_stats: vec![
                        RobotStatsInput {
                            member_id: member1,
                            robot_type: "hero".into(),
                            kills: 3,
                            deaths: 1,
                            damage: 2000,
                            hp_healed: 500,
                            base_damage: 300,
                            alive_time_seconds: 380,
                        },
                    ],
                },
            ],
            participants: vec![
                ParticipantInput {
                    team_id: team_a,
                    member_id: member1,
                    robot_type: "hero".into(),
                },
                ParticipantInput {
                    team_id: team_b,
                    member_id: member2,
                    robot_type: "infantry".into(),
                },
            ],
            scheduled_at: Some(chrono::NaiveDateTime::parse_from_str("2025-06-01 14:00:00", "%Y-%m-%d %H:%M:%S").unwrap()),
            group_name: Some("小组A".into()),
            round: Some(1),
        }])
    }

    async fn fetch_teams(&self) -> Result<Vec<TeamInput>, anyhow::Error> {
        Ok(vec![
            TeamInput {
                name: "Mock TJU".into(),
                name_en: Some("TJU".into()),
                university: "天津大学".into(),
                abbreviation: Some("TJU".into()),
                founded_year: Some(2015),
                description: Some("Mock team description".into()),
                members: vec![
                    MemberInput {
                        name: "队员A".into(),
                        role: "队长".into(),
                        joined_year: Some(2024),
                        robot_roles: vec!["hero".into(), "infantry".into()],
                    },
                    MemberInput {
                        name: "队员B".into(),
                        role: "队员".into(),
                        joined_year: Some(2025),
                        robot_roles: vec!["engineer".into()],
                    },
                ],
            },
            TeamInput {
                name: "Mock SJTU".into(),
                name_en: Some("SJTU".into()),
                university: "上海交通大学".into(),
                abbreviation: Some("SJTU".into()),
                founded_year: Some(2016),
                description: None,
                members: vec![
                    MemberInput {
                        name: "队员C".into(),
                        role: "队长".into(),
                        joined_year: Some(2023),
                        robot_roles: vec!["sentinel".into()],
                    },
                ],
            },
        ])
    }

    async fn fetch_rankings(&self, _season: &str) -> Result<Vec<RankingInput>, anyhow::Error> {
        Ok(vec![
            RankingInput {
                team_id: Uuid::new_v4(),
                rank: 1,
                rating: 1580.0,
                matches_played: 25,
            },
            RankingInput {
                team_id: Uuid::new_v4(),
                rank: 2,
                rating: 1520.0,
                matches_played: 20,
            },
        ])
    }
}
