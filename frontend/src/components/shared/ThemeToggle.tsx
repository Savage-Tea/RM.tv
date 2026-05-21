import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme, type Theme } from "@/hooks/useTheme";

const CYCLE: { current: Theme; next: Theme; label: string; icon: typeof Sun }[] = [
  { current: "light", next: "dark", label: "浅色模式", icon: Sun },
  { current: "dark", next: "system", label: "深色模式", icon: Moon },
  { current: "system", next: "light", label: "跟随系统", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const handleClick = () => {
    const entry = CYCLE.find((e) => e.current === theme);
    if (entry) setTheme(entry.next);
  };

  const current = CYCLE.find((e) => e.current === theme) ?? CYCLE[0];
  const Icon = current.icon;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      title={`主题: ${current.label}（点击切换）`}
      aria-label="切换主题"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
