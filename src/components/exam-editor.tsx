"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { deleteDeadline, saveExam } from "@/actions/deadlines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";

export type ExamCourse = { id: string; name: string; code: string };

export type ExamDraft = {
  id?: string;
  courseId: string;
  title: string;
  /** datetime-local value, in the user's timezone. */
  dueAt: string;
  location: string;
  prepHours: string;
  prepDays: string;
  /** Sisu owns the date, room and course of an exam it sent. */
  fromFeed: boolean;
};

export function ExamEditor({
  open,
  onClose,
  initial,
  courses,
}: {
  open: boolean;
  onClose: () => void;
  initial: ExamDraft;
  courses: ExamCourse[];
}) {
  const [draft, setDraft] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<ExamDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const locked = draft.fromFeed;

  function close() {
    setMessage(null);
    setDraft(initial);
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title={draft.id ? "Edit exam" : "Add an exam"}>
      <div className="flex flex-col gap-3">
        {courses.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Add the course first on{" "}
            <Link href="/courses" className="underline">
              Courses
            </Link>
            , so the plan knows which study hours count toward it.
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="exam-course">Course</Label>
          <Select
            id="exam-course"
            value={draft.courseId}
            disabled={locked}
            onChange={(e) => set({ courseId: e.target.value })}
          >
            <option value="" disabled>
              Pick a course
            </option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exam-when">Date and time</Label>
            <Input
              id="exam-when"
              type="datetime-local"
              value={draft.dueAt}
              disabled={locked}
              onChange={(e) => set({ dueAt: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exam-room">Room (optional)</Label>
            <Input
              id="exam-room"
              value={draft.location}
              placeholder="TB103"
              disabled={locked}
              onChange={(e) => set({ location: e.target.value })}
            />
          </div>
        </div>

        {locked ? null : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exam-title">Name (optional)</Label>
            <Input
              id="exam-title"
              value={draft.title}
              placeholder="Defaults to the course code and “exam”"
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exam-hours">Hours of preparation</Label>
            <Input
              id="exam-hours"
              type="number"
              inputMode="numeric"
              min={0}
              max={300}
              value={draft.prepHours}
              onChange={(e) => set({ prepHours: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exam-days">Start this many days before</Label>
            <Input
              id="exam-days"
              type="number"
              inputMode="numeric"
              min={1}
              max={90}
              value={draft.prepDays}
              onChange={(e) => set({ prepDays: e.target.value })}
            />
          </div>
        </div>

        <p className="text-xs text-[var(--muted-foreground)]">
          {locked ? "The date and room come from Sisu and update on each sync. " : ""}
          Hours you log with the timer on this course count toward the target. The plan fills your study blocks to
          match; it never adds blocks of its own.
        </p>

        {message ? <p className="text-sm text-[var(--destructive)]">{message}</p> : null}

        <div className="flex items-center gap-2">
          <Button
            className="flex-1"
            disabled={pending || courses.length === 0}
            onClick={() =>
              startTransition(async () => {
                const res = await saveExam({
                  id: draft.id,
                  courseId: draft.courseId,
                  title: draft.title,
                  dueAt: draft.dueAt,
                  location: draft.location,
                  prepHours: Number(draft.prepHours),
                  prepDays: Number(draft.prepDays),
                });
                if (!res.ok) {
                  setMessage(res.message);
                  return;
                }
                setMessage(null);
                onClose();
              })
            }
          >
            {draft.id ? "Save" : "Add exam"}
          </Button>
          {draft.id && !locked ? (
            <Button
              variant="outline"
              className="text-[var(--destructive)]"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteDeadline(draft.id as string);
                  onClose();
                })
              }
            >
              Delete
            </Button>
          ) : null}
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** The Exams page header button. */
export function AddExamButton({
  courses,
  defaultDueAt,
  prepHours,
  prepDays,
}: {
  courses: ExamCourse[];
  defaultDueAt: string;
  prepHours: number;
  prepDays: number;
}) {
  const [open, setOpen] = useState(false);
  // A fresh key per opening, so the form starts blank every time.
  const [key, setKey] = useState(0);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <Plus /> Add exam
      </Button>
      <ExamEditor
        key={key}
        open={open}
        onClose={() => setOpen(false)}
        courses={courses}
        initial={{
          courseId: courses[0]?.id ?? "",
          title: "",
          dueAt: defaultDueAt,
          location: "",
          prepHours: String(prepHours),
          prepDays: String(prepDays),
          fromFeed: false,
        }}
      />
    </>
  );
}
