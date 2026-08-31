"use client";

import { useEffect, useState } from "react";
import { CalendarDays, List } from "lucide-react";
import { WeekCalendar } from "@/components/week-calendar";
import { WeekPlanner } from "@/components/week-planner";
import type { CourseOption } from "@/components/block-editor";
import type { ClassRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Block = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  kind: string;
  minutes: number;
  courseId: string | null;
  courseName: string;
  courseColor: string;
  dateIso: string;
  done: boolean;
};

export function WeekView(props: {
  days: { dateIso: string; weekday: number; blocks: Block[] }[];
  courses: CourseOption[];
  todayIso: string;
  classesByDate: Record<string, ClassRow[]>;
  timeZone: string;
}) {
  const [mode, setMode] = useState<"calendar" | "list">("calendar");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("notex-week-view");
      if (saved === "list" || saved === "calendar") setMode(saved);
    } catch {}
  }, []);

  function choose(next: "calendar" | "list") {
    setMode(next);
    try {
      localStorage.setItem("notex-week-view", next);
    } catch {}
  }

  return (
    <>
      <div className="mb-4 inline-flex gap-1 rounded-lg bg-[var(--secondary)] p-1">
        {(
          [
            ["calendar", "Calendar", CalendarDays],
            ["list", "List", List],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
              mode === value
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)]",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {mode === "calendar" ? <WeekCalendar {...props} /> : <WeekPlanner {...props} />}
    </>
  );
}
