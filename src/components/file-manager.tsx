"use client";

import { useRef, useState, useTransition } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { removeFile, uploadFile } from "@/actions/files";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Row = {
  id: string;
  name: string;
  size: number;
  contentType: string;
  createdAt: Date;
  courseId: string | null;
  courseName: string | null;
  courseColor: string | null;
};

export function FileManager({
  rows,
  courses,
  storageReady,
}: {
  rows: Row[];
  courses: { id: string; name: string }[];
  storageReady: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      {!storageReady ? (
        <Card className="mb-4 border-[var(--destructive)] p-4 text-sm">
          Object storage is not configured. Fill in the S3_ variables in the environment and redeploy.
        </Card>
      ) : null}

      <Card className="mb-5 p-4">
        <form
          ref={formRef}
          action={(formData) =>
            startTransition(async () => {
              const res = await uploadFile(formData);
              setMessage(res.message);
              if (res.ok) formRef.current?.reset();
            })
          }
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="f-file">Lecture slides, PDFs, problem sets</Label>
            <Input id="f-file" name="file" type="file" className="py-1.5" />
          </div>
          <div className="flex flex-col gap-1.5 sm:w-52">
            <Label htmlFor="f-course">Course</Label>
            <Select id="f-course" name="courseId" defaultValue="none">
              <option value="none">No course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={pending || !storageReady}>
            <Upload /> Upload
          </Button>
        </form>
        {message ? <p className="mt-2 text-sm text-[var(--muted-foreground)]">{message}</p> : null}
      </Card>

      <div className="flex flex-col gap-2.5">
        {rows.map((f) => (
          <Card
            key={f.id}
            className="flex items-center gap-3 border-l-[3px] p-3.5"
            style={{ borderLeftColor: f.courseColor ?? "var(--border)" }}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{f.name}</p>
              <p className="font-mono text-[11px] text-[var(--muted-foreground)]">
                {f.courseName ? `${f.courseName} · ` : ""}
                {(f.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                {new Date(f.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => window.open(`/api/files/${f.id}`, "_blank")}>
              <Download />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-[var(--destructive)]"
              disabled={pending}
              onClick={() => startTransition(async () => void (await removeFile(f.id)))}
            >
              <Trash2 />
            </Button>
          </Card>
        ))}

        {rows.length === 0 ? (
          <Card className="p-5 text-sm text-[var(--muted-foreground)]">
            Nothing uploaded yet.
          </Card>
        ) : null}
      </div>
    </>
  );
}
