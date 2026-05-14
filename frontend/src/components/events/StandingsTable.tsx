import { Fragment } from "react";
import { Link } from "@tanstack/react-router";
import type { StageStandingsRow, StageOverview } from "@/types";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

function mapDiff(mw: number, ml: number) {
  const d = mw - ml;
  return d > 0 ? `+${d}` : `${d}`;
}

type RecordGroup = {
  label: string;
  teams: StageStandingsRow[];
};

function groupByRecord(standings: StageStandingsRow[]): RecordGroup[] {
  const groups: RecordGroup[] = [];
  let current: RecordGroup | null = null;
  for (const s of standings) {
    if (!current || current.label !== s.record) {
      current = { label: s.record, teams: [] };
      groups.push(current);
    }
    current.teams.push(s);
  }
  return groups;
}

export function StandingsTable({ overview }: { overview: StageOverview }) {
  const isSwiss = overview.stage_format === "swiss";
  const grouped = isSwiss ? groupByRecord(overview.standings) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {isSwiss ? "瑞士轮积分榜" : "小组积分榜"}
        </h2>
        <span className="text-sm text-muted-foreground">
          {overview.completed_matches}/{overview.total_matches} 场已完成
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>战队</TableHead>
            <TableHead className="w-16 text-center">战绩</TableHead>
            <TableHead className="w-16 text-center">积分</TableHead>
            <TableHead className="w-16 text-center">局分</TableHead>
            {isSwiss && <TableHead className="w-20 text-center">Buchholz</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isSwiss && grouped
            ? grouped.map((g, gi) => (
                <Fragment key={g.label}>
                  {g.teams.map((s) => (
                    <TableRow
                      key={s.team_id}
                      className={
                        (g.label === "2-0" || g.label === "3-0")
                          ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                          : (g.label === "1-2" || g.label === "0-2" || g.label === "0-3")
                            ? "bg-red-50/50 dark:bg-red-950/20"
                            : ""
                      }
                    >
                      <TableCell className="text-muted-foreground text-xs">
                        {s.rank}
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/teams/$teamId"
                          params={{ teamId: s.team_id }}
                          className="font-medium hover:underline"
                        >
                          {s.team_abbreviation ? (
                            <span title={s.team_name}>{s.team_abbreviation}</span>
                          ) : (
                            s.team_name
                          )}
                        </Link>
                        {s.team_abbreviation && (
                          <span className="text-xs text-muted-foreground ml-1.5 hidden sm:inline">
                            {s.team_name}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {s.record}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {s.points}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {mapDiff(s.map_wins, s.map_losses)}
                      </TableCell>
                      {isSwiss && (
                        <TableCell className="text-center text-muted-foreground text-sm">
                          {s.buchholz?.toFixed(1) ?? "-"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {gi < grouped.length - 1 && (
                    <TableRow key={`sep-${gi}`} className="h-0">
                      <TableCell colSpan={isSwiss ? 7 : 6} className="p-0 border-t-2 border-border" />
                    </TableRow>
                  )}
                </Fragment>
              ))
            : !isSwiss
              ? overview.standings.map((s) => (
                  <TableRow key={s.team_id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {s.rank}
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/teams/$teamId"
                        params={{ teamId: s.team_id }}
                        className="font-medium hover:underline"
                      >
                        {s.team_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {s.record}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {s.points}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {mapDiff(s.map_wins, s.map_losses)}
                    </TableCell>
                  </TableRow>
                ))
              : null}
        </TableBody>
      </Table>

      {/* Legend for Swiss */}
      {isSwiss && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-emerald-100 dark:bg-emerald-900" />
            胜场组
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-red-100 dark:bg-red-900" />
            负场组
          </span>
        </div>
      )}
    </div>
  );
}
