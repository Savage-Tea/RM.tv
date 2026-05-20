import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ScoreDisplay } from "@/components/shared/ScoreDisplay";
import { TeamLogo } from "@/components/shared/TeamLogo";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

const SEASONS = ["", "2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019"];
const STAGE_TYPES = [
  { value: "", label: "全部阶段" },
  { value: "group", label: "小组赛" },
  { value: "bracket", label: "淘汰赛" },
  { value: "final", label: "决赛" },
];
const STATUSES = [
  { value: "", label: "全部状态" },
  { value: "live", label: "进行中" },
  { value: "scheduled", label: "未开始" },
  { value: "finished", label: "已结束" },
];
const SORT_OPTIONS = [
  { value: "scheduled_at-desc", label: "时间↓" },
  { value: "scheduled_at-asc", label: "时间↑" },
  { value: "created_at-desc", label: "创建时间↓" },
  { value: "created_at-asc", label: "创建时间↑" },
];

function readParams(): Record<string, string> {
  const s = new URLSearchParams(window.location.search);
  return {
    season: s.get("season") ?? "",
    stage_type: s.get("stage_type") ?? "",
    status: s.get("status") ?? "",
    search: s.get("search") ?? "",
    sort: s.get("sort") ?? "scheduled_at-desc",
    page: s.get("page") ?? "1",
  };
}

function updateUrl(params: Record<string, string>) {
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "1" && v !== "scheduled_at-desc") url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  }
  window.history.replaceState(null, "", url.toString());
}

export function MatchesPage() {
  const [params, setParams] = useState(readParams);
  const [searchInput, setSearchInput] = useState(params.search);

  const season = params.season;
  const stageType = params.stage_type;
  const status = params.status;
  const search = params.search;
  const sort = params.sort;
  const page = parseInt(params.page) || 1;

  const [sortField, sortOrder] = sort.split("-");

  const matches = useQuery({
    queryKey: ["matches", season, stageType, status, search, sortField, sortOrder, page],
    queryFn: () => api.matches.list({
      ...(season && { season }),
      ...(stageType && { stage_type: stageType }),
      ...(status && { status }),
      ...(search && { search }),
      sort: sortField,
      order: sortOrder,
      page: String(page),
      per_page: "20",
    }),
  });

  // Debounced search: sync input -> URL after 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== params.search) {
        const next = { ...params, search: searchInput, page: "1" };
        setParams(next);
        updateUrl(next);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const setParam = useCallback((key: string, value: string) => {
    setParams((prev) => {
      const next = { ...prev, [key]: value };
      if (key !== "page") next.page = "1";
      updateUrl(next);
      return next;
    });
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="比赛" description="比赛记录与详情" />

      {/* Filters */}
      <div className="space-y-3">
        {/* Search */}
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索战队或学校..."
          className="w-full rounded-md border px-3 py-1.5 text-sm"
        />

        <div className="flex gap-2 flex-wrap">
          {/* Season */}
          <select
            value={season}
            onChange={(e) => setParam("season", e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            {SEASONS.map((s) => (
              <option key={s} value={s}>{s || "全部赛季"}</option>
            ))}
          </select>

          {/* Stage type */}
          <select
            value={stageType}
            onChange={(e) => setParam("stage_type", e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            {STAGE_TYPES.map((st) => (
              <option key={st.value} value={st.value}>{st.label}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={status}
            onChange={(e) => setParam("status", e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setParam("sort", e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            {SORT_OPTIONS.map((so) => (
              <option key={so.value} value={so.value}>{so.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      {matches.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : matches.data?.data.length ? (
        <div className="space-y-3">
          {matches.data.data.map((m) => {
            const winner = m.score_a != null && m.score_b != null
              ? m.score_a > m.score_b ? "a" as const : m.score_b > m.score_a ? "b" as const : null
              : null;

            return (
              <Link
                key={m.id}
                to="/matches/$matchId"
                params={{ matchId: m.id }}
                className="flex items-center gap-4 rounded-lg border p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex-1 text-right min-w-0 flex items-center justify-end gap-3">
                  <div>
                    <div className="font-medium truncate">{m.team_a_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.team_a_university}</div>
                  </div>
                  <TeamLogo name={m.team_a_name} logoUrl={m.team_a_logo_url} abbreviation={m.team_a_name.slice(0, 2)} size="sm" />
                </div>
                <div className="flex flex-col items-center justify-center min-w-28 min-h-[4.5rem] gap-1">
                  {m.status === "scheduled" ? (
                    m.scheduled_at ? (
                      <>
                        <div className="text-lg font-semibold text-primary leading-none">
                          {new Date(m.scheduled_at).toLocaleTimeString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(m.scheduled_at).toLocaleDateString("zh-CN", {
                            month: "numeric",
                            day: "numeric",
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">待确认</div>
                    )
                  ) : (
                    <ScoreDisplay scoreA={m.score_a} scoreB={m.score_b} winner={winner} />
                  )}
                  <StatusBadge status={m.status} />
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <TeamLogo name={m.team_b_name} logoUrl={m.team_b_logo_url} abbreviation={m.team_b_name.slice(0, 2)} size="sm" />
                  <div>
                    <div className="font-medium truncate">{m.team_b_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.team_b_university}</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground text-center min-w-24">
                  {m.event_name}
                  {m.stage_name && <div className="text-muted-foreground/70">{m.stage_name}</div>}
                  {m.group_name && ` · ${m.group_name}`}
                  <div>{m.format?.toUpperCase()}</div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-12">暂无比赛数据</p>
      )}

      {/* Pagination */}
      {matches.data && matches.data.total > matches.data.per_page && (
        <div className="flex justify-center gap-2 items-center">
          <button
            onClick={() => setParam("page", "1")}
            disabled={page === 1}
            className="px-2 py-1 text-sm border rounded disabled:opacity-50"
            title="首页"
          >
            «
          </button>
          <button
            onClick={() => setParam("page", String(Math.max(1, page - 1)))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            上一页
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const input = form.elements.namedItem("page") as HTMLInputElement;
              const n = parseInt(input.value, 10);
              const maxPage = Math.ceil(matches.data!.total / matches.data!.per_page);
              if (n >= 1 && n <= maxPage) setParam("page", String(n));
            }}
            className="flex items-center gap-1"
          >
            <input
              name="page"
              type="number"
              min={1}
              max={Math.ceil(matches.data.total / matches.data.per_page)}
              defaultValue={page}
              key={page}
              className="w-16 text-center text-sm border rounded py-0.5 bg-background"
            />
            <span className="text-sm text-muted-foreground">
              / {Math.ceil(matches.data.total / matches.data.per_page)}
            </span>
          </form>
          <button
            onClick={() => setParam("page", String(page + 1))}
            disabled={page >= Math.ceil(matches.data.total / matches.data.per_page)}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            下一页
          </button>
          <button
            onClick={() => setParam("page", String(Math.ceil(matches.data.total / matches.data.per_page)))}
            disabled={page >= Math.ceil(matches.data.total / matches.data.per_page)}
            className="px-2 py-1 text-sm border rounded disabled:opacity-50"
            title="末页"
          >
            »
          </button>
        </div>
      )}
    </div>
  );
}
