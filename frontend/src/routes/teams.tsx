import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { TeamLogo } from "@/components/shared/TeamLogo";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import type { Team } from "@/types";

export function TeamsPage() {
  const [search, setSearch] = useState("");

  const teams = useQuery({
    queryKey: ["teams", search],
    queryFn: () => api.teams.list({ ...(search && { search }), per_page: "50" }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="战队" description="参赛战队信息" />

      <input
        type="text"
        placeholder="搜索战队..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-md border px-3 py-2 text-sm"
      />

      {teams.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : teams.data?.data.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.data.data.map((team: Team) => (
            <Link
              key={team.id}
              to="/teams/$teamId"
              params={{ teamId: team.id }}
              className="flex items-center gap-4 rounded-lg border p-4 hover:border-primary/50 transition-colors"
            >
              <TeamLogo
                name={team.name}
                abbreviation={team.abbreviation}
                logoUrl={team.logo_url}
                size="md"
              />
              <div>
                <div className="font-semibold">{team.name}</div>
                {team.name_en && (
                  <div className="text-xs text-muted-foreground">{team.name_en}</div>
                )}
                <div className="text-sm text-muted-foreground">{team.university}</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-12">暂无战队数据</p>
      )}
    </div>
  );
}
