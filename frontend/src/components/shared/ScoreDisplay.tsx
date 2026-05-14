import { cn } from "@/lib/utils";

interface ScoreDisplayProps {
  scoreA?: number | null;
  scoreB?: number | null;
  winner?: "a" | "b" | null;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "text-sm gap-1",
  md: "text-xl font-bold gap-2",
  lg: "text-3xl font-bold gap-3",
};

export function ScoreDisplay({ scoreA, scoreB, winner, size = "md" }: ScoreDisplayProps) {
  const hasScores = scoreA != null && scoreB != null;

  return (
    <div className={cn("flex items-center", SIZE_CLASSES[size])}>
      <span className={cn(
        hasScores && winner === "a" && "text-primary",
        hasScores && winner === "b" && "text-muted-foreground"
      )}>
        {scoreA ?? "-"}
      </span>
      <span className="text-muted-foreground">:</span>
      <span className={cn(
        hasScores && winner === "b" && "text-primary",
        hasScores && winner === "a" && "text-muted-foreground"
      )}>
        {scoreB ?? "-"}
      </span>
    </div>
  );
}
