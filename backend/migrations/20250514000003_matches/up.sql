CREATE TYPE match_status AS ENUM ('scheduled', 'live', 'finished');
CREATE TYPE match_format AS ENUM ('bo1', 'bo3', 'bo5', 'bo7');
CREATE TYPE robot_type AS ENUM ('hero', 'infantry', 'sentinel', 'engineer', 'uav', 'dart', 'radar');

CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES event_stages(id) ON DELETE SET NULL,
    team_a_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    team_b_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    score_a INT,
    score_b INT,
    format match_format NOT NULL DEFAULT 'bo3',
    status match_status NOT NULL DEFAULT 'scheduled',
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    bracket_position VARCHAR(20),
    round INT,
    group_name VARCHAR(100),
    vod_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_event ON matches (event_id);
CREATE INDEX idx_matches_stage ON matches (stage_id);
CREATE INDEX idx_matches_status ON matches (status);
CREATE INDEX idx_matches_teams ON matches (team_a_id, team_b_id);

CREATE TABLE match_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    map_name VARCHAR(100) NOT NULL,
    order_index INT NOT NULL,
    score_a INT,
    score_b INT,
    duration_seconds INT,
    played_at TIMESTAMPTZ
);

CREATE INDEX idx_match_maps_match ON match_maps (match_id);

CREATE TABLE match_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    robot_type robot_type NOT NULL,
    UNIQUE (match_id, member_id)
);

CREATE TABLE map_robot_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_map_id UUID NOT NULL REFERENCES match_maps(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    robot_type robot_type NOT NULL,
    kills INT NOT NULL DEFAULT 0,
    deaths INT NOT NULL DEFAULT 0,
    damage INT NOT NULL DEFAULT 0,
    hp_healed INT NOT NULL DEFAULT 0,
    base_damage INT NOT NULL DEFAULT 0,
    alive_time_seconds INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_map_robot_stats_map ON map_robot_stats (match_map_id);
CREATE INDEX idx_map_robot_stats_member ON map_robot_stats (member_id);
