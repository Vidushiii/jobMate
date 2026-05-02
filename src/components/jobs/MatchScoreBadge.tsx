import { clsx } from "clsx";

interface MatchScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function MatchScoreBadge({ score, size = "md" }: MatchScoreBadgeProps) {
  const isHigh = score >= 70;
  const isMid = score >= 50 && score < 70;
  const isLow = score < 50;

  return (
    <span
      className={clsx(
        "inline-flex items-center font-semibold rounded-full tabular-nums",
        {
          "bg-[#FFF0F3] text-[#FF3E6C]": isHigh,
          "bg-amber-50 text-amber-700": isMid,
          "bg-gray-100 text-gray-500": isLow,
        },
        {
          "text-xs px-2 py-0.5": size === "sm",
          "text-sm px-2.5 py-1": size === "md",
          "text-base px-3 py-1.5": size === "lg",
        }
      )}
    >
      {score}% match
    </span>
  );
}
