"use client";

import { useState, useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { deleteDeadline, saveDeadline, toggleDeadlineDone } from "@/actions/deadlines";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DeadlineRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Draft = {
  id?: string;
  title: string;
  kind: "assignment" | "exam" | "project" | "other";
  courseId: string | null;
  dueAt: string;
  notes: string;
};

/** Red inside three days, amber inside a week: the only two states worth colour. */
function urgency(daysLeft: number) {
  if (daysLeft <= 2) return "text-[var(--destructive)]";
  if (daysLeft <= 7) return "text-[var(--primary)]";
  return "text-[var(--muted-foreground)]";
}

function dueLabel(row: DeadlineRow) {
  if (row.daysLeft < 0) return "overdue";
  if (row.daysLeft === 0) return "today";
  if (row.daysLeft === 1) return "tomorrow";
  return `in ${row.daysLeft} days`;
}

function localInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DeadlineBoard({
  soon,
  all,
  courses,
}: {
  soon: DeadlineRow[];
  all: DeadlineRow[];
  courses: { id: string; name: string; color: string }[];
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const blank: Draft = {
    title: "",
    kind: "assignment",
    courseId: courses[0]?.id ?? null,
    dueAt: localInputValue(new Date(Date.now() + 7 * 86400_000)),
    notes: "",
  };

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Due soon
        </h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
            All {all.length ? `(${all.length})` : ""}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDraft(blank)}>
            <Plus /> Add
          </Button>
        </div>
      </div>

      {soon.length === 0 ? (
        <Card className="p-4 text-sm text-[var(--muted-foreground)]">
          Nothing due in the next two months. Exams arrive here from Sisu automatically.
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {soon.map((d) => (
            <Card key={d.id} className="flex items-center gap-3 p-3">
              <button
                type="button"
                aria-label={d.done ? "Mark as not done" : "Mark as done"}
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border",
                  d.done ? "border-transparent bg-[var(--primary)]" : "border-[var(--border)]",
                )}
                onClick={() => startTransition(async () => void (await toggleDeadlineDone(d.id)))}
              >
                <Check className={cn("size-3.5", d.done ? "text-[var(--primary-foreground)]" : "text-transparent")} strokeWidth={3} />
              </button>

              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() =>
                  setDraft({
                    id: d.id,
                    title: d.title,
                    kind: (["assignment", "exam", "project", "other"].includes(d.kind) ? d.kind : "other") as Draft["kind"],
                    courseId: d.courseId,
                    dueAt: localInputValue(new Date(d.dueAt)),
                    notes: d.notes ?? "",
                  })
                }
              >
                <p className={cn("truncate font-medium leading-tight", d.done && "line-through opacity-60")}>
                  {d.title}
                </p>
                <p className="truncate text-xs text-[var(--muted-foreground)]">
                  {d.courseName ? <span style={{ color: d.courseColor ?? undefined }}>{d.courseName}</span> : "No course"}
                  {" · "}
                  {new Date(d.dueAt).toLocaleString("en-GB", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </button>

              <span className={cn("shrink-0 font-mono text-xs tabular", urgency(d.daysLeft))}>
                {dueLabel(d)}
              </span>
            </Card>
          ))}
        </div>
      )}

      {/* everything, including done */}
      <Modal open={showAll} onClose={() => setShowAll(false)} title="All deadlines" className="sm:max-w-2xl">
        <div className="flex max-h-[65dvh] flex-col gap-2 overflow-y-auto">
          {all.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">Nothing recorded yet.</p>
          ) : (
            all.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-md border border-[var(--border)] p-2.5">
                <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                  {d.kind}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm", d.done && "line-through opacity-60")}>{d.title}</p>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">
                    {new Date(d.dueAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    {d.fromFeed ? " · from Sisu" : ""}
                  </p>
                </div>
                <span className={cn("shrink-0 font-mono text-[11px] tabular", urgency(d.daysLeft))}>
                  {dueLabel(d)}
                </span>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* editor */}
      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? "Edit deadline" : "New deadline"}>
        {draft ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dl-title">Title</Label>
              <Input
                id="dl-title"
                value={draft.title}
                placeholder="Problem set 2"
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dl-course">Course</Label>
                <Select
                  id="dl-course"
                  value={draft.courseId ?? ""}
                  onChange={(e) => setDraft({ ...draft, courseId: e.target.value || null })}
                >
                  <option value="">No course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dl-kind">Kind</Label>
                <Select
                  id="dl-kind"
                  value={draft.kind}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as Draft["kind"] })}
                >
                  <option value="assignment">Assignment</option>
                  <option value="exam">Exam</option>
                  <option value="project">Project</option>
                  <option value="other">Other</option>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dl-due">Due</Label>
              <Input
                id="dl-due"
                type="datetime-local"
                value={draft.dueAt}
                onChange={(e) => setDraft({ ...draft, dueAt: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dl-notes">Notes</Label>
              <Textarea
                id="dl-notes"
                value={draft.notes}
                className="min-h-20"
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>

            {message ? <p className="text-sm text-[var(--destructive)]">{message}</p> : null}

            <div className="flex items-center gap-2">
              <Button
                className="flex-1"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await saveDeadline(draft);
                    if (!res.ok) {
                      setMessage(res.message);
                      return;
                    }
                    setMessage(null);
                    setDraft(null);
                  })
                }
              >
                Save
              </Button>
              {draft.id ? (
                <Button
                  variant="outline"
                  className="text-[var(--destructive)]"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteDeadline(draft.id as string);
                      setDraft(null);
                    })
                  }
                >
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
    </section>
  );
}
