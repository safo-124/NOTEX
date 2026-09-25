"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Previous, this week, next, and a date picker to jump anywhere. */
export function WeekNav({
  mondayIso,
  prevIso,
  nextIso,
  isCurrent,
}: {
  mondayIso: string;
  prevIso: string;
  nextIso: string;
  isCurrent: boolean;
}) {
  const router = useRouter();
  const icon = buttonVariants({ variant: "outline", size: "icon" });

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Link href={`/week?week=${prevIso}`} className={icon} aria-label="Previous week">
        <ChevronLeft />
      </Link>
      <Link href={`/week?week=${nextIso}`} className={icon} aria-label="Next week">
        <ChevronRight />
      </Link>
      <Link
        href="/week"
        aria-disabled={isCurrent}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), isCurrent && "pointer-events-none opacity-50")}
      >
        This week
      </Link>
      <label className="ml-auto flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        Go to
        <input
          type="date"
          value={mondayIso}
          className="h-9 rounded-md border border-[var(--input)] bg-[var(--background)] px-2 text-sm text-[var(--foreground)]"
          onChange={(e) => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) router.push(`/week?week=${e.target.value}`);
          }}
        />
      </label>
    </div>
  );
}
