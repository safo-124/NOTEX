import Link from "next/link";
import { currentUserId } from "@/lib/auth";
import { classesBetween, getUserTimezone, groupClassesByDate, weekSnapshot } from "@/lib/queries";
import { applyPlan, examPlan } from "@/lib/exam-plan";
import { mondayOfIso, prettyDate, shiftIsoDate } from "@/lib/time";
import { PageHead } from "@/components/page-head";
import { WeekNav } from "@/components/week-nav";
import { WeekView } from "@/components/week-view";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const userId = await currentUserId();
  const tz = await getUserTimezone(userId);

  // Any date in the wanted week; a malformed one falls back to this week.
  const weekOf = week && /^\d{4}-\d{2}-\d{2}$/.test(week) && !Number.isNaN(Date.parse(week)) ? week : undefined;
  const now = new Date();
  const snap = await weekSnapshot(userId, now, tz, weekOf);
  const sunday = shiftIsoDate(snap.mondayIso, 6);
  const isCurrent = snap.mondayIso === mondayOfIso(snap.clock.dateIso);

  const [classes, plan] = await Promise.all([
    classesBetween(userId, snap.mondayIso, sunday, tz),
    // The plan only runs forward from tonight, so a past week has nothing to show.
    sunday >= snap.clock.dateIso ? examPlan(userId, tz, now) : null,
  ]);
  const classesByDate = Object.fromEntries(groupClassesByDate(classes));

  // Show what each block is for on that date, but keep the template's course
  // on the block: editing or dragging it changes the weekly template.
  const days = snap.days.map((d) => ({
    ...d,
    blocks: applyPlan(d.dateIso, d.blocks, plan).map((b, i) => ({ ...b, courseId: d.blocks[i].courseId })),
  }));

  return (
    <>
      <PageHead
        eyebrow={`${prettyDate(snap.mondayIso)} to ${prettyDate(sunday)}`}
        title={isCurrent ? "Your week" : snap.mondayIso < snap.clock.dateIso ? "A past week" : "A week ahead"}
        action={
          <Link
            href="/courses"
            className={buttonVariants({ variant: "outline", size: "sm", className: "hidden sm:inline-flex" })}
          >
            Courses
          </Link>
        }
      />
      <WeekNav
        mondayIso={snap.mondayIso}
        prevIso={shiftIsoDate(snap.mondayIso, -7)}
        nextIso={shiftIsoDate(snap.mondayIso, 7)}
        isCurrent={isCurrent}
      />
      <WeekView
        key={snap.mondayIso}
        days={days}
        courses={snap.courses.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
        todayIso={snap.clock.dateIso}
        classesByDate={classesByDate}
        timeZone={tz}
      />
      <p className="mt-6 text-sm text-[var(--muted-foreground)]">
        Your study blocks are one weekly template, so moving or editing a block changes it in every week. Close to an
        exam, a block shows the course the exam plan gives it that night. Classes come from Sisu and cannot be moved
        here.
      </p>
    </>
  );
}
