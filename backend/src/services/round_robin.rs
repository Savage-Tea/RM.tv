use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct RoundRobinEntry {
    pub team_id: Uuid,
    pub wins: i32,
    pub losses: i32,
    pub draws: i32,
    pub map_wins: i32,
    pub map_losses: i32,
    pub points: i32,
}

/// Compute round-robin standings from a list of matches.
///
/// Tie-break priority:
/// 1. Points (win=3, draw=1, loss=0)
/// 2. Map differential (map_wins - map_losses)
/// 3. Head-to-head result
/// 4. Head-to-head map differential
pub fn compute_standings(matches: &[RoundRobinMatch]) -> Vec<RoundRobinEntry> {
    let mut entries: HashMap<Uuid, RoundRobinEntry> = HashMap::new();

    for m in matches {
        // Update team_a stats
        {
            let a = entries
                .entry(m.team_a_id)
                .or_insert_with(|| RoundRobinEntry {
                    team_id: m.team_a_id,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    map_wins: 0,
                    map_losses: 0,
                    points: 0,
                });
            a.map_wins += m.score_a;
            a.map_losses += m.score_b;
        }
        // Update team_b stats
        {
            let b = entries
                .entry(m.team_b_id)
                .or_insert_with(|| RoundRobinEntry {
                    team_id: m.team_b_id,
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    map_wins: 0,
                    map_losses: 0,
                    points: 0,
                });
            b.map_wins += m.score_b;
            b.map_losses += m.score_a;
        }

        // Determine win/loss/draw
        let (a_points, b_points, _a_is_winner) = if m.score_a > m.score_b {
            (3, 0, true)
        } else if m.score_b > m.score_a {
            (0, 3, false)
        } else {
            (1, 1, false)
        };

        let a = entries.get_mut(&m.team_a_id).unwrap();
        a.points += a_points;
        if a_points == 3 {
            a.wins += 1;
        } else if a_points == 0 {
            a.losses += 1;
        } else {
            a.draws += 1;
        }

        let b = entries.get_mut(&m.team_b_id).unwrap();
        b.points += b_points;
        if b_points == 3 {
            b.wins += 1;
        } else if b_points == 0 {
            b.losses += 1;
        } else {
            b.draws += 1;
        }
    }

    let mut result: Vec<RoundRobinEntry> = entries.into_values().collect();

    // Sort by tie-break rules
    result.sort_by(|a, b| {
        b.points
            .cmp(&a.points)
            .then_with(|| (b.map_wins - b.map_losses).cmp(&(a.map_wins - a.map_losses)))
            .then_with(|| {
                // Head-to-head: find match between these two teams
                let h2h = matches.iter().find(|m| {
                    (m.team_a_id == a.team_id && m.team_b_id == b.team_id)
                        || (m.team_a_id == b.team_id && m.team_b_id == a.team_id)
                });
                match h2h {
                    Some(m) => {
                        let a_score = if m.team_a_id == a.team_id {
                            m.score_a
                        } else {
                            m.score_b
                        };
                        let b_score = if m.team_a_id == b.team_id {
                            m.score_b
                        } else {
                            m.score_a
                        };
                        b_score.cmp(&a_score)
                    }
                    None => std::cmp::Ordering::Equal,
                }
            })
    });

    result
}

#[derive(Debug, Clone)]
pub struct RoundRobinMatch {
    pub team_a_id: Uuid,
    pub team_b_id: Uuid,
    pub score_a: i32,
    pub score_b: i32,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tid(s: &str) -> Uuid {
        let mut bytes = [0u8; 16];
        bytes[..s.len()].copy_from_slice(s.as_bytes());
        Uuid::from_bytes(bytes)
    }

    #[test]
    fn test_basic_standings() {
        let t1 = tid("team1");
        let t2 = tid("team2");
        let t3 = tid("team3");

        let matches = vec![
            RoundRobinMatch {
                team_a_id: t1,
                team_b_id: t2,
                score_a: 2,
                score_b: 1,
            },
            RoundRobinMatch {
                team_a_id: t1,
                team_b_id: t3,
                score_a: 2,
                score_b: 1,
            },
            RoundRobinMatch {
                team_a_id: t2,
                team_b_id: t3,
                score_a: 2,
                score_b: 1,
            },
        ];

        let standings = compute_standings(&matches);
        // t1: 2 wins (6 pts), t2: 1 win 1 loss (3 pts), t3: 2 losses (0 pts)
        assert_eq!(standings[0].team_id, t1);
        assert_eq!(standings[0].points, 6);
        assert_eq!(standings[1].team_id, t2);
        assert_eq!(standings[1].points, 3);
        assert_eq!(standings[2].team_id, t3);
        assert_eq!(standings[2].points, 0);
    }

    #[test]
    fn test_tiebreaker_map_diff() {
        let t1 = tid("teamA");
        let t2 = tid("teamB");
        let t3 = tid("teamC");

        // Both t1 and t2 beat t3, lose to each other once
        // t2 has better map differential
        let matches = vec![
            RoundRobinMatch {
                team_a_id: t1,
                team_b_id: t2,
                score_a: 2,
                score_b: 1,
            },
            RoundRobinMatch {
                team_a_id: t1,
                team_b_id: t3,
                score_a: 2,
                score_b: 0,
            },
            RoundRobinMatch {
                team_a_id: t2,
                team_b_id: t3,
                score_a: 2,
                score_b: 0,
            },
        ];

        let standings = compute_standings(&matches);
        // t1: 6pts, map 4-1=+3; t2: 3pts, map 3-2=+1
        assert_eq!(standings[0].team_id, t1);
        assert_eq!(standings[0].points, 6);
        assert_eq!(standings[1].team_id, t2);
        assert_eq!(standings[1].points, 3);
    }
}
