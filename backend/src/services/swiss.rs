use std::collections::{HashMap, HashSet};
use uuid::Uuid;

/// Swiss pairing engine.
///
/// Rules:
/// 1. Group teams by current points
/// 2. Within each group, pair randomly
/// 3. Odd team in a group pairs down to the next group
/// 4. No repeat matchups
///
/// Returns list of (team_a_id, team_b_id) pairings for the next round.
pub fn generate_pairings(
    standings: &[SwissStanding],
    _round: i32,
    previous_pairings: &HashSet<(Uuid, Uuid)>,
) -> Vec<(Uuid, Uuid)> {
    if standings.len() < 2 {
        return vec![];
    }

    // Group teams by points (sorted descending)
    let mut groups: HashMap<i32, Vec<Uuid>> = HashMap::new();
    for s in standings {
        groups.entry(s.points).or_default().push(s.team_id);
    }

    let mut point_levels: Vec<i32> = groups.keys().copied().collect();
    point_levels.sort_by(|a, b| b.cmp(a)); // highest points first

    // Flatten into groups but keep structure
    let mut all_groups: Vec<Vec<Uuid>> = Vec::new();
    for level in &point_levels {
        let mut group = groups.remove(level).unwrap();
        // Shuffle deterministically for now (in production, use a random seed)
        group.sort_by_key(|id| id.to_string());
        all_groups.push(group);
    }

    // Handle odd teams: last team in group pairs down
    let mut flat_teams: Vec<Uuid> = Vec::new();
    for group in &all_groups {
        flat_teams.extend(group);
    }

    // Pair adjacent teams in the flat list, avoiding rematches
    let mut pairings: Vec<(Uuid, Uuid)> = Vec::new();
    let mut used: HashSet<Uuid> = HashSet::new();

    for i in 0..flat_teams.len() {
        if used.contains(&flat_teams[i]) {
            continue;
        }
        // Find next available opponent
        for j in (i + 1)..flat_teams.len() {
            if used.contains(&flat_teams[j]) {
                continue;
            }
            let pair = (
                flat_teams[i].min(flat_teams[j]),
                flat_teams[i].max(flat_teams[j]),
            );
            if !previous_pairings.contains(&pair) {
                pairings.push((flat_teams[i], flat_teams[j]));
                used.insert(flat_teams[i]);
                used.insert(flat_teams[j]);
                break;
            }
        }
        // If we couldn't find a non-rematch opponent, force a pairing
        if !used.contains(&flat_teams[i]) {
            for j in 0..flat_teams.len() {
                if i != j && !used.contains(&flat_teams[j]) {
                    pairings.push((flat_teams[i], flat_teams[j]));
                    used.insert(flat_teams[i]);
                    used.insert(flat_teams[j]);
                    break;
                }
            }
        }
    }

    pairings
}

/// Compute Buchholz score for each team.
/// Buchholz = sum of all opponents' wins.
pub fn compute_buchholz(standings: &[SwissStanding], matches: &[SwissMatch]) -> HashMap<Uuid, f64> {
    let wins: HashMap<Uuid, i32> = standings.iter().map(|s| (s.team_id, s.wins)).collect();

    let mut buchholz: HashMap<Uuid, f64> = HashMap::new();
    for s in standings {
        buchholz.insert(s.team_id, 0.0);
    }

    for m in matches {
        let a_opp_wins = *wins.get(&m.team_b_id).unwrap_or(&0) as f64;
        let b_opp_wins = *wins.get(&m.team_a_id).unwrap_or(&0) as f64;

        *buchholz.get_mut(&m.team_a_id).unwrap() += a_opp_wins;
        *buchholz.get_mut(&m.team_b_id).unwrap() += b_opp_wins;
    }

    buchholz
}

/// Determine final rankings in a Swiss stage.
/// Sorted by: points → buchholz → map differential
pub fn compute_final_standings(
    mut standings: Vec<SwissStanding>,
    matches: &[SwissMatch],
) -> Vec<SwissStanding> {
    let buchholz = compute_buchholz(&standings, matches);

    standings.sort_by(|a, b| {
        b.points
            .cmp(&a.points)
            .then_with(|| {
                let bh_a = buchholz.get(&a.team_id).copied().unwrap_or(0.0);
                let bh_b = buchholz.get(&b.team_id).copied().unwrap_or(0.0);
                bh_b.partial_cmp(&bh_a).unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| (b.map_wins - b.map_losses).cmp(&(a.map_wins - a.map_losses)))
    });

    standings
}

#[derive(Debug, Clone)]
pub struct SwissStanding {
    pub team_id: Uuid,
    pub wins: i32,
    pub losses: i32,
    pub map_wins: i32,
    pub map_losses: i32,
    pub points: i32,
}

#[derive(Debug, Clone)]
pub struct SwissMatch {
    pub team_a_id: Uuid,
    pub team_b_id: Uuid,
    pub score_a: i32,
    pub score_b: i32,
    pub round: i32,
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
    fn test_pairings_no_rematch() {
        let standings: Vec<SwissStanding> = (1..=8)
            .map(|i| SwissStanding {
                team_id: tid(&format!("t{}", i)),
                wins: 0,
                losses: 0,
                map_wins: 0,
                map_losses: 0,
                points: 0,
            })
            .collect();

        let pairings = generate_pairings(&standings, 1, &HashSet::new());
        assert_eq!(pairings.len(), 4);
    }

    #[test]
    fn test_pairings_avoids_rematch() {
        let t1 = tid("t1");
        let t2 = tid("t2");
        let t3 = tid("t3");
        let t4 = tid("t4");

        let standings = vec![
            SwissStanding {
                team_id: t1,
                wins: 1,
                losses: 0,
                map_wins: 2,
                map_losses: 0,
                points: 3,
            },
            SwissStanding {
                team_id: t2,
                wins: 1,
                losses: 0,
                map_wins: 2,
                map_losses: 1,
                points: 3,
            },
            SwissStanding {
                team_id: t3,
                wins: 0,
                losses: 1,
                map_wins: 1,
                map_losses: 2,
                points: 0,
            },
            SwissStanding {
                team_id: t4,
                wins: 0,
                losses: 1,
                map_wins: 0,
                map_losses: 2,
                points: 0,
            },
        ];

        let mut history = HashSet::new();
        history.insert((t1.min(t2), t1.max(t2)));

        let pairings = generate_pairings(&standings, 2, &history);
        // t1 and t2 already played, should not be paired again
        for (a, b) in &pairings {
            let p = (*a, *b);
            let normalized = (p.0.min(p.1), p.0.max(p.1));
            assert!(!history.contains(&normalized));
        }
    }
}
