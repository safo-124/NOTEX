"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { deleteBlock, saveBlock } from "@/actions/schedule";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { DAY_NAMES, formatHours } from "@/lib/time";
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

type Course = { id: string; name: string; color: string };

type Draft = {
  id?: string;
  weekday: number;
  startTime: string;
  endTime: string;
  kind: string;
  courseId: string | null;
};

export function WeekPlanner({
  days,
  courses,
  todayIso,
}: {
  days: { dateIso: string; weekday: number; blocks: Block[] }[];
  courses: Course[];
  todayIso: string;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openNew(weekday: number) {
    setError(null);
    setDraft({
      weekday,
      startTime: "23:00",
      endTime: "01:00",
      kind: "Study block",
      courseId: courses[0]?.id ?? null,
    });
  }

  function openEdit(b: Block) {
    setError(null);
    setDraft({
      id: b.id,
      weekday: b.weekday,
      startTime: b.startTime,
      endTime: b.endTime,
      kind: b.kind,
      courseId: b.courseId,
    });
  }

  function submit() {
    if (!draft) return;
    startTransition(async () => {
      try {
        await saveBlock(draft);
        setDraft(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save that block.");
      }
    });
  }

  function remove() {
    if (!draft?.id) return;
    startTransition(async () => {
      await deleteBlock(draft.id as string);
      setDraft(null);
    });
  }

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

            <ul className="flex flex-col">
              {day.blocks.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => openEdit(b)}
                    className="flex w-full items-baseline gap-3 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-[var(--accent)]"
                  >
                    <span className="w-24 shrink-0 font-mono text-xs tabular text-[var(--muted-foreground)]">
                      {b.startTime} to {b.endTime}
                    </span>
                    <span
                      className={cn("min-w-0 flex-1 border-l-[3px] pl-2", b.done && "text-[var(--muted-foreground)] line-through")}
                      style={{ borderLeftColor: b.courseColor }}
                    >
                      {b.courseName}
                      <span className="ml-2 text-xs text-[var(--muted-foreground)]">{formatHours(b.minutes)}</span>
                    </span>
                    <Pencil className="size-3.5 shrink-0 text-[var(--muted-foreground)]" />
                  </button>
                </li>
              ))}
            </ul>

            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => openNew(day.weekday)}>
              <Plus /> Add a block
            </Button>
          </Card>
        ))}
      </div>

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? `${DAY_NAMES[draft.weekday]} block` : "New block"}
      >
        {draft ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-course">Course</Label>
              <Select
                id="d-course"
                value={draft.courseId ?? ""}
                onChange={(e) => setDraft({ ...draft, courseId: e.target.value || null })}
              >
                <option value="">Unassigned</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-start">Start</Label>
                <Input
                  id="d-start"
                  type="time"
                  value={draft.startTime}
                  onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="d-end">End</Label>
                <Input
                  id="d-end"
                  type="time"
                  value={draft.endTime}
                  onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-kind">Label</Label>
              <Input
                id="d-kind"
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-day">Night</Label>
              <Select
                id="d-day"
                value={draft.weekday}
                onChange={(e) => setDraft({ ...draft, weekday: Number(e.target.value) })}
              >
                {DAY_NAMES.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>

            <p className="text-xs text-[var(--muted-foreground)]">
              Times before noon count as after midnight, so 01:15 sits at the end of the night.
            </p>
            {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}

            <div className="flex items-center gap-2">
              <Button className="flex-1" onClick={submit} disabled={pending}>
                Save
              </Button>
              {draft.id ? (
                <Button variant="outline" onClick={remove} disabled={pending} className="text-[var(--destructive)]">
                  Delete
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={pending}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
