import Link from "next/link";
import { currentUserId } from "@/lib/auth";
import { classesBetween, getUserTimezone, groupClassesByDate, weekSnapshot } from "@/lib/queries";
import { prettyDate, shiftIsoDate } from "@/lib/time";
import { PageHead } from "@/components/page-head";
import { WeekView } from "@/components/week-view";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function WeekPage() {
  const userId = await currentUserId();
  const tz = await getUserTimezone(userId);
  const snap = await weekSnapshot(userId, new Date(), tz);
  const classes = await classesBetween(userId, snap.mondayIso, shiftIsoDate(snap.mondayIso, 6), tz);
  const classesByDate = Object.fromEntries(groupClassesByDate(classes));

  return (
    <>
      <PageHead
        eyebrow={`${prettyDate(snap.mondayIso)} to ${prettyDate(shiftIsoDate(snap.mondayIso, 6))}`}
        title="Your week"
        action={
          <Link
            href="/courses"
            className={buttonVariants({ variant: "outline", size: "sm", className: "hidden sm:inline-flex" })}
          >
            Courses
          </Link>
        }
      />
      <WeekView
        days={snap.days}
        courses={snap.courses.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
        todayIso={snap.clock.dateIso}
        classesByDate={classesByDate}
        timeZone={tz}
      />
      <p className="mt-6 text-sm text-[var(--muted-foreground)]">
        Drag a study block to move it. Classes come from Sisu and cannot be moved here.
      </p>
    </>
  );
}
