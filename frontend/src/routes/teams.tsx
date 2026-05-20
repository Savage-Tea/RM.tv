import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { TeamLogo } from "@/components/shared/TeamLogo";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import type { Team } from "@/types";

function groupByUniversity(teams: Team[]): { university: string; teams: Team[] }[] {
  const map = new Map<string, Team[]>();
  for (const t of teams) {
    const list = map.get(t.university) || [];
    list.push(t);
    map.set(t.university, list);
  }
  return Array.from(map.entries()).map(([university, teams]) => ({ university, teams }));
}

export function TeamsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 24;

  const teams = useQuery({
    queryKey: ["teams", search, page],
    queryFn: () => api.teams.list({
      ...(search && { search }),
      page: String(page),
      per_page: String(PER_PAGE),
    }),
  });

  const totalPages = teams.data ? Math.ceil(teams.data.total / teams.data.per_page) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="参赛学校" description="按学校查看参赛战队" />

      <input
        type="text"
        placeholder="搜索学校或战队..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm rounded-md border px-3 py-2 text-sm"
      />

      {teams.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : teams.data?.data.length ? (
        <>
          <div className="space-y-6">
            {groupByUniversity(teams.data.data).map(({ university, teams: uniTeams }) => (
              <div key={university}>
                <h3 className="text-md font-semibold mb-3 pb-1.5 border-b">
                  {university}
                  {uniTeams.length > 1 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {uniTeams.length} 支战队
                    </span>
                  )}
                </h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {uniTeams.map((team: Team) => (
                    <Link
                      key={team.id}
                      to="/teams/$teamId"
                      params={{ teamId: team.id }}
                      className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary/50 transition-colors"
                    >
                      <TeamLogo
                        name={team.name}
                        abbreviation={team.abbreviation}
                        logoUrl={team.logo_url}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{team.name}</div>
                        {team.name_en && (
                          <div className="text-xs text-muted-foreground truncate">{team.name_en}</div>
                        )}
                        {team.abbreviation && (
                          <div className="text-xs text-muted-foreground">{team.abbreviation}</div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                上一页
              </button>
              <span className="text-sm py-1 text-muted-foreground">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-center py-12">暂无战队数据</p>
      )}
    </div>
  );
}
