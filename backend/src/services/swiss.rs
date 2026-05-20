use std::collections::HashMap;
use uuid::Uuid;

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
}
