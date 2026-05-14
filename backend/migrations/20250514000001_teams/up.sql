CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    university VARCHAR(255) NOT NULL,
    abbreviation VARCHAR(10),
    logo_url TEXT,
    founded_year INT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_name ON teams (name);
CREATE INDEX idx_teams_university ON teams (university);

CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    avatar_url TEXT,
    joined_year INT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_members_team ON team_members (team_id);

CREATE TABLE member_robot_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    robot_type VARCHAR(20) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (member_id, robot_type)
);
