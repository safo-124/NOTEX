"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { BlockEditor, type BlockDraft, type CourseOption } from "@/components/block-editor";
import { ClassList } from "@/components/class-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DAY_NAMES, formatHours } from "@/lib/time";
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

/** The plain list: easier to edit precisely, and readable on a small phone. */
export function WeekPlanner({
  days,
  courses,
  todayIso,
  classesByDate = {},
}: {
  days: { dateIso: string; weekday: number; blocks: Block[] }[];
  courses: CourseOption[];
  todayIso: string;
  classesByDate?: Record<string, ClassRow[]>;
}) {
  const [draft, setDraft] = useState<BlockDraft | null>(null);

  return (
    <>
      <div className="flex flex-col gap-3">
        {days.map((day) => (
          <Card key={day.dateIso} className={cn("p-4", day.dateIso === todayIso && "border-[var(--primary)]")}>
            <div className="mb-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              <span className={day.dateIso === todayIso ? "text-[var(--primary)]" : undefined}>
                {DAY_NAMES[day.weekday]} {Number(day.dateIso.slice(8))}
              </span>
              <span>
                {day.blocks.filter((b) => b.done).length}/{day.blocks.length}
              </span>
            </div>

            <ClassList rows={classesByDate[day.dateIso] ?? []} compact />

            <ul className="flex flex-col">
              {day.blocks.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        id: b.id,
                        weekday: b.weekday,
                        startTime: b.startTime,
                        endTime: b.endTime,
                        kind: b.kind,
                        courseId: b.courseId,
                      })
                    }
                    className="flex w-full items-baseline gap-3 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-[var(--accent)]"
                  >
                    <span className="w-24 shrink-0 font-mono text-xs tabular text-[var(--muted-foreground)]">
                      {b.startTime} to {b.endTime}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 border-l-[3px] pl-2",
                        b.done && "text-[var(--muted-foreground)] line-through",
                      )}
                      style={{ borderLeftColor: b.courseColor }}
                    >
                      {b.courseName}
                      <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                        {formatHours(b.minutes)}
                      </span>
                    </span>
                    <Pencil className="size-3.5 shrink-0 text-[var(--muted-foreground)]" />
                  </button>
                </li>
              ))}
            </ul>

            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={() =>
                setDraft({
                  weekday: day.weekday,
                  startTime: "23:00",
                  endTime: "01:00",
                  kind: "Study block",
                  courseId: courses[0]?.id ?? null,
                })
              }
            >
              <Plus /> Add a block to {DAY_NAMES[day.weekday]}
            </Button>
          </Card>
        ))}
      </div>

      <BlockEditor draft={draft} courses={courses} onClose={() => setDraft(null)} />
    </>
  );
}
