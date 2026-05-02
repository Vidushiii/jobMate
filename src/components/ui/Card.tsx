import { clsx } from "clsx";
import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={clsx(
        "bg-white rounded-xl border border-gray-100 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
