import type { StageRoundMatches, StageStandingsRow, StageMatchCard } from "@/types";

// ---------- Layout Constants ----------

export const CARD_WIDTH = 160;
export const CARD_HEIGHT = 64;
export const ROUND_GAP = 8;
export const ROUND_STEP = CARD_WIDTH + ROUND_GAP; // 168
export const MATCH_GAP_Y = 4;
export const GROUP_GAP_Y = 16;
export const GROUP_PAD_X = 8;
export const GROUP_PAD_Y = 14;
export const PADDING_LEFT = 12;
export const PADDING_TOP = 44;
export const PADDING_BOTTOM = 24;

// ---------- Types ----------

export interface MatchPosition {
  match: StageMatchCard;
  round: number;
  label: string;
  x: number;
  y: number;
  winnerId: string | null;
  loserId: string | null;
  bracketRecord: string;
  teamARecord: string;
  teamBRecord: string;
}

export interface GroupBox {
  bracketRecord: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isAdvanced?: boolean;
  isEliminated?: boolean;
  advanceLabel?: string;
  eliminateLabel?: string;
}

export interface ColumnLayout {
  x: number;
  header: string;
  groups: {
    box: GroupBox;
    matches: MatchPosition[];
    /** For results column: teams displayed directly (not as match cards) */
    teams?: { teamId: string; name: string; abbr: string; logoUrl?: string }[];
  }[];
}

export interface BracketLayout {
  matchPositions: Map<string, MatchPosition>;
  columns: ColumnLayout[];
  totalWidth: number;
  totalHeight: number;
}

// ---------- Helpers ----------

function determineWinner(m: StageMatchCard): string | null {
  if (m.status !== "finished" || m.score_a == null || m.score_b == null) return null;
  if (m.score_a > m.score_b) return m.team_a.id;
  if (m.score_b > m.score_a) return m.team_b.id;
  return null;
}

function bracketSortKey(rec: string): number {
  // Handles both "W:L" (bracket records) and "W-L" (standings records)
  const parts = rec.split(/[:/-]/);
  const w = parseInt(parts[0], 10) || 0;
  const l = parseInt(parts[1], 10) || 0;
  // Sort by wins descending, then by losses ascending (fewer losses first)
  // Lower key = better record: 3:0 < 3:1 < 3:2 < 2:3 < 1:3 < 0:3
  return l - w * 100;
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - i + 1)) / i;
  return r;
}

/** Compute the expected Swiss bracket skeleton: round → record groups → match count */
function swissSkeleton(numTeams: number): { record: string; matches: number }[][] {
  const numRounds = Math.ceil(Math.log2(numTeams));
  const skeleton: { record: string; matches: number }[][] = [];

  for (let r = 1; r <= numRounds; r++) {
    const groups: { record: string; matches: number }[] = [];
    const gamesPlayed = r - 1; // games played before this round

    for (let w = 0; w <= gamesPlayed; w++) {
      const l = gamesPlayed - w;
      const teams = (binomial(gamesPlayed, w) * numTeams) / Math.pow(2, gamesPlayed);
      const matchCount = Math.floor(teams / 2);
      if (matchCount > 0) {
        groups.push({ record: `${w}:${l}`, matches: matchCount });
      }
    }

    skeleton.push(groups);
  }

  return skeleton;
}

/** Create a placeholder match card for unknown opponents in the Swiss bracket */
function placeholderCard(round: number, record: string, idx: number): StageMatchCard {
  const placeholderId = `placeholder-r${round}-${record.replace(":", "-")}-${idx}`;
  return {
    match_id: placeholderId,
    team_a: { id: "", name: "", abbreviation: "", university: "", logo_url: undefined },
    team_b: { id: "", name: "", abbreviation: "", university: "", logo_url: undefined },
    score_a: undefined,
    score_b: undefined,
    status: "scheduled",
    scheduled_at: undefined,
    format: undefined,
    group_name: undefined,
    bracket_record: record,
    bracket_record_b: record,
  };
}

// ---------- Layout Computation ----------

function computeRoundColumns(
  rounds: StageRoundMatches[],
): Map<string, MatchPosition> {
  const positions = new Map<string, MatchPosition>();

  for (const rd of rounds) {
    const x = 0; // filled later by column index
    for (const m of rd.matches) {
      const winnerId = determineWinner(m);
      const loserId =
        winnerId === m.team_a.id
          ? m.team_b.id
          : winnerId === m.team_b.id
            ? m.team_a.id
            : null;

      const mp: MatchPosition = {
        match: m,
        round: rd.round,
        label: rd.label,
        x,
        y: 0,
        winnerId,
        loserId,
        bracketRecord: m.bracket_record,
        teamARecord: m.bracket_record,
        teamBRecord: m.bracket_record_b,
      };

      positions.set(m.match_id, mp);
    }
  }

  return positions;
}

// ---------- Final Results Column ----------

function computeResultsColumn(
  standings: StageStandingsRow[],
  columnX: number,
  opts?: { advanceLabel?: string; eliminateLabel?: string; minWinsForAdvance?: number },
): ColumnLayout | null {
  // Show all teams grouped by final record
  const recordGroups = new Map<
    string,
    { teamId: string; name: string; abbr: string; logoUrl?: string }[]
  >();

  for (const s of standings) {
    if (!recordGroups.has(s.record)) recordGroups.set(s.record, []);
    recordGroups.get(s.record)!.push({
      teamId: s.team_id,
      name: s.team_name,
      abbr: s.team_abbreviation ?? s.team_name.slice(0, 2).toUpperCase(),
      logoUrl: s.logo_url,
    });
  }

  if (recordGroups.size === 0) return null;

  // Best record first (most wins)
  const sorted = [...recordGroups.entries()].sort(
    (a, b) => bracketSortKey(a[0]) - bracketSortKey(b[0]),
  );

  // Determine qualification threshold
  // minWinsForAdvance: explicit win threshold (used for national qualifier)
  // Otherwise: top 50% advance in Swiss
  const totalTeams = standings.length;
  const advanceCutoff = opts?.minWinsForAdvance != null
    ? opts.minWinsForAdvance
    : Math.ceil(totalTeams / 2);
  const useWinsThreshold = opts?.minWinsForAdvance != null;
  let teamsAdvanced = 0;

  const BOX_W = CARD_WIDTH + GROUP_PAD_X * 2;
  const ITEM_H = 36;
  const ITEM_GAP = 4;

  let totalH = 0;
  for (let i = 0; i < sorted.length; i++) {
    const [, teams] = sorted[i];
    teamsAdvanced += teams.length;
    totalH += GROUP_PAD_Y * 2 + teams.length * ITEM_H + Math.max(0, teams.length - 1) * ITEM_GAP;
    if (i < sorted.length - 1) totalH += GROUP_GAP_Y;
  }

  let cursorY = PADDING_TOP;
  teamsAdvanced = 0;
  const groups: ColumnLayout["groups"] = [];

  for (const [record, teams] of sorted) {
    teamsAdvanced += teams.length;
    const groupH = GROUP_PAD_Y * 2 + teams.length * ITEM_H + Math.max(0, teams.length - 1) * ITEM_GAP;
    const wins = parseInt(record.split(/[:/-]/)[0], 10) || 0;
    const isAdvanced = useWinsThreshold
      ? wins >= advanceCutoff
      : teamsAdvanced <= advanceCutoff;

    groups.push({
      box: {
        bracketRecord: record,
        x: columnX,
        y: cursorY,
        width: BOX_W,
        height: groupH,
        isAdvanced,
        isEliminated: !isAdvanced,
        advanceLabel: opts?.advanceLabel,
        eliminateLabel: opts?.eliminateLabel,
      },
      matches: [],
      teams,
    });

    cursorY = cursorY + groupH + GROUP_GAP_Y;
  }

  return {
    x: columnX,
    header: "最终结果",
    groups,
  };
}

// ---------- Build Column Layouts ----------

function buildColumns(
  rounds: StageRoundMatches[],
  positions: Map<string, MatchPosition>,
): ColumnLayout[] {
  const columns: ColumnLayout[] = [];

  for (let di = 0; di < rounds.length; di++) {
    const rd = rounds[di];
    const colX = PADDING_LEFT + di * ROUND_STEP;

    // Group matches by bracket_record
    const bracketMap = new Map<string, MatchPosition[]>();
    for (const m of rd.matches) {
      const mp = positions.get(m.match_id)!;
      mp.x = colX + GROUP_PAD_X;
      if (!bracketMap.has(mp.bracketRecord)) bracketMap.set(mp.bracketRecord, []);
      bracketMap.get(mp.bracketRecord)!.push(mp);
    }

    const sortedBrackets = [...bracketMap.entries()].sort(
      (a, b) => bracketSortKey(a[0]) - bracketSortKey(b[0]),
    );

    // Compute group heights
    let totalH = 0;
    const groupHeights: number[] = [];
    for (const [, mps] of sortedBrackets) {
      const gh = GROUP_PAD_Y * 2 + mps.length * CARD_HEIGHT + (mps.length - 1) * MATCH_GAP_Y;
      groupHeights.push(gh);
      totalH += gh;
    }
    totalH += (sortedBrackets.length - 1) * GROUP_GAP_Y;

    // Determine max height across all columns for centering
    // Run a first pass to get maxContentHeight
    // We'll do centering after all columns are built
    let cursorY = PADDING_TOP; // temp, adjusted later
    const groups: ColumnLayout["groups"] = [];

    for (let gi = 0; gi < sortedBrackets.length; gi++) {
      const [bracketRecord, mps] = sortedBrackets[gi];
      const groupH = groupHeights[gi];
      const boxX = colX;
      const boxY = cursorY;
      const boxW = CARD_WIDTH + GROUP_PAD_X * 2;

      const firstMatchY = cursorY + GROUP_PAD_Y;
      for (let i = 0; i < mps.length; i++) {
        mps[i].y = firstMatchY + i * (CARD_HEIGHT + MATCH_GAP_Y);
      }

      groups.push({
        box: { bracketRecord, x: boxX, y: boxY, width: boxW, height: groupH },
        matches: mps,
      });

      cursorY = boxY + groupH + GROUP_GAP_Y;
    }

    columns.push({ x: colX, header: rd.label, groups });
  }

  return columns;
}

// ---------- Center all columns (bracket + results) ----------

function centerAllColumns(columns: ColumnLayout[]): void {
  if (columns.length === 0) return;

  // Find max content height (bottom of last group minus top of first group)
  let maxHeight = 0;
  for (const col of columns) {
    if (col.groups.length === 0) continue;
    const first = col.groups[0].box.y;
    const last = col.groups[col.groups.length - 1];
    const colH = last.box.y + last.box.height - first;
    if (colH > maxHeight) maxHeight = colH;
  }

  // Center each column within max height
  for (const col of columns) {
    if (col.groups.length === 0) continue;
    const first = col.groups[0].box.y;
    const last = col.groups[col.groups.length - 1];
    const colH = last.box.y + last.box.height - first;
    const offset = (maxHeight - colH) / 2;

    for (const g of col.groups) {
      g.box.y += offset;
      for (const mp of g.matches) {
        mp.y += offset;
      }
    }
  }
}

// ---------- Main Builder ----------

export function buildBracketLayout(
  rounds: StageRoundMatches[],
  standings: StageStandingsRow[],
  opts?: { advanceLabel?: string; eliminateLabel?: string; minWinsForAdvance?: number },
): BracketLayout | null {
  if (!rounds || rounds.length === 0) return null;

  const sorted = [...rounds].sort((a, b) => a.round - b.round);

  // ── Swiss skeleton expansion ──────────────────────────────────────
  // When only early rounds have data, generate placeholder structure for
  // the remaining Swiss rounds so the full bracket shape is visible.
  const numTeams =
    standings.length > 0
      ? standings.length
      : sorted[0].matches.reduce((acc, m) => acc + (m.bracket_record === "0:0" ? 2 : 0), 0);

  if (numTeams >= 8 && (standings.length > 0 || sorted[0].label.includes("Swiss"))) {
    const skeleton = swissSkeleton(numTeams);
    const actualRounds = new Set(sorted.map((r) => r.round));

    for (let ri = 0; ri < skeleton.length; ri++) {
      const roundNum = ri + 1;
      if (actualRounds.has(roundNum)) continue;

      const groups = skeleton[ri];
      const placeholderMatches: StageMatchCard[] = [];
      for (const g of groups) {
        for (let j = 0; j < g.matches; j++) {
          placeholderMatches.push(placeholderCard(roundNum, g.record, j));
        }
      }

      if (placeholderMatches.length > 0) {
        sorted.push({
          round: roundNum,
          label: `Swiss Round ${roundNum}`,
          matches: placeholderMatches,
        });
      }
    }

    sorted.sort((a, b) => a.round - b.round);
  }

  const matchPositions = computeRoundColumns(sorted);
  const columns = buildColumns(sorted, matchPositions);

  // Add final results column
  const lastColX = columns.length > 0
    ? columns[columns.length - 1].x + ROUND_STEP
    : PADDING_LEFT + 5 * ROUND_STEP;
  const resultsColumn = computeResultsColumn(standings, lastColX, opts);
  const allColumns = resultsColumn ? [...columns, resultsColumn] : columns;

  // Center all columns (bracket + results) vertically
  centerAllColumns(allColumns);

  // Calculate total dimensions
  let totalHeight = 0;
  for (const col of allColumns) {
    if (col.groups.length === 0) continue;
    const last = col.groups[col.groups.length - 1];
    const bottom = last.box.y + last.box.height;
    if (bottom > totalHeight) totalHeight = bottom;
  }
  totalHeight += PADDING_BOTTOM;

  const lastCol = allColumns[allColumns.length - 1];
  const totalWidth = lastCol.x + CARD_WIDTH + GROUP_PAD_X * 2 + PADDING_LEFT;

  return {
    matchPositions,
    columns: allColumns,
    totalWidth,
    totalHeight,
  };
}

// ---------- Single Elimination Bracket ----------

export interface TeamNode {
  teamId: string;
  name: string;
  abbr: string;
  logoUrl?: string;
  status: "advanced" | "eliminated" | "champion" | "third";
  label?: string; // e.g. "晋级全国总决赛", "晋级全国赛", "晋级复活赛"
}

interface ElimLayout {
  matchPositions: Map<string, MatchPosition>;
  columns: ColumnLayout[];
  totalWidth: number;
  totalHeight: number;
}

export function buildEliminationLayout(
  rounds: StageRoundMatches[],
): ElimLayout | null {
  if (!rounds || rounds.length === 0) return null;

  const sorted = [...rounds].sort((a, b) => a.round - b.round);
  const matchPositions = new Map<string, MatchPosition>();

  // Track advancing teams
  const advancingTeams = new Map<string, TeamNode>();
  const eliminatedTeams = new Map<string, TeamNode>();

  // Compute positions: each round is one column
  for (let di = 0; di < sorted.length; di++) {
    const rd = sorted[di];
    const colX = PADDING_LEFT + di * ROUND_STEP;

    let cursorY = PADDING_TOP;

    for (let i = 0; i < rd.matches.length; i++) {
      const m = rd.matches[i];
      const winnerId = (m.status === "finished" && m.score_a != null && m.score_b != null)
        ? (m.score_a > m.score_b ? m.team_a.id : m.score_b > m.score_a ? m.team_b.id : null)
        : null;
      const loserId = winnerId
        ? (winnerId === m.team_a.id ? m.team_b.id : m.team_a.id)
        : null;

      const mp: MatchPosition = {
        match: m,
        round: rd.round,
        label: rd.label,
        x: colX + GROUP_PAD_X,
        y: cursorY + GROUP_PAD_Y + i * (CARD_HEIGHT + MATCH_GAP_Y),
        winnerId,
        loserId,
        bracketRecord: rd.label,
        teamARecord: "",
        teamBRecord: "",
      };
      matchPositions.set(m.match_id, mp);

      // Track advancing/eliminated
      if (winnerId) {
        // Only track if they advance to next round (not finals losses)
        const isFinalRound = di === sorted.length - 1;
        if (!isFinalRound) {
          advancingTeams.set(winnerId, {
            teamId: winnerId,
            name: winnerId === m.team_a.id ? m.team_a.name : m.team_b.name,
            abbr: (winnerId === m.team_a.id ? m.team_a.abbreviation : m.team_b.abbreviation) ?? "",
            logoUrl: winnerId === m.team_a.id ? m.team_a.logo_url : m.team_b.logo_url,
            status: "advanced",
          });
        }
        if (loserId && !isFinalRound) {
          eliminatedTeams.set(loserId, {
            teamId: loserId,
            name: loserId === m.team_a.id ? m.team_a.name : m.team_b.name,
            abbr: (loserId === m.team_a.id ? m.team_a.abbreviation : m.team_b.abbreviation) ?? "",
            logoUrl: loserId === m.team_a.id ? m.team_a.logo_url : m.team_b.logo_url,
            status: "eliminated",
          });
        }
      }
    }

  }

  // Build columns
  const columns: ColumnLayout[] = [];
  for (let di = 0; di < sorted.length; di++) {
    const rd = sorted[di];
    const colX = PADDING_LEFT + di * ROUND_STEP;
    const matchCount = rd.matches.length;
    const colContentH =
      GROUP_PAD_Y * 2 + matchCount * CARD_HEIGHT + (matchCount - 1) * MATCH_GAP_Y;

    const mps: MatchPosition[] = [];
    for (const m of rd.matches) {
      const mp = matchPositions.get(m.match_id);
      if (mp) mps.push(mp);
    }

    columns.push({
      x: colX,
      header: rd.label,
      groups: [
        {
          box: {
            bracketRecord: rd.label,
            x: colX,
            y: PADDING_TOP,
            width: CARD_WIDTH + GROUP_PAD_X * 2,
            height: colContentH,
          },
          matches: mps,
        },
      ],
    });
  }

  // Add results column: show winners from round 1 (16→8) = 8强
  if (sorted.length > 0) {
    const r1Matches = sorted[0].matches;
    const winners: { teamId: string; name: string; abbr: string; logoUrl?: string }[] = [];
    for (const m of r1Matches) {
      if (m.status === "finished" && m.score_a != null && m.score_b != null) {
        const winner = m.score_a > m.score_b ? m.team_a : m.team_b;
        winners.push({
          teamId: winner.id,
          name: winner.name,
          abbr: winner.abbreviation ?? winner.name.slice(0, 2).toUpperCase(),
          logoUrl: winner.logo_url,
        });
      }
    }

    if (winners.length > 0) {
      const resultsX = columns.length > 0
        ? columns[columns.length - 1].x + ROUND_STEP
        : PADDING_LEFT;
      const ITEM_H = 36, ITEM_GAP = 4;
      const contentH = GROUP_PAD_Y * 2 + winners.length * ITEM_H + Math.max(0, winners.length - 1) * ITEM_GAP;

      columns.push({
        x: resultsX,
        header: "8强",
        groups: [
          {
            box: {
              bracketRecord: "8强",
              x: resultsX,
              y: PADDING_TOP,
              width: CARD_WIDTH + GROUP_PAD_X * 2,
              height: contentH,
            },
            matches: [],
            teams: winners,
          },
        ],
      });
    }
  }

  // Center all columns
  centerAllColumns(columns);

  // Calculate dimensions
  let totalHeight = 0;
  for (const col of columns) {
    if (col.groups.length === 0) continue;
    const last = col.groups[col.groups.length - 1];
    const bottom = last.box.y + last.box.height;
    if (bottom > totalHeight) totalHeight = bottom;
  }
  totalHeight += PADDING_BOTTOM;

  const lastCol = columns[columns.length - 1];
  const totalWidth = lastCol.x + CARD_WIDTH + GROUP_PAD_X * 2 + PADDING_LEFT;

  return {
    matchPositions,
    columns,
    totalWidth,
    totalHeight,
  };
}
