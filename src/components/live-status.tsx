"use client";

import { useEffect, useState } from "react";
import { minutesOf } from "@/lib/time";

type Slot = { id: string; startTime: string; endTime: string; courseName: string };

/** Ticks in the browser so the countdown stays honest without re-fetching. */
export function LiveStatus({ blocks, timeZone }: { blocks: Slot[]; timeZone: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <p className="h-5" />;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const [h, m] = parts.split(":").map(Number);
  const minutes = h < 4 ? h * 60 + m + 1440 : h * 60 + m;

  let current: Slot | null = null;
  let next: Slot | null = null;
  for (const b of blocks) {
    if (minutes >= minutesOf(b.startTime) && minutes < minutesOf(b.endTime)) current = b;
    else if (minutes < minutesOf(b.startTime) && !next) next = b;
  }

  const label = current
    ? `${current.courseName} · ${fmt(minutesOf(current.endTime) - minutes)} left`
    : next
      ? `Next block ${next.startTime} · in ${fmt(minutesOf(next.startTime) - minutes)}`
      : "Night finished. Sleep.";

  return (
    <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ background: current ? "var(--live)" : next ? "var(--primary)" : "var(--muted-foreground)" }}
      />
      <span className="tabular">{label}</span>
      <span className="ml-auto font-mono text-xs tabular">{parts}</span>
    </p>
  );
}

function fmt(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}
