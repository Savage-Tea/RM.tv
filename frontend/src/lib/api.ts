import type {
  Team,
  TeamDetail,
  Event,
  EventDetail,
  MatchSummary,
  MatchDetail,
  RankingEntry,
  TeamEloHistory,
  RobotRating,
  PaginatedResponse,
} from "@/types";

const BASE_URL = "/api";

async function fetchJSON<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  health: () => fetchJSON<{ status: string; database: string }>("/health"),

  events: {
    list: (params?: Record<string, string>) =>
      fetchJSON<PaginatedResponse<Event>>("/events", params),
    get: (id: string) =>
      fetchJSON<EventDetail>(`/events/${id}`),
  },

  matches: {
    list: (params?: Record<string, string>) =>
      fetchJSON<PaginatedResponse<MatchSummary>>("/matches", params),
    get: (id: string) =>
      fetchJSON<MatchDetail>(`/matches/${id}`),
  },

  teams: {
    list: (params?: Record<string, string>) =>
      fetchJSON<PaginatedResponse<Team>>("/teams", params),
    get: (id: string) =>
      fetchJSON<TeamDetail>(`/teams/${id}`),
  },

  rankings: {
    list: (params?: Record<string, string>) =>
      fetchJSON<PaginatedResponse<RankingEntry>>("/rankings", params),
    history: (teamId: string, params?: Record<string, string>) =>
      fetchJSON<TeamEloHistory[]>(`/rankings/${teamId}/history`, params),
  },

  stats: {
    robots: (params?: Record<string, string>) =>
      fetchJSON<PaginatedResponse<RobotRating>>("/stats/robots", params),
  },
};
