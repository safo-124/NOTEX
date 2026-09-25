"use client";

import { useState, useTransition } from "react";
import { saveExamPrep, toggleDeadlineDone } from "@/actions/deadlines";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export type ExamCardProps = {
  id: string;
  title: string;
  courseName: string;
  courseColor: string;
  whenLabel: string;
  daysLeft: number;
  location: string | null;
  prepHours: number;
  prepDays: number;
  loggedMinutes: number;
  plannedMinutes: number;
  targetMinutes: number;
  shortfallMinutes: number;
  /** Set when preparation has not started yet. */
  startsLabel: string | null;
  nextSittingLabel: string | null;
};

const hours = (minutes: number) => `${Math.round((minutes / 60) * 10) / 10} h`;

export function ExamPrepCard(props: ExamCardProps) {
  const [editing, setEditing] = useState(false);
  const [prepHours, setPrepHours] = useState(String(props.prepHours));
  const [prepDays, setPrepDays] = useState(String(props.prepDays));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const target = Math.max(1, props.targetMinutes);
  const donePct = Math.min(100, (props.loggedMinutes / target) * 100);
  const plannedPct = Math.min(100 - donePct, (props.plannedMinutes / target) * 100);
  // Under an hour short is rounding on block lengths, not a problem.
  const short = props.shortfallMinutes >= 60;

  return (
    <Card className="border-l-[3px] p-4" style={{ borderLeftColor: props.courseColor }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight">{props.courseName}</p>
          <p className="truncate text-xs text-[var(--muted-foreground)]">
            {props.title} · {props.whenLabel}
            {props.location ? ` · ${props.location}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 font-mono text-xs tabular",
            props.daysLeft <= 3 ? "text-[var(--destructive)]" : props.daysLeft <= 10 ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]",
          )}
        >
          {props.daysLeft <= 0 ? "today" : props.daysLeft === 1 ? "tomorrow" : `in ${props.daysLeft} days`}
        </span>
      </div>

      <div
        className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]"
        role="img"
        aria-label={`${hours(props.loggedMinutes)} done and ${hours(props.plannedMinutes)} planned of ${hours(props.targetMinutes)}`}
      >
        <div style={{ width: `${donePct}%`, background: props.courseColor }} />
        <div
          style={{
            width: `${plannedPct}%`,
            background: `color-mix(in srgb, ${props.courseColor} 35%, transparent)`,
          }}
        />
      </div>

      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        <span className="text-[var(--foreground)]">{hours(props.loggedMinutes)} done</span> ·{" "}
        {hours(props.plannedMinutes)} planned · target {props.prepHours} h over {props.prepDays} days
      </p>

      <p className={cn("mt-1 text-xs", short ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]")}>
        {short
          ? `${hours(props.shortfallMinutes)} short: start earlier, lower the target or add study blocks.`
          : props.startsLabel
            ? `Preparation starts ${props.startsLabel}.`
            : "On track."}
      </p>

      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Adjust
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(async () => void (await toggleDeadlineDone(props.id)))}
        >
          {props.nextSittingLabel ? `Skip to ${props.nextSittingLabel}` : "Mark as taken"}
        </Button>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title={`Prepare for ${props.courseName}`}>
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`hours-${props.id}`}>Hours of preparation</Label>
              <Input
                id={`hours-${props.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={300}
                value={prepHours}
                onChange={(e) => setPrepHours(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`days-${props.id}`}>Start this many days before</Label>
              <Input
                id={`days-${props.id}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={90}
                value={prepDays}
                onChange={(e) => setPrepDays(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            Hours you log with the timer on this course count toward the target. The plan fills your study blocks
            to match; it never adds blocks of its own.
          </p>

          {message ? <p className="text-sm text-[var(--destructive)]">{message}</p> : null}

          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await saveExamPrep({
                    id: props.id,
                    prepHours: Number(prepHours),
                    prepDays: Number(prepDays),
                  });
                  if (!res.ok) {
                    setMessage(res.message);
                    return;
                  }
                  setMessage(null);
                  setEditing(false);
                })
              }
            >
              Save
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
