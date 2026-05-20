import { useState, useMemo, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import type { StageRoundMatches, StageStandingsRow } from "@/types";
import {
  buildBracketLayout,
  buildEliminationLayout,
  CARD_WIDTH,
  CARD_HEIGHT,
  GROUP_PAD_X,
  GROUP_PAD_Y,
  type MatchPosition,
  type GroupBox,
} from "@/lib/swiss-bracket";

interface SwissBracketProps {
  rounds: StageRoundMatches[];
  standings: StageStandingsRow[];
  format?: string;
  advanceLabel?: string;
  eliminateLabel?: string;
  minWinsForAdvance?: number;
}

// ---------- Colors ----------

const WINNER_GREEN = "#22c55e";
const LOSER_RED = "#ef4444";
const LIVE_YELLOW = "#eab308";
const MUTED_GRAY = "#6b7280";

// ---------- Helpers ----------

function getCardBorder(mp: MatchPosition): { borderColor: string; boxShadow: string; animation?: string } {
  const m = mp.match;
  if (m.status === "live") {
    return {
      borderColor: LIVE_YELLOW,
      boxShadow: "0 0 8px 2px rgba(234, 179, 8, 0.4)",
      animation: "bracket-pulse 2s ease-in-out infinite",
    };
  }
  if (m.status === "finished" && mp.winnerId) {
    const winnerRecord = mp.winnerId === m.team_a.id ? mp.teamARecord : mp.teamBRecord;
    if (winnerRecord) {
      const [w, l] = winnerRecord.split(/[:/-]/).map(Number);
      if (w > l) return { borderColor: WINNER_GREEN, boxShadow: "0 0 10px 2px rgba(34, 197, 94, 0.3)" };
      if (l > w) return { borderColor: LOSER_RED, boxShadow: "0 0 10px 2px rgba(239, 68, 68, 0.3)" };
    }
  }
  return { borderColor: "var(--border)", boxShadow: "none" };
}

function getScoreLabel(mp: MatchPosition): { text: string; bg: string } {
  const m = mp.match;
  if (m.status === "live") return { text: "LIVE", bg: LIVE_YELLOW };
  if (m.status === "pending" || m.status === "scheduled") return { text: "VS", bg: MUTED_GRAY };
  if (m.score_a != null && m.score_b != null) {
    const bg = mp.winnerId === m.team_a.id ? WINNER_GREEN
      : mp.winnerId === m.team_b.id ? LOSER_RED : MUTED_GRAY;
    return { text: `${m.score_a}:${m.score_b}`, bg };
  }
  return { text: "VS", bg: MUTED_GRAY };
}

// ---------- Team Circle ----------

function TeamCircle({
  name, abbreviation, logoUrl, isWinner, size,
}: {
  name: string; abbreviation?: string; logoUrl?: string; isWinner: boolean; size: number;
}) {
  const initials = (abbreviation ?? name.slice(0, 2)).toUpperCase();
  if (logoUrl) {
    return (
      <img src={logoUrl} alt={name} title={name}
        className="rounded-full object-cover flex-shrink-0"
        style={{
          width: size, height: size,
          boxShadow: isWinner ? "0 0 8px rgba(34, 197, 94, 0.5)" : undefined,
          border: isWinner ? `2px solid ${WINNER_GREEN}` : "2px solid var(--border)",
        }} />
    );
  }
  return (
    <div title={name}
      className="flex items-center justify-center rounded-full font-bold text-white text-sm flex-shrink-0"
      style={{
        width: size, height: size,
        backgroundColor: isWinner ? WINNER_GREEN : "var(--muted)",
        boxShadow: isWinner ? "0 0 8px rgba(34, 197, 94, 0.5)" : undefined,
      }}>{initials}</div>
  );
}

// ---------- Match Card ----------

function BracketMatchCard({
  mp, onMouseEnter, onMouseMove, onMouseLeave,
}: {
  mp: MatchPosition;
  onMouseEnter: (e: React.MouseEvent, mp: MatchPosition) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}) {
  const m = mp.match;
  const { borderColor, boxShadow, animation } = getCardBorder(mp);
  const scoreLabel = getScoreLabel(mp);

  return (
    <Link to="/matches/$matchId" params={{ matchId: m.match_id }}
      className="absolute flex flex-col items-center justify-center rounded-lg bg-card border-2 transition-transform hover:scale-105 hover:z-10"
      style={{
        left: mp.x, top: mp.y, width: CARD_WIDTH, height: CARD_HEIGHT,
        borderColor, boxShadow, animation,
      }}
      onMouseEnter={(e) => onMouseEnter(e, mp)}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute flex items-center px-2 h-5 rounded-md text-xs font-bold text-white z-10"
        style={{ top: -10, left: 12, backgroundColor: scoreLabel.bg }}>
        {scoreLabel.text}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <TeamCircle name={m.team_a.name} abbreviation={m.team_a.abbreviation}
          logoUrl={m.team_a.logo_url} isWinner={mp.winnerId === m.team_a.id} size={34} />
        <span className="text-xs font-semibold text-muted-foreground">VS</span>
        <TeamCircle name={m.team_b.name} abbreviation={m.team_b.abbreviation}
          logoUrl={m.team_b.logo_url} isWinner={mp.winnerId === m.team_b.id} size={34} />
      </div>
    </Link>
  );
}

// ---------- Tooltip ----------

function BracketTooltip({ tooltip }: {
  tooltip: { visible: boolean; mp: MatchPosition | null; x: number; y: number };
}) {
  if (!tooltip.visible || !tooltip.mp) return null;
  const m = tooltip.mp.match;
  return (
    <div className="fixed z-50 bg-popover border border-border rounded-lg p-3 text-sm shadow-lg pointer-events-none"
      style={{ left: tooltip.x + 15, top: tooltip.y + 15, maxWidth: 250 }}>
      <div className="font-semibold text-foreground mb-1">
        {tooltip.mp.label} · {tooltip.mp.bracketRecord} 组
      </div>
      <div className="text-muted-foreground space-y-0.5">
        <div className="flex justify-between gap-4">
          <span className="font-medium text-foreground">{m.team_a.name}</span>
          <span className="font-mono">{m.score_a != null ? m.score_a : "-"}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="font-medium text-foreground">{m.team_b.name}</span>
          <span className="font-mono">{m.score_b != null ? m.score_b : "-"}</span>
        </div>
        <div className="text-xs pt-1 flex gap-2">
          {m.format && <span>{m.format.toUpperCase()}</span>}
          {m.scheduled_at && <span>{m.scheduled_at}</span>}
        </div>
      </div>
    </div>
  );
}


// ---------- Group Box (frame around record group) ----------

function GroupBoxFrame({ box }: { box: GroupBox }) {
  let borderColor = "var(--border)";
  let bg = "transparent";
  if (box.isAdvanced) {
    borderColor = "rgba(34, 197, 94, 0.5)";
    bg = "rgba(34, 197, 94, 0.06)";
  } else if (box.isEliminated) {
    borderColor = "rgba(239, 68, 68, 0.5)";
    bg = "rgba(239, 68, 68, 0.06)";
  }

  return (
    <div
      className="absolute rounded-lg border border-dashed pointer-events-none"
      style={{
        left: box.x, top: box.y, width: box.width, height: box.height,
        borderColor, background: bg,
      }}
    >
      {/* Group label at top-left inside the box */}
      <span
        className="absolute text-xs font-semibold px-1.5 py-0.5 rounded"
        style={{
          top: -1, left: 12,
          transform: "translateY(-50%)",
          background: "var(--card)",
          color: box.isAdvanced ? WINNER_GREEN : box.isEliminated ? LOSER_RED : "var(--muted-foreground)",
        }}
      >
        {box.bracketRecord}
        {box.isAdvanced ? (box.advanceLabel ? ` ${box.advanceLabel}` : " 晋级") : box.isEliminated ? (box.eliminateLabel ? ` ${box.eliminateLabel}` : " 淘汰") : ""}
      </span>
    </div>
  );
}

// ---------- Results Column Teams ----------

function ResultsTeamRow({ team }: {
  team: { teamId: string; name: string; abbr: string; logoUrl?: string };
}) {
  return (
    <Link to="/teams/$teamId" params={{ teamId: team.teamId }}
      className="flex items-center gap-2 hover:opacity-80 transition-opacity">
      <TeamCircle name={team.name} abbreviation={team.abbr} logoUrl={team.logoUrl} isWinner={false} size={32} />
      <span className="text-xs text-foreground truncate">{team.name}</span>
    </Link>
  );
}

// ---------- Main Component ----------

export function SwissBracket({ rounds, standings, format, advanceLabel, eliminateLabel, minWinsForAdvance }: SwissBracketProps) {
  const [tooltip, setTooltip] = useState<{
    visible: boolean; mp: MatchPosition | null; x: number; y: number;
  }>({ visible: false, mp: null, x: 0, y: 0 });

  const layout = useMemo(() => {
    if (format === "single_elim") {
      return buildEliminationLayout(rounds);
    }
    const opts = (advanceLabel || eliminateLabel || minWinsForAdvance != null)
      ? { advanceLabel, eliminateLabel, minWinsForAdvance } as any
      : undefined;
    return buildBracketLayout(rounds, standings, opts);
  }, [rounds, standings, format, advanceLabel, eliminateLabel]);

  const handleMouseEnter = useCallback((e: React.MouseEvent, mp: MatchPosition) => {
    setTooltip({ visible: true, mp, x: e.clientX, y: e.clientY });
  }, []);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip((prev) => ({ ...prev, x: e.clientX, y: e.clientY }));
  }, []);
  const handleMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  if (!layout) {
    return <p className="text-sm text-muted-foreground">暂无比赛数据</p>;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{format === "single_elim" ? "淘汰赛对阵" : "瑞士轮对阵"}</h2>

      <div className="overflow-x-auto">
        <div className="relative" style={{
          width: layout.totalWidth,
          height: layout.totalHeight,
          minHeight: layout.totalHeight,
        }}>
          {/* Column headers */}
          {layout.columns.map((col) => (
            <div key={col.header}
              className="absolute text-sm font-semibold text-foreground"
              style={{ left: col.x + GROUP_PAD_X, top: 20 }}>
              {col.header}
            </div>
          ))}

          {/* Group boxes + match cards */}
          {layout.columns.map((col) =>
            col.groups.map((group) => {
              const isResults = group.matches.length === 0;
              return (
                <div key={`${col.header}-${group.box.bracketRecord}`}>
                  <GroupBoxFrame box={group.box} />
                  {group.matches.map((mp) => (
                    <BracketMatchCard key={mp.match.match_id} mp={mp}
                      onMouseEnter={handleMouseEnter}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave} />
                  ))}
                  {isResults && (group as any).teams && (
                    <div className="absolute flex flex-col gap-1.5"
                      style={{
                        left: group.box.x + GROUP_PAD_X + 6,
                        top: group.box.y + GROUP_PAD_Y + 2,
                        width: group.box.width - GROUP_PAD_X * 2 - 12,
                      }}>
                      {(group as any).teams.map((t: any) => (
                        <ResultsTeamRow key={t.teamId} team={t} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <BracketTooltip tooltip={tooltip} />
    </div>
  );
}
