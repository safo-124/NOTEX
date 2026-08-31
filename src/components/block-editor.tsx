"use client";

import { useState, useTransition } from "react";
import { deleteBlock, saveBlock } from "@/actions/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { DAY_NAMES } from "@/lib/time";

export type BlockDraft = {
  id?: string;
  weekday: number;
  startTime: string;
  endTime: string;
  kind: string;
  courseId: string | null;
};

export type CourseOption = { id: string; name: string; color: string };

/** Shared by the list and the calendar, so a block behaves the same in both. */
export function BlockEditor({
  draft,
  courses,
  onClose,
}: {
  draft: BlockDraft | null;
  courses: CourseOption[];
  onClose: () => void;
}) {
  const [value, setValue] = useState<BlockDraft | null>(draft);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset when a different block is opened.
  const [seen, setSeen] = useState(draft);
  if (seen !== draft) {
    setSeen(draft);
    setValue(draft);
    setError(null);
  }

  if (!value) return <Modal open={false} onClose={onClose} title="" children={null} />;

  return (
    <Modal
      open={draft !== null}
      onClose={onClose}
      title={value.id ? `${DAY_NAMES[value.weekday]} block` : "New block"}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="d-course">Course</Label>
          <Select
            id="d-course"
            value={value.courseId ?? ""}
            onChange={(e) => setValue({ ...value, courseId: e.target.value || null })}
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
              value={value.startTime}
              onChange={(e) => setValue({ ...value, startTime: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-end">End</Label>
            <Input
              id="d-end"
              type="time"
              value={value.endTime}
              onChange={(e) => setValue({ ...value, endTime: e.target.value })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="d-kind">Label</Label>
          <Input
            id="d-kind"
            value={value.kind}
            onChange={(e) => setValue({ ...value, kind: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="d-day">Night</Label>
          <Select
            id="d-day"
            value={value.weekday}
            onChange={(e) => setValue({ ...value, weekday: Number(e.target.value) })}
          >
            {DAY_NAMES.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </Select>
        </div>

        <p className="text-xs text-[var(--muted-foreground)]">
          Times before 04:00 belong to the small hours of that night, so 01:15 sits after 23:00.
        </p>
        {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}

        <div className="flex items-center gap-2">
          <Button
            className="flex-1"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await saveBlock(value);
                  onClose();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not save that block.");
                }
              })
            }
          >
            Save
          </Button>
          {value.id ? (
            <Button
              variant="outline"
              className="text-[var(--destructive)]"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteBlock(value.id as string);
                  onClose();
                })
              }
            >
              Delete
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
