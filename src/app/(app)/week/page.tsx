import Link from "next/link";
import { auth } from "@/lib/auth";
import { getUserTimezone, weekSnapshot } from "@/lib/queries";
import { prettyDate, shiftIsoDate } from "@/lib/time";
import { PageHead } from "@/components/page-head";
import { WeekPlanner } from "@/components/week-planner";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function WeekPage() {
  const session = await auth();
  const userId = session!.user!.id as string;
  const tz = await getUserTimezone(userId);
  const snap = await weekSnapshot(userId, new Date(), tz);

  return (
    <>
      <PageHead
        eyebrow={`${prettyDate(snap.mondayIso)} to ${prettyDate(shiftIsoDate(snap.mondayIso, 6))}`}
        title="Seven nights"
        action={
          <Link
            href="/courses"
            className={buttonVariants({ variant: "outline", size: "sm", className: "hidden sm:inline-flex" })}
          >
            Courses
          </Link>
        }
      />
      <WeekPlanner
        days={snap.days}
        courses={snap.courses.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
        todayIso={snap.clock.dateIso}
      />
      <p className="mt-6 text-sm text-[var(--muted-foreground)]">
        Tap a line to change its course, times or label. Changes apply to every week from now on.
      </p>
    </>
  );
}
