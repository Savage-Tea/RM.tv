export interface Team {
  id: string;
  name: string;
  name_en?: string;
  university: string;
  abbreviation?: string;
  logo_url?: string;
  founded_year?: number;
  description?: string;
}

export interface Event {
  id: string;
  name: string;
  series: string;
  season: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  status: "upcoming" | "ongoing" | "concluded";
}

export interface MatchSummary {
  id: string;
  team_a: Team;
  team_b: Team;
  score_a?: number;
  score_b?: number;
  format: string;
  scheduled_at?: string;
  status: "scheduled" | "live" | "finished";
  event: Event;
}

export interface RankingEntry {
  rank: number;
  team: Team;
  elo: number;
  matches: number;
}
