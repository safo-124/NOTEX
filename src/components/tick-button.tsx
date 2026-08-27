"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleTick } from "@/actions/schedule";
import { cn } from "@/lib/utils";

export function TickButton({
  blockId,
  onDate,
  done,
  label,
  color,
}: {
  blockId: string;
  onDate: string;
  done: boolean;
  label: string;
  color: string;
}) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={optimisticDone}
      aria-label={optimisticDone ? `Mark ${label} as not done` : `Mark ${label} as done`}
      onClick={() =>
        startTransition(async () => {
          setOptimisticDone(!optimisticDone);
          await toggleTick(blockId, onDate);
        })
      }
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        optimisticDone ? "border-transparent" : "border-[var(--border)]",
      )}
      style={optimisticDone ? { background: color } : undefined}
    >
      <Check
        className={cn("size-4", optimisticDone ? "text-[var(--card)]" : "text-transparent")}
        strokeWidth={3}
      />
    </button>
  );
}
