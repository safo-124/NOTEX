import Link from "next/link";
import { currentUserId } from "@/lib/auth";
import { getUserTimezone, weekSnapshot } from "@/lib/queries";
import { DAY_NAMES, formatHours, prettyDate } from "@/lib/time";
import { PageHead } from "@/components/page-head";
import { LiveStatus } from "@/components/live-status";
import { TickButton } from "@/components/tick-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function TonightPage() {
  const userId = await currentUserId();
  const tz = await getUserTimezone(userId);

  const snap = await weekSnapshot(userId, new Date(), tz);
  const today = snap.days.find((d) => d.dateIso === snap.clock.dateIso);
  const blocks = today?.blocks ?? [];

  const nightCourses = [
    ...new Set(blocks.filter((b) => b.startTime >= "20:00" || b.startTime < "12:00").map((b) => b.courseName)),
  ];

  return (
    <>
      <PageHead
        eyebrow={`${DAY_NAMES[snap.clock.weekday]} ${prettyDate(snap.clock.dateIso)}`}
        title={nightCourses.length ? nightCourses.join(" and ") : "Nothing scheduled tonight"}
      />

      <div className="mb-5">
        <LiveStatus blocks={blocks} timeZone={tz} />
      </div>

      <div className="flex flex-col gap-2.5">
        {blocks.map((b) => (
          <Card
            key={b.id}
            className="flex items-center gap-3 border-l-[3px] p-3.5"
            style={{ borderLeftColor: b.courseColor }}
          >
            <div className="w-14 shrink-0 font-mono text-xs tabular text-[var(--muted-foreground)]">
              <div>{b.startTime}</div>
              <div>{b.endTime}</div>
            </div>
            <div className="min-w-0 flex-1">
              <p className={b.done ? "font-semibold line-through opacity-60" : "font-semibold"}>
                {b.courseName}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {b.kind} · {formatHours(b.minutes)}
              </p>
              {b.courseCode ? (
                <p className="font-mono text-[11px]" style={{ color: b.courseColor }}>
                  {b.courseCode}
                </p>
              ) : null}
            </div>
            <TickButton
              blockId={b.id}
              onDate={b.dateIso}
              done={b.done}
              label={b.courseName}
              color={b.courseColor}
            />
          </Card>
        ))}

        {blocks.length === 0 ? (
          <Card className="p-5 text-sm text-[var(--muted-foreground)]">
            No blocks for {DAY_NAMES[snap.clock.weekday]}.{" "}
            <Link href="/week" className="underline">
              Add one in the week plan
            </Link>
            .
          </Card>
        ) : null}
      </div>

      <section className="mt-8 border-t border-[var(--border)] pt-5">
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          This week so far
        </h2>
        <div className="flex flex-wrap gap-2">
          {snap.courses.map((c) => {
            const t = snap.perCourse.get(c.id) ?? { planned: 0, done: 0 };
            if (!t.planned) return null;
            return (
              <Badge key={c.id} style={{ color: c.color, borderColor: c.color }}>
                {c.name.split(" ").slice(0, 2).join(" ")} {formatHours(t.done)}/{formatHours(t.planned)}
              </Badge>
            );
          })}
        </div>
      </section>

      <p className="mt-6 text-sm text-[var(--muted-foreground)]">
        A night belongs to the day it starts, so this page only rolls over at 04:00.
      </p>
    </>
  );
}
