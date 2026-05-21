use crate::error::AppError;
use crate::services::{round_robin, swiss};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

// ── Output types for frontend display ──────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageStandingsRow {
    pub rank: i32,
    pub team_id: Uuid,
    pub team_name: String,
    pub team_abbreviation: Option<String>,
    pub university: String,
    pub logo_url: Option<String>,
    pub wins: i32,
    pub losses: i32,
    pub draws: i32,
    pub map_wins: i32,
    pub map_losses: i32,
    pub points: i32,
    pub buchholz: Option<f64>,
    /// Swiss record group label: "2-0", "1-1", "0-2"
    pub record: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageRoundMatches {
    pub round: i32,
    pub label: String,
    pub matches: Vec<StageMatchCard>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageMatchCard {
    pub match_id: Uuid,
    pub team_a: TeamInfo,
    pub team_b: TeamInfo,
    pub score_a: Option<i32>,
    pub score_b: Option<i32>,
    pub status: String,
    pub scheduled_at: Option<String>,
    pub format: Option<String>,
    pub group_name: Option<String>,
    /// Pre-match record of team_a (e.g. "2:1")
    pub bracket_record: String,
    /// Pre-match record of team_b
    pub bracket_record_b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamInfo {
    pub id: Uuid,
    pub name: String,
    pub abbreviation: Option<String>,
    pub university: String,
    pub logo_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageOverview {
    pub stage_id: Uuid,
    pub stage_name: String,
    pub stage_format: String,
    pub stage_type: String,
    pub total_teams: i64,
    pub total_matches: i64,
    pub completed_matches: i64,
    pub standings: Vec<StageStandingsRow>,
    pub rounds: Vec<StageRoundMatches>,
}

// ── Internal DB row type ───────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct MatchRow {
    id: Uuid,
    team_a_id: Uuid,
    team_a_name: String,
    team_a_abbr: Option<String>,
    team_a_university: String,
    team_a_logo_url: Option<String>,
    team_b_id: Uuid,
    team_b_name: String,
    team_b_abbr: Option<String>,
    team_b_university: String,
    team_b_logo_url: Option<String>,
    score_a: Option<i32>,
    score_b: Option<i32>,
    status: String,
    round: Option<i32>,
    scheduled_at: Option<String>,
    format: Option<String>,
    group_name: Option<String>,
}

/// Auto-detect Swiss vs Round Robin from match round numbering.
/// Swiss brackets interleave groups: rounds jump by >10 between batches.
fn detect_format(matches: &[MatchRow], db_format: &str) -> String {
    if db_format == "swiss" {
        return "swiss".to_string();
    }

    let mut rounds: Vec<i32> = matches.iter().filter_map(|m| m.round).collect();
    rounds.sort();
    rounds.dedup();

    // If round numbers jump by >8, it's Swiss with interleaved groups
    // (CDN format: Group A uses 1-8, 17-24, 33-40... Group B uses 9-16, 25-32...)
    let has_large_jump = rounds.len() > 1 && rounds.windows(2).any(|w| w[1] - w[0] > 8);

    if has_large_jump {
        "swiss".to_string()
    } else if db_format == "round_robin" {
        "round_robin".to_string()
    } else {
        db_format.to_string()
    }
}

// ── Computation ────────────────────────────────────────────────────

pub async fn get_stage_overview(pool: &PgPool, stage_id: Uuid) -> Result<StageOverview, AppError> {
    let stage: (Uuid, String, String, String) = sqlx::query_as(
        "SELECT id, name, stage_format::text, stage_type::text FROM event_stages WHERE id = $1",
    )
    .bind(stage_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Stage not found".into()))?;

    let (stage_id, stage_name, stage_format, stage_type) = stage;

    // Count teams
    let (total_teams,): (i64,) = sqlx::query_as(
        r#"SELECT COUNT(DISTINCT t.id)
           FROM teams t
           JOIN matches m ON (m.team_a_id = t.id OR m.team_b_id = t.id)
           WHERE m.stage_id = $1"#,
    )
    .bind(stage_id)
    .fetch_one(pool)
    .await?;

    let matches: Vec<MatchRow> = sqlx::query_as(
        r#"SELECT
            m.id,
            m.team_a_id, ta.name as team_a_name, ta.abbreviation as team_a_abbr, ta.university as team_a_university, ta.logo_url as team_a_logo_url,
            m.team_b_id, tb.name as team_b_name, tb.abbreviation as team_b_abbr, tb.university as team_b_university, tb.logo_url as team_b_logo_url,
            m.score_a, m.score_b,
            m.status::text as status,
            m.round,
            to_char(m.scheduled_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD HH24:MI') as scheduled_at,
            m.format::text as format,
            m.group_name
        FROM matches m
        JOIN teams ta ON m.team_a_id = ta.id
        JOIN teams tb ON m.team_b_id = tb.id
        WHERE m.stage_id = $1
        ORDER BY m.round, m.scheduled_at"#,
    )
    .bind(stage_id)
    .fetch_all(pool)
    .await?;

    let total_matches = matches.len() as i64;
    let completed_matches = matches.iter().filter(|m| m.status == "finished").count() as i64;

    // Auto-detect Swiss from match round pattern
    let detected_format = detect_format(&matches, &stage_format);

    let standings = compute_standings_from_matches(&detected_format, &matches);

    // Group matches by round for display
    let rounds = group_matches_by_round(&matches, &detected_format);

    Ok(StageOverview {
        stage_id,
        stage_name,
        stage_format: detected_format,
        stage_type,
        total_teams,
        total_matches,
        completed_matches,
        standings,
        rounds,
    })
}

fn compute_standings_from_matches(
    stage_format: &str,
    matches: &[MatchRow],
) -> Vec<StageStandingsRow> {
    // Build team info lookup: (name, abbreviation, university)
    type TeamInfo<'a> = (&'a str, Option<&'a str>, &'a str, Option<&'a str>);
    let mut team_names: std::collections::HashMap<Uuid, TeamInfo<'_>> =
        std::collections::HashMap::new();
    for m in matches {
        team_names.entry(m.team_a_id).or_insert((
            &m.team_a_name,
            m.team_a_abbr.as_deref(),
            &m.team_a_university,
            m.team_a_logo_url.as_deref(),
        ));
        team_names.entry(m.team_b_id).or_insert((
            &m.team_b_name,
            m.team_b_abbr.as_deref(),
            &m.team_b_university,
            m.team_b_logo_url.as_deref(),
        ));
    }

    if stage_format == "swiss" {
        // Use auto-detection for all Swiss logic
        let swiss_matches: Vec<swiss::SwissMatch> = matches
            .iter()
            .filter(|m| m.status == "finished" && m.score_a.is_some() && m.score_b.is_some())
            .map(|m| swiss::SwissMatch {
                team_a_id: m.team_a_id,
                team_b_id: m.team_b_id,
                score_a: m.score_a.unwrap_or(0),
                score_b: m.score_b.unwrap_or(0),
            })
            .collect();

        // Build standings from match results
        let mut raw: std::collections::HashMap<Uuid, swiss::SwissStanding> =
            std::collections::HashMap::new();

        // First pass: ensure all entries exist and accumulate map scores
        for m in &swiss_matches {
            raw.entry(m.team_a_id)
                .or_insert_with(|| swiss::SwissStanding {
                    team_id: m.team_a_id,
                    wins: 0,
                    losses: 0,
                    map_wins: 0,
                    map_losses: 0,
                    points: 0,
                });
            raw.entry(m.team_b_id)
                .or_insert_with(|| swiss::SwissStanding {
                    team_id: m.team_b_id,
                    wins: 0,
                    losses: 0,
                    map_wins: 0,
                    map_losses: 0,
                    points: 0,
                });
        }

        // Second pass: update stats
        for m in &swiss_matches {
            // Accumulate map scores
            {
                let a = raw.get_mut(&m.team_a_id).unwrap();
                a.map_wins += m.score_a;
                a.map_losses += m.score_b;
            }
            {
                let b = raw.get_mut(&m.team_b_id).unwrap();
                b.map_wins += m.score_b;
                b.map_losses += m.score_a;
            }

            // Win/loss/points
            let (a_pts, b_pts, a_win, b_win, a_loss, b_loss) = if m.score_a > m.score_b {
                (3, 0, 1, 0, 0, 1)
            } else if m.score_b > m.score_a {
                (0, 3, 0, 1, 1, 0)
            } else {
                (1, 1, 0, 0, 0, 0)
            };

            let a = raw.get_mut(&m.team_a_id).unwrap();
            a.points += a_pts;
            a.wins += a_win;
            a.losses += a_loss;

            let b = raw.get_mut(&m.team_b_id).unwrap();
            b.points += b_pts;
            b.wins += b_win;
            b.losses += b_loss;
        }

        // Also include teams that haven't played yet
        for m in matches {
            raw.entry(m.team_a_id)
                .or_insert_with(|| swiss::SwissStanding {
                    team_id: m.team_a_id,
                    wins: 0,
                    losses: 0,
                    map_wins: 0,
                    map_losses: 0,
                    points: 0,
                });
            raw.entry(m.team_b_id)
                .or_insert_with(|| swiss::SwissStanding {
                    team_id: m.team_b_id,
                    wins: 0,
                    losses: 0,
                    map_wins: 0,
                    map_losses: 0,
                    points: 0,
                });
        }

        let mut standings: Vec<_> = raw.into_values().collect();
        let buchholz = swiss::compute_buchholz(&standings, &swiss_matches);

        // Sort: points → buchholz → map diff
        standings.sort_by(|a, b| {
            b.points.cmp(&a.points).then_with(|| {
                let bh_a = buchholz.get(&a.team_id).copied().unwrap_or(0.0);
                let bh_b = buchholz.get(&b.team_id).copied().unwrap_or(0.0);
                bh_b.partial_cmp(&bh_a).unwrap_or(std::cmp::Ordering::Equal)
            })
        });

        standings
            .iter()
            .enumerate()
            .map(|(i, s)| {
                let (name, abbr, uni, logo) = team_names
                    .get(&s.team_id)
                    .copied()
                    .unwrap_or(("?", None, "?", None));
                StageStandingsRow {
                    rank: (i + 1) as i32,
                    team_id: s.team_id,
                    team_name: name.to_string(),
                    team_abbreviation: abbr.map(|a| a.to_string()),
                    university: uni.to_string(),
                    logo_url: logo.map(|l| l.to_string()),
                    wins: s.wins,
                    losses: s.losses,
                    draws: 0,
                    map_wins: s.map_wins,
                    map_losses: s.map_losses,
                    points: s.points,
                    buchholz: buchholz.get(&s.team_id).copied(),
                    record: format!("{}-{}", s.wins, s.losses),
                }
            })
            .collect()
    } else {
        // Round Robin (and fallback)
        let rr_matches: Vec<round_robin::RoundRobinMatch> = matches
            .iter()
            .filter(|m| m.status == "finished" && m.score_a.is_some() && m.score_b.is_some())
            .map(|m| round_robin::RoundRobinMatch {
                team_a_id: m.team_a_id,
                team_b_id: m.team_b_id,
                score_a: m.score_a.unwrap_or(0),
                score_b: m.score_b.unwrap_or(0),
            })
            .collect();

        let standings = round_robin::compute_standings(&rr_matches);

        standings
            .iter()
            .enumerate()
            .map(|(i, s)| {
                let (name, abbr, uni, logo) = team_names
                    .get(&s.team_id)
                    .copied()
                    .unwrap_or(("?", None, "?", None));
                StageStandingsRow {
                    rank: (i + 1) as i32,
                    team_id: s.team_id,
                    team_name: name.to_string(),
                    team_abbreviation: abbr.map(|a| a.to_string()),
                    university: uni.to_string(),
                    logo_url: logo.map(|l| l.to_string()),
                    wins: s.wins,
                    losses: s.losses,
                    draws: s.draws,
                    map_wins: s.map_wins,
                    map_losses: s.map_losses,
                    points: s.points,
                    buchholz: None,
                    record: format!("{}-{}-{}", s.wins, s.draws, s.losses),
                }
            })
            .collect()
    }
}

fn group_matches_by_round(matches: &[MatchRow], stage_format: &str) -> Vec<StageRoundMatches> {
    if matches.is_empty() {
        return vec![];
    }

    // Collect unique round numbers in order
    let mut round_order: Vec<i32> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for m in matches {
        let r = m.round.unwrap_or(1);
        if seen.insert(r) {
            round_order.push(r);
        }
    }
    round_order.sort();

    // Detect Swiss: round numbers jump by >8 between batches, or stage_format is swiss
    let is_swiss = stage_format == "swiss"
        || (round_order.len() > 1 && round_order.windows(2).any(|w| w[1] - w[0] > 8));

    if !is_swiss && stage_format != "single_elim" {
        // Round Robin: simple grouping by round number
        return round_order
            .iter()
            .map(|&round_num| {
                let cards: Vec<StageMatchCard> = matches
                    .iter()
                    .filter(|m| m.round.unwrap_or(1) == round_num)
                    .map(|m| build_match_card(m, "0:0", "0:0"))
                    .collect();
                StageRoundMatches {
                    round: round_num,
                    label: format!("Round {}", round_num),
                    matches: cards,
                }
            })
            .collect();
    }

    if stage_format == "single_elim" {
        // Single elimination: label rounds by match count
        return round_order
            .iter()
            .map(|&round_num| {
                let cards: Vec<StageMatchCard> = matches
                    .iter()
                    .filter(|m| m.round.unwrap_or(1) == round_num)
                    .map(|m| build_match_card(m, "0:0", "0:0"))
                    .collect();
                let label = match (round_num, cards.len()) {
                    (_, 8) => "16进8".to_string(),
                    (_, 4) => "8进4".to_string(),
                    (3, 2) => "半决赛".to_string(),
                    (4, _) | (_, 1) => "决赛".to_string(),
                    (_, 2) => "半决赛".to_string(),
                    n => format!("Round {} ({} matches)", round_num, n.1),
                };
                StageRoundMatches {
                    round: round_num,
                    label,
                    matches: cards,
                }
            })
            .collect();
    }

    // ── Swiss: process linearly by round number ──────────────────
    use std::collections::HashMap;

    // Sort matches by round number
    let mut sorted: Vec<&MatchRow> = matches.iter().collect();
    sorted.sort_by_key(|m| m.round.unwrap_or(1));

    // Track running W-L for each team
    let mut records: HashMap<Uuid, (i32, i32)> = HashMap::new();
    // display_round_number → list of match cards
    let mut round_map: HashMap<i32, Vec<StageMatchCard>> = HashMap::new();
    let mut round_order_display: Vec<i32> = Vec::new();

    for m in &sorted {
        let (aw, al) = records.get(&m.team_a_id).copied().unwrap_or((0, 0));
        let (bw, bl) = records.get(&m.team_b_id).copied().unwrap_or((0, 0));

        let bracket_record = format!("{}:{}", aw, al);
        let bracket_record_b = format!("{}:{}", bw, bl);
        // Swiss display round = total games played + 1
        let display_round = aw + al + 1;

        let card = build_match_card(m, &bracket_record, &bracket_record_b);

        if !round_map.contains_key(&display_round) {
            round_order_display.push(display_round);
        }
        round_map.entry(display_round).or_default().push(card);

        // Update running records
        if m.status == "finished" {
            if let (Some(sa), Some(sb)) = (m.score_a, m.score_b) {
                if sa > sb {
                    records.insert(m.team_a_id, (aw + 1, al));
                    records.insert(m.team_b_id, (bw, bl + 1));
                } else if sb > sa {
                    records.insert(m.team_a_id, (aw, al + 1));
                    records.insert(m.team_b_id, (bw + 1, bl));
                }
            }
        } else {
            // For unplayed matches, register both teams so they exist in records
            records.entry(m.team_a_id).or_insert((aw, al));
            records.entry(m.team_b_id).or_insert((bw, bl));
        }
    }

    round_order_display.sort();
    round_order_display
        .into_iter()
        .map(|dr| StageRoundMatches {
            round: dr,
            label: format!("Swiss Round {}", dr),
            matches: round_map.remove(&dr).unwrap_or_default(),
        })
        .collect()
}

fn build_match_card(m: &MatchRow, bracket_record: &str, bracket_record_b: &str) -> StageMatchCard {
    StageMatchCard {
        match_id: m.id,
        team_a: TeamInfo {
            id: m.team_a_id,
            name: m.team_a_name.clone(),
            abbreviation: m.team_a_abbr.clone(),
            university: m.team_a_university.clone(),
            logo_url: m.team_a_logo_url.clone(),
        },
        team_b: TeamInfo {
            id: m.team_b_id,
            name: m.team_b_name.clone(),
            abbreviation: m.team_b_abbr.clone(),
            university: m.team_b_university.clone(),
            logo_url: m.team_b_logo_url.clone(),
        },
        score_a: m.score_a,
        score_b: m.score_b,
        status: m.status.clone(),
        scheduled_at: m.scheduled_at.clone(),
        format: m.format.clone(),
        group_name: m.group_name.clone(),
        bracket_record: bracket_record.to_string(),
        bracket_record_b: bracket_record_b.to_string(),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_detect_swiss_by_round_jumps() {
        let round_order = vec![1i64, 2, 17, 18, 33, 34];
        let is_swiss = round_order.len() > 1 && round_order.windows(2).any(|w| w[1] - w[0] > 8);
        assert!(is_swiss);
    }

    #[test]
    fn test_detect_rr_by_consecutive_rounds() {
        let round_order = vec![1i64, 2, 3, 4, 5, 6, 7];
        let is_swiss = round_order.len() > 1 && round_order.windows(2).any(|w| w[1] - w[0] > 8);
        assert!(!is_swiss);
    }

    #[test]
    fn test_group_matches_by_round_batching() {
        // Swiss: rounds 1-8 and 9-16 are separate batches (diff 8 > 8? no)
        // But 1-8, 17-24, 33-40 are separate batches (diff 9 > 8)
        let round_nums = vec![1i64, 2, 8, 17, 18, 24, 33, 34, 40];
        let batches: Vec<Vec<i64>> = {
            let mut groups = vec![];
            let mut current = vec![];
            for (i, &r) in round_nums.iter().enumerate() {
                if i == 0 || r - round_nums[i - 1] > 8 {
                    if !current.is_empty() {
                        groups.push(std::mem::take(&mut current));
                    }
                }
                current.push(r);
            }
            if !current.is_empty() {
                groups.push(current);
            }
            groups
        };
        assert_eq!(batches.len(), 3);
        assert_eq!(batches[0], vec![1, 2, 8]);
        assert_eq!(batches[1], vec![17, 18, 24]);
        assert_eq!(batches[2], vec![33, 34, 40]);
    }
}
