import { Link, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, Calendar, Swords, Users, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { to: "/admin", label: "仪表盘", icon: LayoutDashboard, exact: true },
  { to: "/admin/events", label: "赛事管理", icon: Calendar },
  { to: "/admin/matches", label: "比赛管理", icon: Swords },
  { to: "/admin/teams", label: "战队管理", icon: Users },
];

export function AdminLayout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-56 border-r min-h-screen p-4 flex flex-col">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg mb-6 px-2">
          RM.tv
          <span className="text-xs text-muted-foreground font-normal">管理后台</span>
        </Link>
        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors [&.active]:text-foreground [&.active]:bg-accent"
              activeOptions={{ exact }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <Link to="/" className="px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          返回前台
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-muted-foreground mt-1"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4 mr-2" />
          退出登录
        </Button>
      </aside>
      <main className="flex-1 px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
