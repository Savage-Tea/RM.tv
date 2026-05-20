import { useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TeamLogo } from "@/components/shared/TeamLogo";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { ROBOT_TYPE_LABELS } from "@/types";

const ALL_ROBOT_TYPES = ["hero", "infantry", "sentinel", "engineer", "uav", "dart", "radar"];

export function TeamDetailPage() {
  const { teamId } = useParams({ from: "/teams/$teamId" });

  const team = useQuery({
    queryKey: ["team", teamId],
    queryFn: () => api.teams.get(teamId),
  });

  if (team.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!team.data) {
    return <p className="text-muted-foreground">战队未找到</p>;
  }

  const t = team.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <TeamLogo
          name={t.name}
          abbreviation={t.abbreviation}
          logoUrl={t.logo_url}
          size="lg"
        />
        <div>
          <PageHeader title={t.name} />
          {t.name_en && (
            <p className="text-muted-foreground">{t.name_en}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {t.university}
            {t.founded_year && ` · 成立于 ${t.founded_year}`}
          </p>
        </div>
      </div>

      {t.description && (
        <p className="text-sm text-muted-foreground">{t.description}</p>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">机器人数据</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ALL_ROBOT_TYPES.map((rt) => {
            const data = t.robot_ratings.find((rr) => rr.robot_type === rt);
            return (
              <a
                key={rt}
                href={`/stats?robot_type=${rt}`}
                className="rounded-lg border p-4 hover:border-primary/30 transition-colors"
              >
                <div className="text-sm text-muted-foreground">
                  {ROBOT_TYPE_LABELS[rt] ?? rt}
                </div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {data?.rating != null ? data.rating.toFixed(2) : "—"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Rating · {data?.matches_played ?? 0} 场
                </div>
              </a>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">近期比赛</h2>
        {t.recent_matches.length > 0 ? (
          <div className="space-y-2">
            {t.recent_matches.map((m) => {
              const side = m.team_a_id === t.id ? "a" : "b";
              const opponent = side === "a" ? m.team_b_name : m.team_a_name;
              const isScheduled = m.status === "scheduled";
              const isWinner = m.score_a != null && m.score_b != null
                ? (side === "a" && m.score_a > m.score_b) || (side === "b" && m.score_b > m.score_a)
                : false;
              const isDraw = m.score_a != null && m.score_b != null && m.score_a === m.score_b;

              return (
                <Link
                  key={m.id}
                  to="/matches/$matchId"
                  params={{ matchId: m.id }}
                  className="flex items-center gap-4 rounded-lg border p-3 hover:border-primary/30 transition-colors"
                >
                  <div className="flex-1 text-right min-w-0">
                    <div className={`font-medium truncate ${isWinner ? "text-primary" : ""}`}>
                      {t.name}
                    </div>
                  </div>
                  <div className="flex flex-col items-center min-w-32">
                    {isScheduled ? (
                      m.scheduled_at ? (
                        <div className="text-base font-semibold leading-none">
                          {new Date(m.scheduled_at).toLocaleTimeString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">待确认</div>
                      )
                    ) : (
                      <div className={`text-base font-bold font-mono tabular-nums ${
                        isWinner ? "text-primary" : isDraw ? "text-muted-foreground" : ""
                      }`}>
                        {side === "a" ? `${m.score_a ?? "—"}:${m.score_b ?? "—"}` : `${m.score_b ?? "—"}:${m.score_a ?? "—"}`}
                      </div>
                    )}
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate ${!isScheduled && !isWinner && m.score_a !== m.score_b ? "text-primary" : ""}`}>
                      {opponent}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right min-w-20">
                    {m.event_name}
                    {m.group_name && ` · ${m.group_name}`}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">暂无比赛数据</p>
        )}
      </div>
    </div>
  );
}
