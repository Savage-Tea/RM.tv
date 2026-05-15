import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ScoreDisplay } from "@/components/shared/ScoreDisplay";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

export function MatchesPage() {
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);

  const matches = useQuery({
    queryKey: ["matches", status, page],
    queryFn: () => api.matches.list({
      ...(status && { status }),
      page: String(page),
      per_page: "20",
    }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="比赛" description="比赛记录与详情" />

      <div className="flex gap-2">
        {["", "live", "scheduled", "finished"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              status === s ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
            }`}
          >
            {s === "" ? "全部" : s === "live" ? "进行中" : s === "scheduled" ? "未开始" : "已结束"}
          </button>
        ))}
      </div>

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
                <div className="flex-1 text-right">
                  <div className="font-medium">{m.team_a_name}</div>
                </div>
                <div className="flex flex-col items-center justify-center min-w-28 min-h-[4.5rem] gap-1">
                  {m.status === "scheduled" ? (
                    m.scheduled_at ? (
                      <>
                        <div className="text-lg font-semibold text-primary leading-none">
                          {new Date(m.scheduled_at).toLocaleTimeString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit",
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
                <div className="flex-1">
                  <div className="font-medium">{m.team_b_name}</div>
                </div>
                <div className="text-xs text-muted-foreground text-center min-w-24">
                  {m.event_name}
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

      {matches.data && matches.data.total > matches.data.per_page && (
        <div className="flex justify-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            上一页
          </button>
          <span className="text-sm py-1 text-muted-foreground">
            {page} / {Math.ceil(matches.data.total / matches.data.per_page)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(matches.data.total / matches.data.per_page)}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
