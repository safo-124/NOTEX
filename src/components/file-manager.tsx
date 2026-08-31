"use client";

import { useRef, useState, useTransition } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { enableBucketUploads, registerFile, removeFile } from "@/actions/files";
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
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const courseRef = useRef<HTMLSelectElement>(null);

  /**
   * The file goes straight from the browser to object storage. Routing it
   * through a Server Action would cap it at Vercel's 4.5 MB body limit, which
   * most lecture decks exceed.
   */
  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage("Choose a file first.");
      return;
    }

    setBusy(true);
    setProgress(0);
    setMessage(null);

    try {
      const res = await fetch("/api/files/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        }),
      });
      const ticket = (await res.json()) as { url?: string; key?: string; name?: string; error?: string };
      if (!res.ok || !ticket.url || !ticket.key) throw new Error(ticket.error ?? "Could not start the upload.");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", ticket.url as string);
        xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`The bucket rejected the upload (${xhr.status}). Press Allow uploads once.`));
        xhr.onerror = () => reject(new Error("The bucket refused the connection. Press Allow uploads once."));
        xhr.send(file);
      });

      const saved = await registerFile({
        key: ticket.key,
        name: ticket.name ?? file.name,
        courseId: courseRef.current?.value ?? null,
      });
      setMessage(saved.message);
      if (saved.ok && fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "The upload failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <>
      {!storageReady ? (
        <Card className="mb-4 border-[var(--destructive)] p-4 text-sm">
          Object storage is not configured. Fill in the S3 variables in the environment and redeploy.
        </Card>
      ) : null}

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="f-file">Lecture slides, PDFs, problem sets</Label>
            <Input id="f-file" ref={fileRef} type="file" className="py-1.5" />
          </div>
          <div className="flex flex-col gap-1.5 sm:w-52">
            <Label htmlFor="f-course">Course</Label>
            <Select id="f-course" ref={courseRef} defaultValue="none">
              <option value="none">No course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" onClick={upload} disabled={busy || !storageReady}>
            <Upload /> {progress === null ? "Upload" : `${progress}%`}
          </Button>
        </div>

        {progress !== null ? (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}

        {message ? <p className="mt-2 text-sm text-[var(--muted-foreground)]">{message}</p> : null}

        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy || !storageReady}
            onClick={() =>
              startTransition(async () => {
                const res = await enableBucketUploads();
                setMessage(res.message);
              })
            }
          >
            Allow uploads from this site
          </Button>
          <span className="ml-2 text-xs text-[var(--muted-foreground)]">
            Run once per bucket, or after changing the app URL.
          </span>
        </div>
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
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Download ${f.name}`}
              onClick={() => window.open(`/api/files/${f.id}`, "_blank")}
            >
              <Download />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${f.name}`}
              className="text-[var(--destructive)]"
              onClick={() => startTransition(async () => void (await removeFile(f.id)))}
            >
              <Trash2 />
            </Button>
          </Card>
        ))}

        {rows.length === 0 ? (
          <Card className="p-5 text-sm text-[var(--muted-foreground)]">Nothing uploaded yet.</Card>
        ) : null}
      </div>
    </>
  );
}
