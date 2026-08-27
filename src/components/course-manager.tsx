"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { deleteCourse, saveCourse } from "@/actions/schedule";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { formatHours } from "@/lib/time";
import { cn } from "@/lib/utils";

const SWATCHES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

type Row = {
  id: string;
  name: string;
  code: string;
  color: string;
  focus: boolean;
  planned: number;
  done: number;
};

type Draft = { id?: string; name: string; code: string; color: string; focus: boolean };

export function CourseManager({ rows }: { rows: Row[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <div className="flex flex-col gap-3">
        {rows.map((c) => {
          const pct = c.planned ? (c.done / c.planned) * 100 : 0;
          return (
            <Card key={c.id} className="p-4">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <p className="font-semibold">
                  {c.name}
                  {c.focus ? (
                    <span className="ml-2 rounded-sm bg-[var(--accent)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--primary)]">
                      focus
                    </span>
                  ) : null}
                </p>
                <span className="shrink-0 font-mono text-xs tabular text-[var(--muted-foreground)]">
                  {formatHours(c.done)} / {formatHours(c.planned)}
                </span>
              </div>
              <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-[var(--muted-foreground)]">
                <span>{c.code}</span>
                <button
                  type="button"
                  className="text-[var(--primary)]"
                  onClick={() => setDraft({ id: c.id, name: c.name, code: c.code, color: c.color, focus: c.focus })}
                >
                  Edit
                </button>
              </div>
              <Progress value={pct} color={c.color} />
            </Card>
          );
        })}
      </div>

      <Button
        variant="outline"
        className="mt-3 w-full"
        onClick={() => setDraft({ name: "", code: "", color: SWATCHES[rows.length % SWATCHES.length], focus: false })}
      >
        <Plus /> Add a course
      </Button>

      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? "Edit course" : "New course"}>
        {draft ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-name">Name</Label>
              <Input
                id="c-name"
                value={draft.name}
                placeholder="Course name"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-code">Code</Label>
              <Input
                id="c-code"
                value={draft.code}
                placeholder="COMP.SGN.100"
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Colour</Label>
              <div className="flex gap-2">
                {SWATCHES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-label="colour"
                    aria-pressed={draft.color === s}
                    onClick={() => setDraft({ ...draft, color: s })}
                    className={cn(
                      "size-8 rounded-full border-2",
                      draft.color === s ? "border-[var(--foreground)]" : "border-transparent",
                    )}
                    style={{ background: s }}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
              <Switch checked={draft.focus} onCheckedChange={(v) => setDraft({ ...draft, focus: v })} />
              Priority course
            </label>

            <div className="flex items-center gap-2">
              <Button
                className="flex-1"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await saveCourse({ ...draft, name: draft.name.trim() || "Untitled course" });
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
                      await deleteCourse(draft.id as string);
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
    </>
  );
}
