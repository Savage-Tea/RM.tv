import { Link, Outlet } from "@tanstack/react-router";
import { Activity, Calendar, Users, BarChart3, Trophy } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "首页", icon: Activity },
  { to: "/events", label: "赛事", icon: Calendar },
  { to: "/matches", label: "比赛", icon: Activity },
  { to: "/teams", label: "战队", icon: Users },
  { to: "/stats", label: "数据", icon: BarChart3 },
  { to: "/rankings", label: "排名", icon: Trophy },
];

export function RootLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <Activity className="h-5 w-5" />
            RM.tv
          </Link>
          <nav className="flex items-center gap-1 ml-6">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors [&.active]:text-foreground [&.active]:bg-accent"
                activeOptions={{ exact: to === "/" }}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
