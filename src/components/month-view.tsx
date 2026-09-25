import Link from "next/link";
import type { MonthDay } from "@/lib/month";
import { DAY_NAMES } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Monday-first order of DAY_NAMES indexes. */
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function describe(day: MonthDay) {
  const [, m, d] = day.dateIso.split("-").map(Number);
  const parts = [`${d} ${MONTHS[m - 1]}`];
  for (const e of day.exams) parts.push(`${e.title} at ${e.time}`);
  for (const x of day.deadlines) parts.push(`${x.title} due`);
  const prep = new Set(day.blocks.filter((b) => b.examTitle).map((b) => b.examTitle));
  if (prep.size) parts.push(`exam prep for ${[...prep].join(", ")}`);
  if (day.blocks.length) parts.push(`${day.blocks.length} study blocks`);
  if (day.classCount) parts.push(`${day.classCount} class${day.classCount === 1 ? "" : "es"}`);
  return parts.join(", ");
}

export function MonthView({ days }: { days: MonthDay[] }) {
  return (
    <>
      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        <div className="grid grid-cols-7 border-b border-[var(--border)]">
          {ORDER.map((wd) => (
            <div
              key={wd}
              className="py-2 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]"
            >
              <span className="md:hidden">{DAY_NAMES[wd].slice(0, 1)}</span>
              <span className="hidden md:inline">{DAY_NAMES[wd].slice(0, 3)}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const prep = [...new Map(day.blocks.filter((b) => b.examTitle).map((b) => [b.examTitle, b])).values()];
            return (
              <Link
                key={day.dateIso}
                href={`/week?week=${day.dateIso}`}
                aria-label={describe(day)}
                className={cn(
                  "flex min-h-20 min-w-0 flex-col gap-1 border-b border-l border-[var(--border)] p-1 transition-colors hover:bg-[var(--accent)] md:min-h-28 md:p-1.5",
                  "[&:nth-child(7n+1)]:border-l-0",
                  !day.inMonth && "opacity-40",
                  day.isToday && "bg-[var(--accent)]/40",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full font-mono text-xs tabular",
                    day.isToday && "bg-[var(--primary)] font-semibold text-[var(--primary-foreground)]",
                  )}
                >
                  {Number(day.dateIso.slice(8))}
                </span>

                {day.exams.map((e) => (
                  <span
                    key={e.id}
                    className={cn(
                      "truncate rounded px-1 py-0.5 text-[10px] font-semibold leading-tight md:text-[11px]",
                      e.done && "line-through opacity-60",
                    )}
                    style={{ background: `color-mix(in srgb, ${e.color} 28%, var(--card))`, color: "var(--foreground)" }}
                  >
                    <span className="hidden md:inline">{e.time} </span>
                    {e.title}
                  </span>
                ))}

                {day.deadlines.map((x) => (
                  <span
                    key={x.id}
                    className={cn(
                      "hidden items-center gap-1 truncate text-[11px] leading-tight md:flex",
                      x.done && "line-through opacity-60",
                    )}
                  >
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: x.color }} aria-hidden />
                    <span className="truncate">{x.title}</span>
                  </span>
                ))}

                {prep.length ? (
                  <span className="hidden truncate text-[10px] leading-tight text-[var(--muted-foreground)] md:block">
                    prep: {prep.map((b) => b.courseName).join(", ")}
                  </span>
                ) : null}

                <span className="mt-auto flex gap-0.5" aria-hidden>
                  {day.blocks.map((b) => (
                    <span
                      key={b.id}
                      className="h-1 flex-1 rounded-full"
                      style={{
                        background: b.courseColor,
                        opacity: day.isPast && !b.done ? 0.25 : 1,
                      }}
                    />
                  ))}
                </span>

                {day.classCount ? (
                  <span className="hidden text-[10px] text-[var(--muted-foreground)] md:block">
                    {day.classCount} class{day.classCount === 1 ? "" : "es"}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        Each bar is a study block in its course colour: from tonight on, the course the exam plan gives it; on past
        days, faint if it was not ticked off. Tap a day to open its week.
      </p>
    </>
  );
}
