"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search } from "lucide-react";
import { deleteNote, saveNote } from "@/actions/notes";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type NoteRow = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  onDate: string | null;
  updatedAt: Date;
  courseId: string | null;
  courseName: string | null;
  courseColor: string | null;
};

type Draft = {
  id?: string;
  title: string;
  body: string;
  courseId: string | null;
  tags: string;
  pinned: boolean;
};

export function NotesBrowser({
  notes,
  courses,
  todayIso,
}: {
  notes: NoteRow[];
  courses: { id: string; name: string; color: string }[];
  todayIso: string;
}) {
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState(false);
  const [open, setOpen] = useState<NoteRow | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (courseFilter && n.courseId !== courseFilter) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [notes, query, courseFilter]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes"
            className="pl-9"
          />
        </div>
        <Select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="sm:w-56"
          aria-label="Filter by course"
        >
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Button
          onClick={() => {
            setPreview(false);
            setDraft({ title: "", body: "", courseId: courseFilter || courses[0]?.id || null, tags: "", pinned: false });
          }}
        >
          <Plus /> New
        </Button>
      </div>

      <div className="flex flex-col gap-2.5">
        {visible.map((n) => (
          <Card
            key={n.id}
            className="cursor-pointer border-l-[3px] p-4 hover:bg-[var(--accent)]"
            style={{ borderLeftColor: n.courseColor ?? "var(--border)" }}
            onClick={() => setOpen(n)}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate font-semibold">{n.title}</p>
              <span className="shrink-0 font-mono text-[11px] text-[var(--muted-foreground)]">
                {new Date(n.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-[var(--muted-foreground)]">
              {n.body.replace(/[#*`_>-]/g, "").slice(0, 220) || "Empty note"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
              {n.courseName ? <span style={{ color: n.courseColor ?? undefined }}>{n.courseName}</span> : null}
              {n.tags.map((t) => (
                <span key={t} className="rounded-sm bg-[var(--muted)] px-1.5 py-0.5">
                  {t}
                </span>
              ))}
            </div>
          </Card>
        ))}

        {visible.length === 0 ? (
          <Card className="p-5 text-sm text-[var(--muted-foreground)]">
            {notes.length ? "Nothing matches that search." : "No notes yet. Write the first one during tonight's block."}
          </Card>
        ) : null}
      </div>

      {/* reader */}
      <Modal open={open !== null} onClose={() => setOpen(null)} title={open?.title ?? ""} className="sm:max-w-2xl">
        {open ? (
          <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto">
            <Markdown>{open.body || "_Empty note_"}</Markdown>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDraft({
                    id: open.id,
                    title: open.title,
                    body: open.body,
                    courseId: open.courseId,
                    tags: open.tags.join(", "),
                    pinned: open.pinned,
                  });
                  setPreview(false);
                  setOpen(null);
                }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                className="text-[var(--destructive)]"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteNote(open.id);
                    setOpen(null);
                  })
                }
              >
                Delete
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* editor */}
      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit note" : "New note"}
        className="sm:max-w-2xl"
      >
        {draft ? (
          <div className="flex flex-col gap-3">
            <Input
              value={draft.title}
              placeholder="Title"
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="n-course">Course</Label>
                <Select
                  id="n-course"
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
                <Label htmlFor="n-tags">Tags</Label>
                <Input
                  id="n-tags"
                  value={draft.tags}
                  placeholder="fourier, exam, lecture 3"
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Body</Label>
              <button
                type="button"
                className="text-xs text-[var(--primary)]"
                onClick={() => setPreview((p) => !p)}
              >
                {preview ? "Write" : "Preview"}
              </button>
            </div>

            {preview ? (
              <div className="max-h-[45dvh] overflow-y-auto rounded-md border border-[var(--border)] p-3">
                <Markdown>{draft.body || "_Nothing to preview yet_"}</Markdown>
              </div>
            ) : (
              <Textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                placeholder={"Markdown, with $x[n] = \\sin(2\\pi f n)$ for formulas and ``` for code."}
                className={cn("min-h-[45dvh] font-mono text-sm")}
              />
            )}

            <div className="flex items-center gap-2">
              <Button
                className="flex-1"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await saveNote({
                      id: draft.id,
                      title: draft.title,
                      body: draft.body,
                      courseId: draft.courseId,
                      onDate: draft.id ? null : todayIso,
                      tags: draft.tags
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                      pinned: draft.pinned,
                    });
                    setDraft(null);
                  })
                }
              >
                Save
              </Button>
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
