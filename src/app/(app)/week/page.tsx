import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentUserId } from "@/lib/auth";
import { classesBetween, getUserTimezone, groupClassesByDate, weekSnapshot } from "@/lib/queries";
import { applyPlan, examPlan } from "@/lib/exam-plan";
import { monthSnapshot } from "@/lib/month";
import { mondayOfIso, prettyDate, shiftIsoDate, studyClock } from "@/lib/time";
import { PageHead } from "@/components/page-head";
import { MonthView } from "@/components/month-view";
import { WeekNav } from "@/components/week-nav";
import { WeekView } from "@/components/week-view";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Week or month, as links so either view keeps its place in the URL. */
function ViewSwitch({ view, weekHref, monthHref }: { view: "week" | "month"; weekHref: string; monthHref: string }) {
  const tab = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm font-medium",
      active ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)]",
    );
  return (
    <div className="mb-4 inline-flex gap-1 rounded-lg bg-[var(--secondary)] p-1">
      <Link href={weekHref} className={tab(view === "week")} aria-current={view === "week" ? "page" : undefined}>
        Week
      </Link>
      <Link href={monthHref} className={tab(view === "month")} aria-current={view === "month" ? "page" : undefined}>
        Month
      </Link>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; view?: string; month?: string }>;
}) {
  const { week, view, month } = await searchParams;
  const userId = await currentUserId();
  const tz = await getUserTimezone(userId);

  if (view === "month") return <MonthPage userId={userId} tz={tz} month={month} />;

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
      <ViewSwitch
        view="week"
        weekHref={`/week?week=${snap.mondayIso}`}
        monthHref={`/week?view=month&month=${snap.mondayIso.slice(0, 7)}`}
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

async function MonthPage({ userId, tz, month }: { userId: string; tz: string; month?: string }) {
  const now = new Date();
  const thisMonth = studyClock(now, tz).dateIso.slice(0, 7);
  const valid = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : thisMonth;
  const snap = await monthSnapshot(userId, tz, valid, now);
  const [y, m] = valid.split("-").map(Number);
  const isCurrent = valid === thisMonth;
  const icon = buttonVariants({ variant: "outline", size: "icon" });

  return (
    <>
      <PageHead eyebrow={isCurrent ? "This month" : String(y)} title={`${MONTH_NAMES[m - 1]} ${y}`} />
      <ViewSwitch
        view="month"
        // The first of the month, or today when it is this month.
        weekHref={`/week?week=${isCurrent ? studyClock(now, tz).dateIso : snap.first}`}
        monthHref={`/week?view=month&month=${valid}`}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/week?view=month&month=${shiftMonth(valid, -1)}`} className={icon} aria-label="Previous month">
          <ChevronLeft />
        </Link>
        <Link href={`/week?view=month&month=${shiftMonth(valid, 1)}`} className={icon} aria-label="Next month">
          <ChevronRight />
        </Link>
        <Link
          href="/week?view=month"
          aria-disabled={isCurrent}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), isCurrent && "pointer-events-none opacity-50")}
        >
          This month
        </Link>
      </div>
      <MonthView days={snap.days} />
    </>
  );
}
