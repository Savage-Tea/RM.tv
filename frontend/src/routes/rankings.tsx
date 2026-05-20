import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import type { Column } from "@/components/shared/DataTable";
import type { RankingEntry } from "@/types";

const SEASONS = [
  { value: "blended", label: "综合" },
  { value: "2026", label: "2026" },
  { value: "2025", label: "2025" },
  { value: "2024", label: "2024" },
  { value: "2023", label: "2023" },
  { value: "2022", label: "2022" },
  { value: "2021", label: "2021" },
  { value: "2019", label: "2019" },
];

export function RankingsPage() {
  const [season, setSeason] = useState("blended");

  const rankings = useQuery({
    queryKey: ["rankings", season],
    queryFn: () => api.rankings.list({ season, per_page: "50" }),
  });

  const columns: Column<RankingEntry>[] = [
    { header: "排名", accessor: "rank", className: "w-16" },
    {
      header: "战队",
      render: (row) => (
        <Link
          to="/teams/$teamId"
          params={{ teamId: row.team_id }}
          className="font-medium hover:text-primary"
        >
          {row.team_name}
          {row.team_abbreviation && (
            <span className="text-muted-foreground ml-1">({row.team_abbreviation})</span>
          )}
        </Link>
      ),
    },
    {
      header: "Elo",
      render: (row) => (
        <span className="font-mono">{row.rating.toFixed(0)}</span>
      ),
      className: "w-24 text-right",
    },
    { header: "场次", accessor: "matches_played", className: "w-16 text-right" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="排名" description="战队 Elo 实力排名" />

      <div className="flex gap-2 flex-wrap">
        {SEASONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSeason(s.value)}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              season === s.value ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={rankings.data?.data ?? []}
        keyExtractor={(r) => r.team_id}
        isLoading={rankings.isLoading}
        emptyMessage="暂无排名数据"
      />
    </div>
  );
}
