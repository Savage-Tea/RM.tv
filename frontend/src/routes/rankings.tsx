import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import type { Column } from "@/components/shared/DataTable";
import type { RankingEntry } from "@/types";

const SEASONS = ["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019"];

export function RankingsPage() {
  const [season, setSeason] = useState("2026");

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

      <div className="flex gap-2">
        {SEASONS.map((s) => (
          <button
            key={s}
            onClick={() => setSeason(s)}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              season === s ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
            }`}
          >
            {s}
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
