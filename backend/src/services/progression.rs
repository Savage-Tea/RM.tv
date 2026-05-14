use uuid::Uuid;

use crate::models::{EventStage, EventStageProgression, StageStandings};

fn is_power_of_two(n: i32) -> bool {
    n > 0 && (n & (n - 1)) == 0
}

/// Validate that progression rules match available slots.
pub fn validate_progression(
    from_stage: &EventStage,
    to_stage: &EventStage,
    slots: i32,
) -> Result<(), String> {
    // Check that slot count is reasonable
    if slots < 1 {
        return Err("Progression slots must be at least 1".into());
    }

    // Group stage to bracket: slots should be power of 2
    if from_stage.stage_type == "group" && to_stage.stage_type == "bracket" {
        if !is_power_of_two(slots) {
            return Err(format!(
                "Bracket stage requires power-of-2 slots, got {}",
                slots
            ));
        }
    }

    // Single-elim stages should have power-of-2 entries
    if to_stage.stage_format == "single_elim" && !is_power_of_two(slots) {
        return Err(format!(
            "Single elimination requires power-of-2 slots, got {}",
            slots
        ));
    }

    Ok(())
}

/// Determine which teams advance from a stage based on standings.
/// Returns the list of team_ids that qualify for the next stage.
pub fn get_qualifying_teams(
    standings: &[StageStandings],
    progression: &EventStageProgression,
) -> Vec<Uuid> {
    // Sort by rank
    let mut sorted = standings.to_vec();
    sorted.sort_by_key(|s| s.rank);

    sorted.iter()
        .take(progression.slots as usize)
        .map(|s| s.team_id)
        .collect()
}

/// Generate match records for the next stage based on progression.
/// For bracket stages, seeds teams based on their rank in the previous stage.
pub fn generate_bracket_seeds(
    qualifying_teams: &[Uuid],
    _to_stage: &EventStage,
) -> Vec<BracketSeed> {
    let count = qualifying_teams.len();
    let mut seeds: Vec<BracketSeed> = Vec::new();

    // Standard bracket seeding: 1 vs 8, 4 vs 5, 3 vs 6, 2 vs 7 (for 8 teams)
    for i in 0..(count / 2) {
        seeds.push(BracketSeed {
            position: format!("R1_{}", i + 1),
            team_a: qualifying_teams[i],
            team_b: qualifying_teams[count - 1 - i],
        });
    }

    seeds
}

/// Generate the first-round matches for a bracket stage from seeded teams.
pub fn generate_bracket_matches(
    seeds: &[BracketSeed],
    to_stage_id: Uuid,
    event_id: Uuid,
) -> Vec<MatchTemplate> {
    seeds.iter().map(|s| MatchTemplate {
        event_id,
        stage_id: to_stage_id,
        team_a_id: s.team_a,
        team_b_id: s.team_b,
        bracket_position: s.position.clone(),
    }).collect()
}

#[derive(Debug, Clone)]
pub struct BracketSeed {
    pub position: String,
    pub team_a: Uuid,
    pub team_b: Uuid,
}

#[derive(Debug, Clone)]
pub struct MatchTemplate {
    pub event_id: Uuid,
    pub stage_id: Uuid,
    pub team_a_id: Uuid,
    pub team_b_id: Uuid,
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

    fn make_stage(stage_type: &str, stage_format: &str) -> EventStage {
        EventStage {
            id: Uuid::new_v4(),
            event_id: Uuid::new_v4(),
            name: "Test Stage".into(),
            stage_format: stage_format.into(),
            stage_type: stage_type.into(),
            order_index: 1,
            start_date: None,
            end_date: None,
            created_at: chrono::Utc::now(),
        }
    }

    #[test]
    fn test_validate_progression_valid() {
        let from = make_stage("group", "round_robin");
        let to = make_stage("bracket", "single_elim");
        assert!(validate_progression(&from, &to, 8).is_ok());
    }

    #[test]
    fn test_validate_progression_invalid_slots() {
        let from = make_stage("group", "round_robin");
        let to = make_stage("bracket", "single_elim");
        assert!(validate_progression(&from, &to, 6).is_err());
    }

    #[test]
    fn test_bracket_seeds_8_teams() {
        let teams: Vec<Uuid> = (1..=8).map(|i| tid(&format!("t{}", i))).collect();
        let stage = make_stage("bracket", "single_elim");
        let seeds = generate_bracket_seeds(&teams, &stage);
        assert_eq!(seeds.len(), 4);
        // 1 vs 8
        assert_eq!(seeds[0].team_a, teams[0]);
        assert_eq!(seeds[0].team_b, teams[7]);
        // 2 vs 7
        assert_eq!(seeds[1].team_a, teams[1]);
        assert_eq!(seeds[1].team_b, teams[6]);
    }
}
