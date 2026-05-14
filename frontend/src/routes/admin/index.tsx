import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Calendar, Swords, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminDashboardPage() {
  const events = useQuery({
    queryKey: ["admin", "events", "recent"],
    queryFn: () => api.events.list({ per_page: "5", sort: "created_at", order: "desc" }),
  });
  const matches = useQuery({
    queryKey: ["admin", "matches", "recent"],
    queryFn: () => api.matches.list({ per_page: "5", sort: "created_at", order: "desc" }),
  });
  const teams = useQuery({
    queryKey: ["admin", "teams", "recent"],
    queryFn: () => api.teams.list({ per_page: "5" }),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">管理仪表盘</h1>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Link to="/admin/events">
          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">赛事总数</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {events.isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold">{events.data?.total ?? 0}</p>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link to="/admin/matches">
          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">比赛总数</CardTitle>
              <Swords className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {matches.isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold">{matches.data?.total ?? 0}</p>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link to="/admin/teams">
          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">战队总数</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {teams.isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold">{teams.data?.total ?? 0}</p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">最近赛事</CardTitle>
          </CardHeader>
          <CardContent>
            {events.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : events.data?.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无赛事数据</p>
            ) : (
              <ul className="divide-y">
                {events.data?.data.map((e) => (
                  <li key={e.id} className="py-2 flex justify-between items-center">
                    <span className="text-sm">{e.name}</span>
                    <span className="text-xs text-muted-foreground">{e.season}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">最近比赛</CardTitle>
          </CardHeader>
          <CardContent>
            {matches.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : matches.data?.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无比赛数据</p>
            ) : (
              <ul className="divide-y">
                {matches.data?.data.map((m) => (
                  <li key={m.id} className="py-2 flex justify-between items-center">
                    <span className="text-sm">
                      {m.team_a_name} vs {m.team_b_name}
                    </span>
                    <span className="text-xs text-muted-foreground">{m.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
