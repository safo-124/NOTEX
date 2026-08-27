import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--muted-foreground)]",
        className,
      )}
      {...props}
    />
  );
}
