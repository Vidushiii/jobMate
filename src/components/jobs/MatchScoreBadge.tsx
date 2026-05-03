import { clsx } from "clsx";

interface MatchScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

function getQuality(score: number): { label: string; classes: string } {
  if (score >= 70) return { label: "Strong match", classes: "bg-green-50 text-green-700" };
  if (score >= 50) return { label: "Good match", classes: "bg-amber-50 text-amber-700" };
  if (score >= 30) return { label: "Partial match", classes: "bg-gray-100 text-gray-500" };
  return { label: "Low match", classes: "bg-gray-50 text-gray-400" };
}

export function MatchScoreBadge({ score, size = "md" }: MatchScoreBadgeProps) {
  if (score === -1) {
    return (
      <span
        className={clsx(
          "inline-flex items-center gap-1.5 font-medium rounded-full bg-gray-100 text-gray-400 animate-pulse whitespace-nowrap",
          {
            "text-xs px-2 py-0.5": size === "sm",
            "text-sm px-2.5 py-1": size === "md",
            "text-base px-3 py-1.5": size === "lg",
          }
        )}
      >
        Scoring…
      </span>
    );
  }

  const { label, classes } = getQuality(score);

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 font-semibold rounded-full tabular-nums whitespace-nowrap",
        classes,
        {
          "text-xs px-2 py-0.5": size === "sm",
          "text-sm px-2.5 py-1": size === "md",
          "text-base px-3 py-1.5": size === "lg",
        }
      )}
    >
      {label}
      <span className="opacity-60 font-normal">· {score}%</span>
    </span>
  );
}
