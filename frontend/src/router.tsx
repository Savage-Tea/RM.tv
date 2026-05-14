import { createRouter, createRoute, createRootRoute } from "@tanstack/react-router";
import { RootLayout } from "@/components/layout/RootLayout";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { HomePage } from "@/routes/index";
import { EventsPage } from "@/routes/events";
import { EventDetailPage } from "@/routes/event.$eventId";
import { MatchesPage } from "@/routes/matches";
import { MatchDetailPage } from "@/routes/match.$matchId";
import { TeamsPage } from "@/routes/teams";
import { TeamDetailPage } from "@/routes/team.$teamId";
import { StatsPage } from "@/routes/stats";
import { RankingsPage } from "@/routes/rankings";
import { AdminLoginPage } from "@/routes/admin/login";
import { AdminDashboardPage } from "@/routes/admin/index";
import { AdminEventsPage } from "@/routes/admin/events";
import { AdminMatchesPage } from "@/routes/admin/matches";
import { AdminTeamsPage } from "@/routes/admin/teams";

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const eventsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/events",
  component: EventsPage,
});

const eventDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/events/$eventId",
  component: EventDetailPage,
});

const matchesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/matches",
  component: MatchesPage,
});

const matchDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/matches/$matchId",
  component: MatchDetailPage,
});

const teamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams",
  component: TeamsPage,
});

const teamDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/teams/$teamId",
  component: TeamDetailPage,
});

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stats",
  component: StatsPage,
});

const rankingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/rankings",
  component: RankingsPage,
});

const adminLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/login",
  component: AdminLoginPage,
});

const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminLayout,
});

const adminIndexRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/",
  component: AdminDashboardPage,
});

const adminEventsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/events",
  component: AdminEventsPage,
});

const adminMatchesRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/matches",
  component: AdminMatchesPage,
});

const adminTeamsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/teams",
  component: AdminTeamsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  eventsRoute,
  eventDetailRoute,
  matchesRoute,
  matchDetailRoute,
  teamsRoute,
  teamDetailRoute,
  statsRoute,
  rankingsRoute,
  adminLoginRoute,
  adminLayoutRoute.addChildren([
    adminIndexRoute,
    adminEventsRoute,
    adminMatchesRoute,
    adminTeamsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
