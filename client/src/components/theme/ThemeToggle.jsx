import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme.js";

export default function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-text transition-all duration-200 hover:-translate-y-px hover:bg-surface-hover hover:shadow-md"
    >
      {resolvedTheme === "dark" ? (
        <Sun size={16} className="text-accent" />
      ) : (
        <Moon size={16} className="text-text-secondary" />
      )}
    </button>
  );
}
