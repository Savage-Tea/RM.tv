use uuid::Uuid;

/// Bracket tree node for elimination tournaments.
#[derive(Debug, Clone)]
pub struct BracketNode {
    pub position: String,
    pub team_a: Option<Uuid>,
    pub team_b: Option<Uuid>,
    pub score_a: Option<i32>,
    pub score_b: Option<i32>,
    pub winner_to: Option<String>,
    pub loser_to: Option<String>,
}

/// Build a single-elimination bracket tree from a list of matches.
///
/// Assumes positions follow naming like "QF1", "QF2", "SF1", "F".
/// Each match's `bracket_position` identifies its slot in the tree.
pub fn build_single_elim_bracket(
    matches: &[EliminationMatch],
    round_order: &[&str], // e.g. ["QF", "SF", "F"]
) -> Vec<BracketNode> {
    let mut nodes: Vec<BracketNode> = Vec::new();

    for &round in round_order {
        let round_matches: Vec<&EliminationMatch> = matches
            .iter()
            .filter(|m| m.bracket_position.starts_with(round))
            .collect();

        for m in &round_matches {
            let next_round = next_round(round, round_order);
            let winner_to = next_round.map(|r| {
                let idx = match_index(&m.bracket_position);
                format!("{}{}", r, (idx + 1).div_ceil(2))
            });

            nodes.push(BracketNode {
                position: m.bracket_position.clone(),
                team_a: Some(m.team_a_id),
                team_b: Some(m.team_b_id),
                score_a: m.score_a,
                score_b: m.score_b,
                winner_to,
                loser_to: None,
            });
        }
    }

    nodes
}

/// Build a double-elimination bracket tree.
///
/// Double elimination has two sub-brackets:
/// - Upper bracket (winners bracket): standard single-elim
/// - Lower bracket: losers from upper bracket feed in
pub fn build_double_elim_bracket(
    upper_matches: &[EliminationMatch],
    lower_matches: &[EliminationMatch],
    round_order: &[&str],
) -> (Vec<BracketNode>, Vec<BracketNode>) {
    let mut upper_nodes = Vec::new();
    let mut lower_nodes = Vec::new();

    for &round in round_order {
        let round_upper: Vec<&EliminationMatch> = upper_matches
            .iter()
            .filter(|m| m.bracket_position.starts_with(round))
            .collect();

        for m in &round_upper {
            let next_round = next_round(round, round_order);
            let winner_to = next_round.map(|r| {
                let idx = match_index(&m.bracket_position);
                format!("{}{}", r, (idx + 1).div_ceil(2))
            });

            upper_nodes.push(BracketNode {
                position: m.bracket_position.clone(),
                team_a: Some(m.team_a_id),
                team_b: Some(m.team_b_id),
                score_a: m.score_a,
                score_b: m.score_b,
                winner_to,
                loser_to: Some(format!("LB{}", match_index(&m.bracket_position) + 1)),
            });
        }

        // Lower bracket matches
        let round_lower: Vec<&EliminationMatch> = lower_matches
            .iter()
            .filter(|m| m.bracket_position.starts_with(&format!("LB{}", round)))
            .collect();

        for m in &round_lower {
            lower_nodes.push(BracketNode {
                position: m.bracket_position.clone(),
                team_a: Some(m.team_a_id),
                team_b: Some(m.team_b_id),
                score_a: m.score_a,
                score_b: m.score_b,
                winner_to: None,
                loser_to: None,
            });
        }
    }

    (upper_nodes, lower_nodes)
}

fn next_round<'a>(current: &str, order: &[&'a str]) -> Option<&'a str> {
    for i in 0..order.len() {
        if order[i] == current && i + 1 < order.len() {
            return Some(order[i + 1]);
        }
    }
    None
}

fn match_index(pos: &str) -> usize {
    pos.chars()
        .filter(|c| c.is_ascii_digit())
        .collect::<String>()
        .parse()
        .unwrap_or(1)
}

#[derive(Debug, Clone)]
pub struct EliminationMatch {
    pub team_a_id: Uuid,
    pub team_b_id: Uuid,
    pub score_a: Option<i32>,
    pub score_b: Option<i32>,
    pub bracket_position: String,
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
    fn test_single_elim_4_teams() {
        let matches = vec![
            EliminationMatch {
                team_a_id: tid("t1"),
                team_b_id: tid("t2"),
                score_a: Some(2),
                score_b: Some(0),
                bracket_position: "SF1".into(),
            },
            EliminationMatch {
                team_a_id: tid("t3"),
                team_b_id: tid("t4"),
                score_a: Some(1),
                score_b: Some(2),
                bracket_position: "SF2".into(),
            },
            EliminationMatch {
                team_a_id: tid("t1"),
                team_b_id: tid("t4"),
                score_a: None,
                score_b: None,
                bracket_position: "F".into(),
            },
        ];

        let nodes = build_single_elim_bracket(&matches, &["SF", "F"]);
        assert_eq!(nodes.len(), 3);
        assert_eq!(nodes[0].position, "SF1");
        assert_eq!(nodes[0].winner_to, Some("F1".into()));
        assert_eq!(nodes[1].position, "SF2");
        assert_eq!(nodes[1].winner_to, Some("F1".into()));
        assert_eq!(nodes[2].position, "F");
        assert_eq!(nodes[2].winner_to, None);
    }
}
