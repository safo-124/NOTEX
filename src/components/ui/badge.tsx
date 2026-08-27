import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-[var(--border)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]",
        className,
      )}
      {...props}
    />
  );
}
