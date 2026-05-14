import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { StandingsTable } from "@/components/events/StandingsTable";
import { StageMatches } from "@/components/events/StageMatches";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { STAGE_FORMAT_LABELS } from "@/types";
import { useState } from "react";

export function EventDetailPage() {
  const { eventId } = useParams({ from: "/events/$eventId" });
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  const event = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => api.events.get(eventId),
  });

  // Fetch stage overview when a stage is selected
  const stageOverview = useQuery({
    queryKey: ["stage", selectedStageId],
    queryFn: () =>
      selectedStageId
        ? api.events.stageOverview(eventId, selectedStageId)
        : null,
    enabled: !!selectedStageId,
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

  // Auto-select first stage
  if (!selectedStageId && e.stages.length > 0) {
    setSelectedStageId(e.stages[0].id);
  }

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

      {/* Stage navigation */}
      {e.stages.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">阶段</h2>
          <div className="flex flex-wrap gap-2">
            {e.stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => setSelectedStageId(stage.id)}
                className={
                  `rounded-lg border px-4 py-2 text-left transition-colors ${
                    selectedStageId === stage.id
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "hover:bg-muted"
                  }`
                }
              >
                <div className="font-medium text-sm">{stage.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {STAGE_FORMAT_LABELS[stage.stage_format] ?? stage.stage_format}
                  {" · "}
                  {stage.stage_type === "group" ? "小组赛" : stage.stage_type === "bracket" ? "淘汰赛" : "决赛"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected stage details */}
      {stageOverview.isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {stageOverview.data && (
        <div className="space-y-6">
          <StandingsTable overview={stageOverview.data} />
          <StageMatches rounds={stageOverview.data.rounds} />
        </div>
      )}

      {/* Team entries */}
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
