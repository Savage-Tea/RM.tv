import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "@tanstack/react-router";
import { Calendar, Trophy, Activity, ArrowRight } from "lucide-react";

export function HomePage() {
  const health = useQuery({ queryKey: ["health"], queryFn: () => api.health() });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">RM.tv</h1>
        <p className="text-muted-foreground mt-1">
          RoboMaster 赛事数据统计平台
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <QuickCard
          title="赛事"
          description="查看 RoboMaster 赛事赛程与结果"
          to="/events"
          icon={Calendar}
        />
        <QuickCard
          title="排名"
          description="战队 Elo 实力排名"
          to="/rankings"
          icon={Trophy}
        />
        <QuickCard
          title="数据"
          description="机器人表现数据与统计"
          to="/stats"
          icon={Activity}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        API 状态: {health.isLoading ? "连接中..." : health.data?.status === "ok" ? "正常" : "异常"}
      </p>
    </div>
  );
}

function QuickCard({ title, description, to, icon: Icon }: {
  title: string;
  description: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      className="group rounded-lg border p-5 hover:border-primary/50 transition-colors"
    >
      <Icon className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
        查看 <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}
