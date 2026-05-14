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

async function authFetch<T>(
  path: string,
  options: RequestInit & { params?: Record<string, string> } = {},
): Promise<T> {
  const { params, ...fetchOptions } = options;
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const token = localStorage.getItem("access_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url.toString(), { ...fetchOptions, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
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

  auth: {
    login: (username: string, password: string) =>
      authFetch<{ access_token: string; user: { id: string; username: string } }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ username, password }) },
      ),
    refresh: () =>
      fetch("/api/auth/refresh", { method: "POST" }).then((r) => r.json()),
    logout: () => authFetch<{ message: string }>("/auth/logout", { method: "POST" }),
  },

  admin: {
    events: {
      create: (data: Record<string, unknown>) =>
        authFetch<Event>("/admin/events", { method: "POST", body: JSON.stringify(data) }),
      update: (id: string, data: Record<string, unknown>) =>
        authFetch<Event>(`/admin/events/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (id: string) =>
        authFetch<{ deleted: boolean }>(`/admin/events/${id}`, { method: "DELETE" }),
    },
    matches: {
      create: (data: Record<string, unknown>) =>
        authFetch<MatchDetail>("/admin/matches", { method: "POST", body: JSON.stringify(data) }),
      update: (id: string, data: Record<string, unknown>) =>
        authFetch<MatchDetail>(`/admin/matches/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    },
    teams: {
      create: (data: Record<string, unknown>) =>
        authFetch<Team>("/admin/teams", { method: "POST", body: JSON.stringify(data) }),
      update: (id: string, data: Record<string, unknown>) =>
        authFetch<Team>(`/admin/teams/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    },
  },
};
