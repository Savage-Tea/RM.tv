CREATE TABLE stage_standings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES event_stages(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    rank INT NOT NULL,
    wins INT NOT NULL DEFAULT 0,
    losses INT NOT NULL DEFAULT 0,
    draws INT NOT NULL DEFAULT 0,
    map_wins INT NOT NULL DEFAULT 0,
    map_losses INT NOT NULL DEFAULT 0,
    points INT NOT NULL DEFAULT 0,
    buchholz_score DECIMAL(10, 4),
    UNIQUE (stage_id, team_id)
);

CREATE INDEX idx_stage_standings_stage ON stage_standings (stage_id);
CREATE INDEX idx_stage_standings_rank ON stage_standings (stage_id, rank);
