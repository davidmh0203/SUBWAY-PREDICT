import { lineKeyToBadgeLabel } from "@/lib/metro-line-badges";
import { cn } from "@/lib/utils";

export function LineBadge({ lineKey, color, size = "md", className }) {
  const label = lineKeyToBadgeLabel(lineKey);
  const isNumeric = /^\d+$/.test(label);
  const sizeClass =
    size === "sm"
      ? cn("h-5 min-w-5 text-[9px]", isNumeric ? "px-0" : "px-1")
      : cn("h-6 min-w-6 text-[10px]", isNumeric ? "px-0" : "px-1.5");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none text-white",
        sizeClass,
        className,
      )}
      style={{ backgroundColor: color }}
      title={lineKey}
    >
      {label}
    </span>
  );
}
