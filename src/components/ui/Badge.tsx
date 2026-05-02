import { clsx } from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "green" | "amber" | "coral" | "gray" | "blue";
  className?: string;
}

export function Badge({ children, variant = "gray", className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        {
          "bg-green-50 text-green-700": variant === "green",
          "bg-amber-50 text-amber-700": variant === "amber",
          "bg-[#FFF0F3] text-[#FF3E6C]": variant === "coral",
          "bg-gray-100 text-gray-600": variant === "gray",
          "bg-blue-50 text-blue-700": variant === "blue",
        },
        className
      )}
    >
      {children}
    </span>
  );
}
