import { Link } from "@tanstack/react-router";
import type { StageRoundMatches } from "@/types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ScoreDisplay } from "@/components/shared/ScoreDisplay";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function StageMatches({ rounds }: { rounds: StageRoundMatches[] }) {
  if (rounds.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无比赛数据</p>;
  }

  // Use the last round as default (most recent)
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
            <div className="grid gap-2 md:grid-cols-2">
              {r.matches.map((m) => (
                <Link
                  key={m.match_id}
                  to="/matches/$matchId"
                  params={{ matchId: m.match_id }}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 text-right">
                    <span className="font-medium text-sm">
                      {m.team_a.abbreviation || m.team_a.name}
                    </span>
                  </div>
                  <div className="px-3 flex flex-col items-center gap-1">
                    {m.status === "finished" && m.score_a != null && m.score_b != null ? (
                      <ScoreDisplay scoreA={m.score_a} scoreB={m.score_b} size="sm" />
                    ) : (
                      <span className="text-sm font-mono text-muted-foreground">
                        vs
                      </span>
                    )}
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-sm">
                      {m.team_b.abbreviation || m.team_b.name}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
