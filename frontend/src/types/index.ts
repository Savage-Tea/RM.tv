export interface Team {
  id: string;
  name: string;
  name_en?: string;
  university: string;
  abbreviation?: string;
  logo_url?: string;
  founded_year?: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  name: string;
  role: string;
  avatar_url?: string;
  joined_year?: number;
  is_active: boolean;
}

export interface MemberRobotRole {
  id: string;
  member_id: string;
  robot_type: string;
  is_primary: boolean;
}

export interface TeamDetail {
  id: string;
  name: string;
  name_en?: string;
  university: string;
  abbreviation?: string;
  logo_url?: string;
  founded_year?: number;
  description?: string;
  members: TeamMemberWithRoles[];
}

export interface TeamMemberWithRoles {
  id: string;
  team_id: string;
  name: string;
  role: string;
  avatar_url?: string;
  joined_year?: number;
  is_active: boolean;
  robot_roles: MemberRobotRole[];
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
  logo_url?: string;
}

export interface EventStage {
  id: string;
  event_id: string;
  name: string;
  stage_format: string;
  stage_type: string;
  order_index: number;
}

export interface EventEntry {
  id: string;
  event_id: string;
  team_id: string;
  seed?: number;
}

export interface EventDetail extends Event {
  stages: EventStage[];
  entries: EventEntry[];
}

export interface MatchSummary {
  id: string;
  event_id: string;
  event_name: string;
  team_a_id: string;
  team_a_name: string;
  team_b_id: string;
  team_b_name: string;
  score_a?: number;
  score_b?: number;
  format: string;
  status: "scheduled" | "live" | "finished";
  scheduled_at?: string;
  group_name?: string;
}

export interface MatchDetail {
  id: string;
  event_id: string;
  stage_id?: string;
  team_a_id: string;
  team_b_id: string;
  score_a?: number;
  score_b?: number;
  format: string;
  status: string;
  scheduled_at?: string;
  started_at?: string;
  finished_at?: string;
  bracket_position?: string;
  round?: number;
  group_name?: string;
  maps: MatchMap[];
  participants: MatchParticipant[];
  robot_stats: MapRobotStats[];
}

export interface MatchMap {
  id: string;
  match_id: string;
  map_name: string;
  order_index: number;
  score_a?: number;
  score_b?: number;
  duration_seconds?: number;
}

export interface MatchParticipant {
  id: string;
  match_id: string;
  team_id: string;
  member_id: string;
  robot_type: string;
}

export interface MapRobotStats {
  id: string;
  match_map_id: string;
  member_id: string;
  robot_type: string;
  kills: number;
  deaths: number;
  damage: number;
  hp_healed: number;
  base_damage: number;
  alive_time_seconds: number;
}

export interface RankingEntry {
  rank: number;
  team_id: string;
  team_name: string;
  team_abbreviation?: string;
  rating: number;
  matches_played: number;
}

export interface TeamEloHistory {
  id: string;
  team_id: string;
  match_id?: string;
  season: string;
  old_rating: number;
  new_rating: number;
  change: number;
  recorded_at: string;
}

export interface RobotRating {
  id: string;
  team_id: string;
  member_id: string;
  robot_type: string;
  season: string;
  rating: number;
  matches_played: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

export const ROBOT_TYPE_LABELS: Record<string, string> = {
  hero: "英雄",
  infantry: "步兵",
  sentinel: "哨兵",
  engineer: "工程",
  uav: "无人机",
  dart: "飞镖",
  radar: "雷达",
};

export const MATCH_STATUS_LABELS: Record<string, string> = {
  scheduled: "未开始",
  live: "进行中",
  finished: "已结束",
};

export const EVENT_STATUS_LABELS: Record<string, string> = {
  upcoming: "未开始",
  ongoing: "进行中",
  concluded: "已结束",
};
