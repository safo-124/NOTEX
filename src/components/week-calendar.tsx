"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Lock, Plus } from "lucide-react";
import { saveBlock } from "@/actions/schedule";
import { BlockEditor, type BlockDraft, type CourseOption } from "@/components/block-editor";
import { Button } from "@/components/ui/button";
import { DAY_NAMES, labelOf, minutesOf } from "@/lib/time";
import type { ClassRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Block = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  kind: string;
  minutes: number;
  courseId: string | null;
  courseName: string;
  courseColor: string;
  dateIso: string;
  done: boolean;
};

type Day = { dateIso: string; weekday: number; blocks: Block[] };

/** 08:00 to 03:00 the next morning: lectures at one end, deep blocks at the other. */
const GRID_START = 8 * 60;
const GRID_END = 27 * 60;
const SPAN = GRID_END - GRID_START;
const PX_PER_MIN = 0.8;
const SNAP = 15;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Item =
  | { type: "class"; key: string; start: number; end: number; data: ClassRow }
  | { type: "block"; key: string; start: number; end: number; data: Block };

type Placed = Item & { left: number; width: number };

/**
 * Standard calendar column packing: events that overlap in time share the
 * column's width instead of covering each other. Events are grouped into
 * clusters of transitively overlapping items, and within a cluster each event
 * takes the first lane that is free at its start.
 */
function packColumns(items: Item[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: Placed[] = [];

  let cluster: Item[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    const lanes: Item[][] = [];

    for (const item of cluster) {
      const lane = lanes.find((l) => l[l.length - 1].end <= item.start);
      if (lane) lane.push(item);
      else lanes.push([item]);
    }

    const count = lanes.length;
    lanes.forEach((lane, index) => {
      for (const item of lane) placed.push({ ...item, left: index / count, width: 1 / count });
    });

    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of sorted) {
    if (cluster.length > 0 && item.start >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();

  return placed;
}

export function WeekCalendar({
  days,
  courses,
  todayIso,
  classesByDate,
  timeZone,
}: {
  days: Day[];
  courses: CourseOption[];
  todayIso: string;
  classesByDate: Record<string, ClassRow[]>;
  timeZone: string;
}) {
  const [draft, setDraft] = useState<BlockDraft | null>(null);
  const [selectedDay, setSelectedDay] = useState(() =>
    Math.max(0, days.findIndex((d) => d.dateIso === todayIso)),
  );
  const [drag, setDrag] = useState<{ id: string; startMin: number; weekday: number } | null>(null);
  const [, startTransition] = useTransition();
  const gridRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    id: string;
    block: Block;
    pointerX: number;
    pointerY: number;
    moved: boolean;
    columnWidth: number;
  } | null>(null);

  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date());
      const [h, m] = parts.split(":").map(Number);
      setNowMin(h < 4 ? h * 60 + m + 1440 : h * 60 + m);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [timeZone]);

  const hours = Array.from({ length: SPAN / 60 + 1 }, (_, i) => GRID_START + i * 60);
  const top = (minutes: number) => (minutes - GRID_START) * PX_PER_MIN;

  function classSpan(c: ClassRow) {
    const start = minutesOf(c.startLabel);
    const end = minutesOf(c.endLabel);
    return { start, end: end > start ? end : start + 60 };
  }

  /** Items for one day, with the dragged block at its live position. */
  function itemsFor(day: Day): Item[] {
    const items: Item[] = (classesByDate[day.dateIso] ?? []).map((c) => {
      const span = classSpan(c);
      return { type: "class", key: c.id, start: span.start, end: span.end, data: c };
    });

    for (const d of days) {
      for (const b of d.blocks) {
        const dragging = drag?.id === b.id;
        const weekday = dragging ? drag.weekday : b.weekday;
        if (weekday !== day.weekday) continue;

        const start = dragging ? drag.startMin : minutesOf(b.startTime);
        items.push({ type: "block", key: b.id, start, end: start + b.minutes, data: b });
      }
    }
    return items;
  }

  /* ---------------- dragging ---------------- */

  function onPointerDown(e: React.PointerEvent, block: Block) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const columns = gridRef.current?.querySelectorAll("[data-column]");
    const columnWidth = columns?.[0]?.getBoundingClientRect().width ?? 0;

    gesture.current = {
      id: block.id,
      block,
      pointerX: e.clientX,
      pointerY: e.clientY,
      moved: false,
      columnWidth,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: block.id, startMin: minutesOf(block.startTime), weekday: block.weekday });
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g) return;

    const dy = e.clientY - g.pointerY;
    const dx = e.clientX - g.pointerX;
    if (!g.moved && Math.hypot(dx, dy) > 4) g.moved = true;
    if (!g.moved) return;
    e.preventDefault();

    const rawStart = minutesOf(g.block.startTime) + dy / PX_PER_MIN;
    const snapped = Math.round(rawStart / SNAP) * SNAP;
    const startMin = clamp(snapped, GRID_START, GRID_END - g.block.minutes);

    // Sideways only makes sense while every day is on screen.
    const acrossDays = days.length > 1 && g.columnWidth > 0 && window.innerWidth >= 768;
    const shift = acrossDays ? Math.round(dx / g.columnWidth) : 0;
    const index = clamp(days.findIndex((d) => d.weekday === g.block.weekday) + shift, 0, days.length - 1);

    setDrag({ id: g.id, startMin, weekday: days[index]?.weekday ?? g.block.weekday });
  }

  function onPointerUp() {
    const g = gesture.current;
    const state = drag;
    gesture.current = null;

    if (!g || !state) {
      setDrag(null);
      return;
    }

    if (!g.moved) {
      setDrag(null);
      setDraft({
        id: g.block.id,
        weekday: g.block.weekday,
        startTime: g.block.startTime,
        endTime: g.block.endTime,
        kind: g.block.kind,
        courseId: g.block.courseId,
      });
      return;
    }

    const unchanged = state.startMin === minutesOf(g.block.startTime) && state.weekday === g.block.weekday;
    if (unchanged) {
      setDrag(null);
      return;
    }

    const next = {
      id: g.block.id,
      weekday: state.weekday,
      startTime: labelOf(state.startMin),
      endTime: labelOf(state.startMin + g.block.minutes),
      kind: g.block.kind,
      courseId: g.block.courseId,
    };
    startTransition(async () => {
      await saveBlock(next);
      setDrag(null);
    });
  }

  const visibleDays = days.map((d, i) => ({ ...d, index: i }));

  return (
    <>
      {/* day picker, phones only */}
      <div className="mb-3 flex gap-1 overflow-x-auto md:hidden">
        {visibleDays.map((d) => (
          <button
            key={d.dateIso}
            type="button"
            onClick={() => setSelectedDay(d.index)}
            className={cn(
              "flex-1 rounded-md px-2 py-2 text-center text-xs font-semibold",
              d.index === selectedDay
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "bg-[var(--secondary)] text-[var(--muted-foreground)]",
            )}
          >
            {DAY_NAMES[d.weekday].slice(0, 3)}
            <span className="block font-mono text-[10px] font-normal opacity-80">
              {Number(d.dateIso.slice(8))}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        {/* headers, desktop only */}
        <div className="hidden border-b border-[var(--border)] pl-11 md:grid md:grid-cols-7">
          {visibleDays.map((d) => (
            <div
              key={d.dateIso}
              className={cn(
                "px-2 py-2 text-center font-mono text-[11px] uppercase tracking-[0.1em]",
                d.dateIso === todayIso ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]",
              )}
            >
              {DAY_NAMES[d.weekday].slice(0, 3)} {Number(d.dateIso.slice(8))}
            </div>
          ))}
        </div>

        <div
          className="relative flex pt-2"
          ref={gridRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* hour gutter */}
          <div className="relative w-11 shrink-0" style={{ height: SPAN * PX_PER_MIN }}>
            {hours.map((h) => (
              <span
                key={h}
                className="absolute right-1.5 -translate-y-1/2 font-mono text-[10px] tabular text-[var(--muted-foreground)]"
                style={{ top: top(h) }}
              >
                {labelOf(h)}
              </span>
            ))}
          </div>

          <div className={cn("grid flex-1", days.length > 1 ? "md:grid-cols-7" : "")}>
            {visibleDays.map((d) => {
              const hiddenOnPhone = d.index !== selectedDay;
              const placed = packColumns(itemsFor(d));

              return (
                <div
                  key={d.dateIso}
                  data-column
                  className={cn(
                    "relative border-l border-[var(--border)] first:border-l-0",
                    hiddenOnPhone && "hidden md:block",
                    d.dateIso === todayIso && "bg-[var(--accent)]/30",
                  )}
                  style={{ height: SPAN * PX_PER_MIN }}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="pointer-events-none absolute inset-x-0 border-t border-[var(--border)]/60"
                      style={{ top: top(h) }}
                    />
                  ))}

                  {d.dateIso === todayIso && nowMin !== null && nowMin >= GRID_START && nowMin <= GRID_END ? (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-30 border-t-2 border-[var(--live)]"
                      style={{ top: top(nowMin) }}
                    >
                      <span className="absolute -top-[3px] left-0 size-1.5 rounded-full bg-[var(--live)]" />
                    </div>
                  ) : null}

                  {placed.map((item) => {
                    const height = Math.max(20, (item.end - item.start) * PX_PER_MIN - 2);
                    const geometry = {
                      top: top(item.start),
                      height,
                      left: `calc(${item.left * 100}% + 2px)`,
                      width: `calc(${item.width * 100}% - 4px)`,
                    };
                    const roomy = height >= 46;
                    const tight = item.width < 0.6;

                    if (item.type === "class") {
                      const c = item.data;
                      return (
                        <div
                          key={item.key}
                          title={`${c.code} · ${c.kind}${c.location ? ` · ${c.location}` : ""} (from Sisu, fixed)`}
                          className="absolute z-10 cursor-not-allowed overflow-hidden rounded-md border border-dashed px-1.5 py-1"
                          style={{
                            ...geometry,
                            borderColor: c.courseColor ?? "var(--border)",
                            background: "color-mix(in srgb, var(--muted) 70%, transparent)",
                          }}
                        >
                          <p className="flex items-center gap-1 truncate text-[11px] font-semibold leading-tight">
                            <Lock className="size-2.5 shrink-0 opacity-60" />
                            <span className="truncate">{c.code}</span>
                          </p>
                          {height >= 30 ? (
                            <p className="truncate text-[10px] text-[var(--muted-foreground)]">{c.kind}</p>
                          ) : null}
                          {roomy && !tight && c.location ? (
                            <p className="truncate text-[10px] text-[var(--muted-foreground)]">{c.location}</p>
                          ) : null}
                        </div>
                      );
                    }

                    const b = item.data;
                    const dragging = drag?.id === b.id;
                    const clash = placed.some(
                      (other) =>
                        other.type === "class" && item.start < other.end && item.end > other.start,
                    );

                    return (
                      <div
                        key={item.key}
                        role="button"
                        tabIndex={0}
                        onPointerDown={(e) => onPointerDown(e, b)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDraft({
                              id: b.id,
                              weekday: b.weekday,
                              startTime: b.startTime,
                              endTime: b.endTime,
                              kind: b.kind,
                              courseId: b.courseId,
                            });
                          }
                        }}
                        className={cn(
                          "absolute z-20 touch-none select-none overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 shadow-sm",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                          dragging ? "cursor-grabbing opacity-90 ring-2 ring-[var(--ring)]" : "cursor-grab",
                          b.done && "opacity-55",
                        )}
                        style={{
                          ...geometry,
                          borderLeftColor: b.courseColor,
                          background: `color-mix(in srgb, ${b.courseColor} 18%, var(--card))`,
                          boxShadow: clash ? "inset 0 0 0 1px var(--destructive)" : undefined,
                        }}
                      >
                        <p className="truncate text-[11px] font-semibold leading-tight">{b.courseName}</p>
                        {height >= 30 ? (
                          <p className="truncate font-mono text-[10px] tabular text-[var(--muted-foreground)]">
                            {labelOf(item.start)} to {labelOf(item.end)}
                          </p>
                        ) : null}
                        {clash && roomy ? (
                          <p className="truncate text-[10px] font-medium text-[var(--destructive)]">
                            clashes with a class
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setDraft({
              weekday: days[selectedDay]?.weekday ?? 1,
              startTime: "23:00",
              endTime: "01:00",
              kind: "Study block",
              courseId: courses[0]?.id ?? null,
            })
          }
        >
          <Plus /> Add a block
        </Button>
        <p className="text-xs text-[var(--muted-foreground)]">
          Drag a study block to move it, tap to edit. Dashed blocks are timetabled classes and stay put.
        </p>
      </div>

      <BlockEditor draft={draft} courses={courses} onClose={() => setDraft(null)} />
    </>
  );
}
