"use client";

import { useEffect, useState, useTransition } from "react";
import { Play, Square, Trash2 } from "lucide-react";
import { discardSession, startSession, stopSession } from "@/actions/sessions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function elapsed(since: string) {
  const ms = Date.now() - new Date(since).getTime();
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/** The running timer, shown at the top of Tonight while it is going. */
export function RunningSession({
  startedAt,
  courseName,
  color,
}: {
  startedAt: string;
  courseName: string;
  color: string;
}) {
  const [label, setLabel] = useState(() => elapsed(startedAt));
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const id = setInterval(() => setLabel(elapsed(startedAt)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <Card
      className="mb-5 flex items-center gap-3 border-l-[3px] p-4"
      style={{ borderLeftColor: color, background: `color-mix(in srgb, ${color} 10%, var(--card))` }}
    >
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Studying now
        </p>
        <p className="truncate font-semibold">{courseName}</p>
      </div>
      <p className="shrink-0 font-mono text-2xl tabular">{label}</p>
      <Button
        size="sm"
        disabled={pending}
        onClick={() => startTransition(async () => void (await stopSession()))}
      >
        <Square /> Stop
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Discard this timer"
        disabled={pending}
        onClick={() => startTransition(async () => void (await discardSession()))}
      >
        <Trash2 />
      </Button>
    </Card>
  );
}

/** Per-block start button. */
export function StartButton({ blockId, disabled }: { blockId: string; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Start a timer for this block"
      disabled={pending || disabled}
      onClick={() => startTransition(async () => void (await startSession({ blockId })))}
    >
      <Play />
    </Button>
  );
}
