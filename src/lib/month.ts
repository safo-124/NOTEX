import { prisma } from "@/lib/prisma";
import { classesBetween, listBlocks } from "@/lib/queries";
import { examPlan } from "@/lib/exam-plan";
import { isoDate, mondayOfIso, shiftIsoDate, studyClock, weekdayOfIso, zonedParts } from "@/lib/time";

export type MonthDay = {
  dateIso: string;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  blocks: { id: string; courseName: string; courseColor: string; minutes: number; done: boolean; examTitle: string | null }[];
  exams: { id: string; title: string; time: string; color: string; done: boolean }[];
  deadlines: { id: string; title: string; color: string; done: boolean }[];
  classCount: number;
};

/** "2026-10" -> the grid of whole weeks covering that month, with each day filled in. */
export async function monthSnapshot(userId: string, timeZone: string, month: string, now = new Date()) {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const last = isoDate(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate());
  const gridStart = mondayOfIso(first);
  const gridEnd = shiftIsoDate(mondayOfIso(last), 6);
  const today = studyClock(now, timeZone).dateIso;

  const calendarDay = (at: Date) => {
    const p = zonedParts(at, timeZone);
    return isoDate(p.year, p.month, p.day);
  };
  const clock = (at: Date) => {
    const p = zonedParts(at, timeZone);
    return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  };

  const [blocks, ticks, deadlines, classes, plan] = await Promise.all([
    listBlocks(userId),
    prisma.tick.findMany({
      where: { userId, onDate: { gte: gridStart, lte: gridEnd } },
      select: { blockId: true, onDate: true },
    }),
    prisma.deadline.findMany({
      where: {
        userId,
        // A day either side, so every deadline that lands in the grid in the
        // user's own timezone is fetched.
        dueAt: { gte: new Date(`${shiftIsoDate(gridStart, -1)}T00:00:00Z`), lte: new Date(`${shiftIsoDate(gridEnd, 1)}T23:59:59Z`) },
      },
      include: { course: { select: { color: true } } },
      orderBy: { dueAt: "asc" },
    }),
    classesBetween(userId, gridStart, gridEnd, timeZone),
    // The plan runs forward from tonight, so a month already over needs none.
    gridEnd >= today ? examPlan(userId, timeZone, now) : null,
  ]);

  const done = new Set(ticks.map((t) => `${t.onDate}|${t.blockId}`));
  const days: MonthDay[] = [];
  for (let d = gridStart; d <= gridEnd; d = shiftIsoDate(d, 1)) {
    const weekday = weekdayOfIso(d);
    const assigned = plan?.byDate.get(d);
    days.push({
      dateIso: d,
      inMonth: d >= first && d <= last,
      isToday: d === today,
      isPast: d < today,
      blocks: blocks
        .filter((b) => b.weekday === weekday)
        .map((b) => {
          const a = assigned?.get(b.id);
          return {
            id: b.id,
            courseName: a?.courseName ?? b.courseName,
            courseColor: a?.courseColor ?? b.courseColor,
            minutes: b.minutes,
            done: done.has(`${d}|${b.id}`),
            examTitle: a?.examTitle ?? null,
          };
        }),
      exams: [],
      deadlines: [],
      classCount: 0,
    });
  }

  const byDate = new Map(days.map((d) => [d.dateIso, d]));
  for (const row of deadlines) {
    const day = byDate.get(calendarDay(row.dueAt));
    if (!day) continue;
    const color = row.course?.color ?? "var(--chart-6)";
    if (row.kind === "exam") day.exams.push({ id: row.id, title: row.title, time: clock(row.dueAt), color, done: row.done });
    else day.deadlines.push({ id: row.id, title: row.title, color, done: row.done });
  }
  for (const c of classes) {
    const day = byDate.get(c.dateIso);
    if (day && c.kind !== "Exam") day.classCount++;
  }

  return { first, last, days };
}
