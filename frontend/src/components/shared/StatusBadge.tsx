import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_VARIANTS: Record<string, string> = {
  scheduled: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  upcoming: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  live: "bg-red-100 text-red-700 hover:bg-red-100 animate-pulse",
  ongoing: "bg-red-100 text-red-700 hover:bg-red-100",
  finished: "bg-green-100 text-green-700 hover:bg-green-100",
  concluded: "bg-green-100 text-green-700 hover:bg-green-100",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "未开始",
  upcoming: "未开始",
  live: "进行中",
  ongoing: "进行中",
  finished: "已结束",
  concluded: "已结束",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border-0",
        STATUS_VARIANTS[status] ?? "bg-slate-100 text-slate-700"
      )}
    >
      {label ?? STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
