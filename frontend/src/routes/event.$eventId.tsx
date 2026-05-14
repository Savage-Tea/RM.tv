import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export function EventDetailPage() {
  const { eventId } = useParams({ from: "/events/$eventId" });

  const event = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => api.events.get(eventId),
  });

  if (event.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!event.data) {
    return <p className="text-muted-foreground">赛事未找到</p>;
  }

  const e = event.data;

  return (
    <div className="space-y-6">
      <PageHeader title={e.name} description={`${e.series} · ${e.season}`}>
        <StatusBadge status={e.status} />
      </PageHeader>

      {e.location && (
        <p className="text-sm text-muted-foreground">
          地点: {e.location}
          {e.start_date && ` · ${e.start_date}`}
          {e.end_date && ` — ${e.end_date}`}
        </p>
      )}

      {e.stages.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">阶段</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {e.stages.map((stage) => (
              <div key={stage.id} className="rounded-lg border p-4">
                <div className="font-medium">{stage.name}</div>
                <div className="text-sm text-muted-foreground mt-1 space-x-2">
                  <span>{stage.stage_type === "group" ? "小组赛" : stage.stage_type === "bracket" ? "淘汰赛" : "决赛"}</span>
                  <span>·</span>
                  <span>{stage.stage_format === "round_robin" ? "单循环" : stage.stage_format === "swiss" ? "瑞士轮" : stage.stage_format === "single_elim" ? "单败淘汰" : stage.stage_format === "double_elim" ? "双败淘汰" : stage.stage_format}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {e.entries.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">
            参赛战队 ({e.entries.length})
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">种子</TableHead>
                <TableHead>战队</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {e.entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground">
                    {entry.seed ?? "-"}
                  </TableCell>
                  <TableCell>{entry.team_id}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
