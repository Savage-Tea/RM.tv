CREATE TYPE event_status AS ENUM ('upcoming', 'ongoing', 'concluded');
CREATE TYPE stage_format AS ENUM ('round_robin', 'swiss', 'single_elim', 'double_elim', 'gsl_groups', 'fixed_bracket');
CREATE TYPE stage_type AS ENUM ('group', 'bracket', 'final');

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    series VARCHAR(255) NOT NULL,
    season VARCHAR(20) NOT NULL,
    start_date DATE,
    end_date DATE,
    location VARCHAR(255),
    status event_status NOT NULL DEFAULT 'upcoming',
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_season ON events (season);
CREATE INDEX idx_events_status ON events (status);

CREATE TABLE event_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    stage_format stage_format NOT NULL,
    stage_type stage_type NOT NULL,
    order_index INT NOT NULL,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_stages_event ON event_stages (event_id);

CREATE TABLE event_stage_progression (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_stage_id UUID NOT NULL REFERENCES event_stages(id) ON DELETE CASCADE,
    to_stage_id UUID NOT NULL REFERENCES event_stages(id) ON DELETE CASCADE,
    slots INT NOT NULL,
    rule_description TEXT,
    UNIQUE (from_stage_id, to_stage_id)
);

CREATE TABLE event_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    seed INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, team_id)
);

CREATE INDEX idx_event_entries_event ON event_entries (event_id);
