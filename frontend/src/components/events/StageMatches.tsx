import { Link } from "@tanstack/react-router";
import type { StageRoundMatches, StageStandingsRow } from "@/types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function getRecordClass(record: string): string {
  const wins = parseInt(record.split("-")[0], 10);
  const losses = parseInt(record.split("-")[1] ?? "0", 10);
  if (wins > losses) return "border-emerald-500/60 bg-emerald-50/30 dark:bg-emerald-950/10";
  if (losses > wins) return "border-red-500/60 bg-red-50/30 dark:bg-red-950/10";
  return "";
}

function teamRecord(teamId: string, standings?: StageStandingsRow[]): string | null {
  if (!standings) return null;
  const s = standings.find((r) => r.team_id === teamId);
  return s?.record ?? null;
}

function MatchBox({
  m,
  standings,
}: {
  m: StageRoundMatches["matches"][0];
  standings?: StageStandingsRow[];
}) {
  const finished = m.status === "finished";
  const recA = teamRecord(m.team_a.id, standings);
  const recB = teamRecord(m.team_b.id, standings);
  const recordClass = recA ? getRecordClass(recA) : "";

  return (
    <Link
      key={m.match_id}
      to="/matches/$matchId"
      params={{ matchId: m.match_id }}
      className={`flex flex-col rounded-lg border-2 hover:border-primary/60 transition-colors overflow-hidden ${recordClass}`}
    >
      {/* Team A row */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="min-w-0">
          <span
            className={`font-medium text-sm truncate block ${
              finished && m.score_a != null && m.score_b != null && m.score_a > m.score_b
                ? "text-primary"
                : ""
            }`}
          >
            {m.team_a.abbreviation || m.team_a.name}
            {recA && (
              <span className="ml-1 text-xs text-muted-foreground font-mono">
                ({recA})
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground block truncate">
            {m.team_a.university}
          </span>
        </div>
        {finished && m.score_a != null ? (
          <span className="font-mono font-bold text-lg tabular-nums">{m.score_a}</span>
        ) : null}
      </div>

      {/* VS / Arrow / Status connector */}
      <div className="flex items-center justify-center py-1.5 px-3 border-y bg-muted/20 gap-2">
        {finished && m.score_a != null && m.score_b != null ? (
          <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
          </svg>
        ) : (
          <span className="text-xs font-mono text-muted-foreground font-bold">VS</span>
        )}
        <StatusBadge status={m.status} />
      </div>

      {/* Team B row */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="min-w-0">
          <span
            className={`font-medium text-sm truncate block ${
              finished && m.score_a != null && m.score_b != null && m.score_b > m.score_a
                ? "text-primary"
                : ""
            }`}
          >
            {m.team_b.abbreviation || m.team_b.name}
            {recB && (
              <span className="ml-1 text-xs text-muted-foreground font-mono">
                ({recB})
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground block truncate">
            {m.team_b.university}
          </span>
        </div>
        {finished && m.score_b != null ? (
          <span className="font-mono font-bold text-lg tabular-nums">{m.score_b}</span>
        ) : null}
      </div>

      {/* Footer: format + time */}
      <div className="flex items-center justify-center gap-2 px-3 py-1 text-xs text-muted-foreground">
        {m.format && <span>{m.format.toUpperCase()}</span>}
        {m.scheduled_at && (
          <span>{m.format ? "·" : ""} {m.scheduled_at}</span>
        )}
      </div>
    </Link>
  );
}

export function StageMatches({
  rounds,
  standings,
}: {
  rounds: StageRoundMatches[];
  standings?: StageStandingsRow[];
}) {
  if (rounds.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无比赛数据</p>;
  }

  const defaultRound = rounds[rounds.length - 1].label;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">比赛对阵</h2>

      <Tabs defaultValue={defaultRound}>
        <TabsList className="w-full flex-wrap h-auto gap-1">
          {rounds.map((r) => (
            <TabsTrigger key={r.label} value={r.label} className="text-xs">
              {r.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {rounds.map((r) => (
          <TabsContent key={r.label} value={r.label} className="mt-3">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {r.matches.map((m) => (
                <MatchBox key={m.match_id} m={m} standings={standings} />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
