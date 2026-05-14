CREATE TABLE team_elo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    season VARCHAR(20) NOT NULL,
    rating DECIMAL(8, 2) NOT NULL DEFAULT 1500.00,
    matches_played INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (team_id, season)
);

CREATE INDEX idx_team_elo_rating ON team_elo (rating DESC);

CREATE TABLE team_elo_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    season VARCHAR(20) NOT NULL,
    old_rating DECIMAL(8, 2) NOT NULL,
    new_rating DECIMAL(8, 2) NOT NULL,
    change DECIMAL(8, 2) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_elo_history_team ON team_elo_history (team_id, season);
CREATE INDEX idx_team_elo_history_time ON team_elo_history (recorded_at);

CREATE TABLE rating_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season VARCHAR(20) NOT NULL UNIQUE,
    kills_weight DECIMAL(5, 3) NOT NULL DEFAULT 1.000,
    deaths_weight DECIMAL(5, 3) NOT NULL DEFAULT -0.500,
    damage_weight DECIMAL(5, 3) NOT NULL DEFAULT 0.010,
    heal_weight DECIMAL(5, 3) NOT NULL DEFAULT 0.005,
    base_damage_weight DECIMAL(5, 3) NOT NULL DEFAULT 0.100,
    survival_weight DECIMAL(5, 3) NOT NULL DEFAULT 0.001,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE robot_rating (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    robot_type robot_type NOT NULL,
    season VARCHAR(20) NOT NULL,
    rating DECIMAL(8, 2) NOT NULL DEFAULT 1500.00,
    matches_played INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (member_id, robot_type, season)
);

CREATE INDEX idx_robot_rating_type ON robot_rating (season, robot_type, rating DESC);

CREATE TABLE robot_rating_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    robot_type robot_type NOT NULL,
    season VARCHAR(20) NOT NULL,
    old_rating DECIMAL(8, 2) NOT NULL,
    new_rating DECIMAL(8, 2) NOT NULL,
    change DECIMAL(8, 2) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_robot_rating_history ON robot_rating_history (member_id, season, robot_type);
