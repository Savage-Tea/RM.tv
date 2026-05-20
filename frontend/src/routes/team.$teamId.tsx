import { useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TeamLogo } from "@/components/shared/TeamLogo";
import { ScoreDisplay } from "@/components/shared/ScoreDisplay";
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
              const oppName = side === "a" ? m.team_b_name : m.team_a_name;
              const oppUni = side === "a" ? m.team_b_university : m.team_a_university;
              const oppLogo = side === "a" ? m.team_b_logo_url : m.team_a_logo_url;
              const isScheduled = m.status === "scheduled";
              const finished = m.score_a != null && m.score_b != null;
              const isWinner = finished
                ? (side === "a" && m.score_a > m.score_b) || (side === "b" && m.score_b > m.score_a)
                : false;
              const isDraw = finished && m.score_a === m.score_b;

              return (
                <Link
                  key={m.id}
                  to="/matches/$matchId"
                  params={{ matchId: m.id }}
                  className="flex items-center gap-4 rounded-lg border p-3 hover:border-primary/50 transition-colors"
                >
                  {/* Self */}
                  <div className="flex-1 text-right min-w-0 flex items-center justify-end gap-2.5">
                    <div>
                      <div className={`font-medium truncate text-sm ${isWinner ? "text-primary" : ""}`}>
                        {t.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{t.university}</div>
                    </div>
                    <TeamLogo name={t.name} logoUrl={t.logo_url} abbreviation={t.abbreviation} size="sm" />
                  </div>
                  {/* Score / Time */}
                  <div className="flex flex-col items-center min-w-20">
                    {isScheduled ? (
                      m.scheduled_at ? (
                        <div className="text-sm font-semibold leading-none">
                          {new Date(m.scheduled_at).toLocaleTimeString("zh-CN", {
                            hour: "2-digit", minute: "2-digit", hour12: false,
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">待确认</div>
                      )
                    ) : (
                      <ScoreDisplay scoreA={m.score_a} scoreB={m.score_b} winner={isWinner ? side : isDraw ? null : (finished ? (side === "a" ? "b" : "a") : null)} />
                    )}
                    <StatusBadge status={m.status} />
                  </div>
                  {/* Opponent */}
                  <div className="flex-1 min-w-0 flex items-center gap-2.5">
                    <TeamLogo name={oppName} logoUrl={oppLogo} abbreviation={oppName.slice(0, 2)} size="sm" />
                    <div>
                      <div className={`font-medium truncate text-sm ${!isScheduled && !isWinner && !isDraw ? "text-primary" : ""}`}>
                        {oppName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{oppUni}</div>
                    </div>
                  </div>
                  {/* Event info */}
                  <div className="text-xs text-muted-foreground text-right min-w-24 shrink-0">
                    <div className="truncate max-w-32">{m.event_name}</div>
                    {m.stage_name && <div className="text-muted-foreground/70">{m.stage_name}</div>}
                    {m.group_name && ` · ${m.group_name}`}
                    <div className="text-muted-foreground/50">{m.format?.toUpperCase()}</div>
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
