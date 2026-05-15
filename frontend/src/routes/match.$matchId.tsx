import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ScoreDisplay } from "@/components/shared/ScoreDisplay";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableRow,
} from "@/components/ui/table";
import type { Column } from "@/components/shared/DataTable";
import type { MapRobotStats } from "@/types";
import { ROBOT_TYPE_LABELS } from "@/types";

export function MatchDetailPage() {
  const { matchId } = useParams({ from: "/matches/$matchId" });

  const match = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => api.matches.get(matchId),
  });

  if (match.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!match.data) {
    return <p className="text-muted-foreground">比赛未找到</p>;
  }

  const m = match.data;
  const winner = m.score_a != null && m.score_b != null
    ? m.score_a > m.score_b ? "a" as const : m.score_b > m.score_a ? "b" as const : null
    : null;

  const statsColumns: Column<MapRobotStats>[] = [
    {
      header: "机器人",
      render: (s) => ROBOT_TYPE_LABELS[s.robot_type] ?? s.robot_type,
      className: "w-20",
    },
    { header: "击杀", accessor: "kills", className: "text-right" },
    { header: "死亡", accessor: "deaths", className: "text-right" },
    { header: "伤害", accessor: "damage", className: "text-right" },
    { header: "治疗", accessor: "hp_healed", className: "text-right" },
    { header: "基地伤害", accessor: "base_damage", className: "text-right" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${m.team_a_name || m.team_a_id} vs ${m.team_b_name || m.team_b_id}`}
        description={`${m.format?.toUpperCase()}`}
      >
        <StatusBadge status={m.status} />
      </PageHeader>

      <div className="flex justify-center py-8">
        <div className="flex items-center gap-8">
          <div className="text-right">
            <div className="text-xl font-bold">{m.team_a_name || m.team_a_id}</div>
            {m.team_a_abbreviation && (
              <div className="text-sm text-muted-foreground">{m.team_a_abbreviation}</div>
            )}
          </div>
          <ScoreDisplay scoreA={m.score_a} scoreB={m.score_b} winner={winner} size="lg" />
          <div>
            <div className="text-xl font-bold">{m.team_b_name || m.team_b_id}</div>
            {m.team_b_abbreviation && (
              <div className="text-sm text-muted-foreground">{m.team_b_abbreviation}</div>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="maps">
        <TabsList>
          <TabsTrigger value="maps">对局详情</TabsTrigger>
          <TabsTrigger value="stats">数据统计</TabsTrigger>
          <TabsTrigger value="overview">赛事信息</TabsTrigger>
        </TabsList>

        <TabsContent value="maps" className="mt-4">
          {m.maps.length > 0 ? (
            <div className="space-y-4">
              {m.maps.sort((a, b) => a.order_index - b.order_index).map((mp) => (
                <div key={mp.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      第 {mp.order_index} 局 · {mp.map_name}
                    </div>
                    <ScoreDisplay scoreA={mp.score_a} scoreB={mp.score_b} size="sm" />
                    {mp.duration_seconds && (
                      <div className="text-sm text-muted-foreground">
                        {Math.floor(mp.duration_seconds / 60)}分{mp.duration_seconds % 60}秒
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">暂无对局数据</p>
          )}
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <DataTable
            columns={statsColumns}
            data={m.robot_stats}
            keyExtractor={(s) => s.id}
            emptyMessage="暂无统计数据"
          />
        </TabsContent>

        <TabsContent value="overview" className="mt-4">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium w-32">赛事</TableCell>
                <TableCell>{m.event_id}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">阶段</TableCell>
                <TableCell>{m.stage_id ?? "—"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">赛制</TableCell>
                <TableCell>{m.format?.toUpperCase()}</TableCell>
              </TableRow>
              {m.group_name && (
                <TableRow>
                  <TableCell className="font-medium">小组</TableCell>
                  <TableCell>{m.group_name}</TableCell>
                </TableRow>
              )}
              {m.round != null && (
                <TableRow>
                  <TableCell className="font-medium">轮次</TableCell>
                  <TableCell>第 {m.round} 轮</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
