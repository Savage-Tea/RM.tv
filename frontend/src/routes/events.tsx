import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import type { Event } from "@/types";

const SEASONS = ["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015"];

export function EventsPage() {
  const [season, setSeason] = useState<string>("2026");
  const [status, setStatus] = useState<string>("");

  const events = useQuery({
    queryKey: ["events", season, status],
    queryFn: () => api.events.list({ season, ...(status && { status }), per_page: "50" }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="赛事" description="RoboMaster 赛事档案" />

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
          {["", "ongoing", "upcoming", "concluded"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                status === s ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
              }`}
            >
              {s === "" ? "全部" : s === "ongoing" ? "进行中" : s === "upcoming" ? "未开始" : "已结束"}
            </button>
          ))}
        </div>
      </div>

      {events.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : events.data?.data.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {events.data.data.map((event: Event) => (
            <Link
              key={event.id}
              to="/events/$eventId"
              params={{ eventId: event.id }}
              className="rounded-lg border p-5 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{event.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {event.series} · {event.season}
                  </p>
                  {event.location && (
                    <p className="text-xs text-muted-foreground mt-1">{event.location}</p>
                  )}
                </div>
                <StatusBadge status={event.status} />
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {event.start_date && `${event.start_date}`}
                {event.start_date && event.end_date && ` — ${event.end_date}`}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-12">暂无赛事数据</p>
      )}
    </div>
  );
}
