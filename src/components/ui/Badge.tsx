import * as React from "react";
import { cn } from "@/core/utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground shadow",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
    destructive: "border-transparent bg-destructive/15 text-destructive border border-destructive/20",
    outline: "text-foreground border border-border",
    success: "border-transparent bg-emerald-500/15 text-emerald-500 border border-emerald-500/20",
    warning: "border-transparent bg-amber-500/15 text-amber-500 border border-amber-500/20",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-ring select-none",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
