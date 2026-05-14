import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TeamLogo } from "@/components/shared/TeamLogo";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ROBOT_TYPE_LABELS } from "@/types";

export function TeamDetailPage() {
  const { teamId } = useParams({ from: "/teams/$teamId" });

  const team = useQuery({
    queryKey: ["team", teamId],
    queryFn: () => api.teams.get(teamId),
  });

  if (team.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!team.data) {
    return <p className="text-muted-foreground">战队未找到</p>;
  }

  const t = team.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <TeamLogo
          name={t.name}
          abbreviation={t.abbreviation}
          logoUrl={t.logo_url}
          size="lg"
        />
        <div>
          <PageHeader title={t.name} />
          {t.name_en && (
            <p className="text-muted-foreground">{t.name_en}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {t.university}
            {t.founded_year && ` · 成立于 ${t.founded_year}`}
          </p>
        </div>
      </div>

      {t.description && (
        <p className="text-sm text-muted-foreground">{t.description}</p>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">
          阵容 ({t.members.length})
        </h2>
        {t.members.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>职位</TableHead>
                <TableHead>机器人位置</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {t.members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.role}</TableCell>
                  <TableCell>
                    {member.robot_roles.length > 0
                      ? member.robot_roles
                          .map((r) => ROBOT_TYPE_LABELS[r.robot_type] ?? r.robot_type)
                          .join(" / ")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">暂无阵容数据</p>
        )}
      </div>
    </div>
  );
}
