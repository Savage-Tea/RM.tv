import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import type { Column } from "@/components/shared/DataTable";
import type { RobotRating } from "@/types";
import { ROBOT_TYPE_LABELS } from "@/types";

const SEASONS = ["2025", "2024", "2023", "2022", "2021", "2020", "2019"];
const ROBOT_TYPES = ["", "hero", "infantry", "sentinel", "engineer", "uav", "dart", "radar"];

export function StatsPage() {
  const [season, setSeason] = useState("2025");
  const [robotType, setRobotType] = useState("");

  const stats = useQuery({
    queryKey: ["stats", season, robotType],
    queryFn: () => api.stats.robots({
      season,
      ...(robotType && { robot_type: robotType }),
      per_page: "20",
    }),
  });

  const columns: Column<RobotRating>[] = [
    {
      header: "机器人类型",
      render: (row) => ROBOT_TYPE_LABELS[row.robot_type] ?? row.robot_type,
      className: "w-24",
    },
    {
      header: "Rating",
      render: (row) => (
        <span className="font-mono">{row.rating.toFixed(1)}</span>
      ),
      className: "w-24 text-right",
    },
    { header: "场次", accessor: "matches_played", className: "w-16 text-right" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="数据统计"
        description="机器人表现数据排行榜"
      />

      <div className="flex gap-3 flex-wrap">
        <select
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          {SEASONS.map((s) => (
            <option key={s} value={s}>{s} 赛季</option>
          ))}
        </select>

        <div className="flex gap-1">
          {ROBOT_TYPES.map((rt) => (
            <button
              key={rt}
              onClick={() => setRobotType(rt)}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                robotType === rt ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
              }`}
            >
              {rt === "" ? "全部" : ROBOT_TYPE_LABELS[rt] ?? rt}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={stats.data?.data ?? []}
        keyExtractor={(r) => r.id}
        isLoading={stats.isLoading}
        emptyMessage="暂无统计数据"
      />
    </div>
  );
}
