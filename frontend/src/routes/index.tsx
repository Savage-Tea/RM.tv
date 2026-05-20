import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "@tanstack/react-router";
import { Calendar, Trophy, Activity, ArrowRight, Flame } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ScoreDisplay } from "@/components/shared/ScoreDisplay";
import { TeamLogo } from "@/components/shared/TeamLogo";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HomePage() {
  const health = useQuery({ queryKey: ["health"], queryFn: () => api.health() });
  const liveMatches = useQuery({
    queryKey: ["matches", "live"],
    queryFn: () => api.matches.list({ status: "live", per_page: "5" }),
  });
  const rankings = useQuery({
    queryKey: ["rankings", "top"],
    queryFn: () => api.rankings.list({ per_page: "5" }),
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">RM.tv</h1>
        <p className="text-muted-foreground mt-1">
          RoboMaster 赛事数据统计平台
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Flame className="h-5 w-5 text-red-500" />
                进行中的比赛
              </CardTitle>
            </CardHeader>
            <CardContent>
              {liveMatches.isLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : liveMatches.data?.data.length ? (
                <div className="space-y-2">
                  {liveMatches.data.data.map((m) => (
                    <Link
                      key={m.id}
                      to="/matches/$matchId"
                      params={{ matchId: m.id }}
                      className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex-1 text-right min-w-0 flex items-center justify-end gap-2">
                        <div>
                          <div className="font-medium text-sm truncate">{m.team_a_name}</div>
                          <div className="text-xs text-muted-foreground truncate">{m.team_a_university}</div>
                        </div>
                        <TeamLogo name={m.team_a_name} logoUrl={m.team_a_logo_url} abbreviation={m.team_a_name.slice(0, 2)} size="sm" />
                      </div>
                      <div className="flex flex-col items-center min-w-16">
                        <ScoreDisplay scoreA={m.score_a} scoreB={m.score_b} />
                        <StatusBadge status={m.status} />
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <TeamLogo name={m.team_b_name} logoUrl={m.team_b_logo_url} abbreviation={m.team_b_name.slice(0, 2)} size="sm" />
                        <div>
                          <div className="font-medium text-sm truncate">{m.team_b_name}</div>
                          <div className="text-xs text-muted-foreground truncate">{m.team_b_university}</div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {m.stage_name && <div>{m.stage_name}</div>}
                        {m.group_name && <span>· {m.group_name}</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  暂无进行中的比赛
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-3">
            <QuickCard
              title="赛事"
              description="查看 RoboMaster 赛事赛程与结果"
              to="/events"
              icon={Calendar}
            />
            <QuickCard
              title="排名"
              description="战队 Elo 实力排名"
              to="/rankings"
              icon={Trophy}
            />
            <QuickCard
              title="数据"
              description="机器人表现数据与统计"
              to="/stats"
              icon={Activity}
            />
          </div>
        </div>

        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Elo 排名</CardTitle>
            </CardHeader>
            <CardContent>
              {rankings.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : rankings.data?.data.length ? (
                <div className="space-y-1">
                  {rankings.data.data.map((r) => (
                    <div key={r.team_id} className="flex items-center justify-between py-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-5 text-right">{r.rank}</span>
                        <span className="font-medium">{r.team_abbreviation ?? r.team_name}</span>
                      </div>
                      <span className="font-mono text-xs">{r.rating.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">暂无数据</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        API 状态: {health.isLoading ? "连接中..." : health.data?.status === "ok" ? "正常" : "异常"}
      </p>
    </div>
  );
}

function QuickCard({ title, description, to, icon: Icon }: {
  title: string;
  description: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      className="group rounded-lg border p-5 hover:border-primary/50 transition-colors"
    >
      <Icon className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
        查看 <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}
