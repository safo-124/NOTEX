import Link from "next/link";
import { currentUserId } from "@/lib/auth";
import { getUserTimezone } from "@/lib/queries";
import { examPlan } from "@/lib/exam-plan";
import { DAY_NAMES, formatHours, prettyDate, shiftIsoDate, studyClock, weekdayOfIso } from "@/lib/time";
import { PageHead } from "@/components/page-head";
import { ExamPrepCard } from "@/components/exam-prep-card";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/** How far ahead the night-by-night list reaches. The plan itself goes further. */
const LIST_DAYS = 14;

export default async function ExamsPage() {
  const userId = await currentUserId();
  const tz = await getUserTimezone(userId);
  const now = new Date();
  const plan = await examPlan(userId, tz, now);
  const today = studyClock(now, tz).dateIso;

  const when = (at: Date) =>
    at.toLocaleString("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const day = (at: Date) => at.toLocaleDateString("en-GB", { timeZone: tz, day: "numeric", month: "short" });

  const nights = plan.nights
    .filter((n) => n.dateIso <= shiftIsoDate(today, LIST_DAYS - 1))
    .map((n) => ({ ...n, slots: n.slots.filter((s) => s.exam) }))
    .filter((n) => n.slots.length > 0);

  return (
    <>
      <PageHead
        eyebrow="Exam prep"
        title={
          plan.exams.length
            ? `${plan.exams.length} exam${plan.exams.length === 1 ? "" : "s"} to prepare for`
            : "No exams coming up"
        }
      />

      {plan.exams.length === 0 ? (
        <Card className="mb-6 p-5 text-sm text-[var(--muted-foreground)]">
          Exams you are registered for in Sisu arrive here on the next sync. You can also add one by hand under
          Due soon on{" "}
          <Link href="/tonight" className="underline">
            Tonight
          </Link>
          , with the kind set to Exam.
        </Card>
      ) : (
        <div className="mb-8 flex flex-col gap-3">
          {plan.exams.map((e) => (
            <ExamPrepCard
              key={e.id}
              id={e.id}
              title={e.title}
              courseName={e.courseName}
              courseColor={e.courseColor}
              whenLabel={when(e.startsAt)}
              daysLeft={e.daysLeft}
              location={e.location}
              prepHours={e.prepHours}
              prepDays={e.prepDays}
              loggedMinutes={e.loggedMinutes}
              plannedMinutes={e.plannedMinutes}
              targetMinutes={e.targetMinutes}
              shortfallMinutes={e.shortfallMinutes}
              startsLabel={e.windowStart > now ? day(e.windowStart) : null}
              nextSittingLabel={e.laterSittings[0] ? day(e.laterSittings[0].startsAt) : null}
            />
          ))}
        </div>
      )}

      {plan.exams.length ? (
        <section className="mb-8">
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            The next {LIST_DAYS} nights
          </h2>
          {nights.length === 0 ? (
            <Card className="p-4 text-sm text-[var(--muted-foreground)]">
              Your blocks keep their usual courses for now. Exam preparation starts closer to the date.
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {nights.map((n) => (
                <Card key={n.dateIso} className="p-3">
                  <p className="mb-2 text-sm font-semibold">
                    {n.dateIso === today ? "Tonight" : DAY_NAMES[weekdayOfIso(n.dateIso)]}{" "}
                    <span className="font-normal text-[var(--muted-foreground)]">{prettyDate(n.dateIso)}</span>
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {n.slots.map((s) => (
                      <li key={s.blockId} className="flex items-center gap-3 text-sm">
                        <span className="w-24 shrink-0 font-mono text-xs tabular text-[var(--muted-foreground)]">
                          {s.startTime}–{s.endTime}
                        </span>
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: s.exam!.courseColor }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">{s.exam!.courseName}</span>
                        <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                          {s.usual.courseId === s.exam!.courseId ? formatHours(s.minutes) : `instead of ${s.usual.courseName}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {plan.unlinked.length ? (
        <section className="mb-8">
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            Not planned yet
          </h2>
          <Card className="p-4 text-sm">
            <p className="mb-2 text-[var(--muted-foreground)]">
              These exams belong to courses that are not in your list. Add the course with its Sisu code on{" "}
              <Link href="/courses" className="underline">
                Courses
              </Link>{" "}
              and sync, and they join the plan.
            </p>
            <ul className="flex flex-col gap-1">
              {plan.unlinked.map((u) => (
                <li key={u.id} className="flex justify-between gap-3">
                  <span className="truncate">{u.title}</span>
                  <span className="shrink-0 font-mono text-xs text-[var(--muted-foreground)]">{day(u.startsAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <p className="text-sm text-[var(--muted-foreground)]">
        The plan keeps your weekly blocks and decides what each one is for. It spreads each exam&apos;s hours evenly
        across its preparation window, gives a block to whichever exam is furthest behind, and stops eight hours before
        an exam so you sleep first. Hours you log with the timer count, so a missed night is spread over the rest.
      </p>
    </>
  );
}
