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

  events: (params?: Record<string, string>) =>
    fetchJSON<any[]>("/events", params),

  matches: (params?: Record<string, string>) =>
    fetchJSON<any[]>("/matches", params),

  teams: (params?: Record<string, string>) =>
    fetchJSON<any[]>("/teams", params),

  rankings: () => fetchJSON<any[]>("/rankings"),

  stats: (params?: Record<string, string>) =>
    fetchJSON<any[]>("/stats/robots", params),
};
