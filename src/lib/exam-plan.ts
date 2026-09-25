import { prisma } from "@/lib/prisma";
import { listBlocks } from "@/lib/queries";
import {
  DEFAULT_PREP_DAYS,
  DEFAULT_PREP_HOURS,
  planExamPrep,
  type PlanExam,
  type PlanSlot,
} from "@/lib/planner";
import { minutesOf, shiftIsoDate, studyClock, weekdayOfIso, zonedToUtc } from "@/lib/time";

/** Nothing is planned further out than this, however far away an exam is. */
const HORIZON_DAYS = 120;

export type ExamCard = {
  id: string;
  title: string;
  courseId: string;
  courseName: string;
  courseColor: string;
  startsAt: Date;
  location: string | null;
  daysLeft: number;
  prepHours: number;
  prepDays: number;
  customTarget: boolean;
  loggedMinutes: number;
  plannedMinutes: number;
  targetMinutes: number;
  shortfallMinutes: number;
  windowStart: Date;
  /** Later sittings of the same course, taken only if this one is skipped. */
  laterSittings: { id: string; startsAt: Date }[];
};

export type Assignment = {
  examId: string;
  examTitle: string;
  courseId: string;
  courseName: string;
  courseColor: string;
};

export type PlanNight = {
  dateIso: string;
  slots: {
    blockId: string;
    startTime: string;
    endTime: string;
    minutes: number;
    kind: string;
    usual: { courseId: string | null; courseName: string; courseColor: string };
    exam: Assignment | null;
  }[];
};

export type ExamPlan = {
  exams: ExamCard[];
  /** Exams from Sisu whose course is not in the course list, so cannot be planned. */
  unlinked: { id: string; title: string; startsAt: Date }[];
  nights: PlanNight[];
  /** blockId -> assignment, keyed per study date. */
  byDate: Map<string, Map<string, Assignment>>;
};

export async function examPlan(userId: string, timeZone: string, now = new Date()): Promise<ExamPlan> {
  const rows = await prisma.deadline.findMany({
    where: { userId, kind: "exam", done: false, dueAt: { gt: now, lte: new Date(now.getTime() + HORIZON_DAYS * 86400_000) } },
    include: { course: { select: { id: true, name: true, color: true, archived: true } } },
    orderBy: { dueAt: "asc" },
  });

  // Sisu lists every sitting: the first exam and its retakes. Prepare for the
  // earliest one still open; ticking it off (taken or skipped) moves on.
  const chosen = new Map<string, (typeof rows)[number]>();
  const later = new Map<string, { id: string; startsAt: Date }[]>();
  const unlinked: ExamPlan["unlinked"] = [];
  for (const row of rows) {
    if (!row.courseId || !row.course || row.course.archived) {
      if (!unlinked.some((u) => u.title === row.title)) {
        unlinked.push({ id: row.id, title: row.title, startsAt: row.dueAt });
      }
      continue;
    }
    if (!chosen.has(row.courseId)) chosen.set(row.courseId, row);
    else later.set(row.courseId, [...(later.get(row.courseId) ?? []), { id: row.id, startsAt: row.dueAt }]);
  }
  const picked = [...chosen.values()];

  const empty: ExamPlan = { exams: [], unlinked, nights: [], byDate: new Map() };
  if (picked.length === 0) return empty;

  const clock = studyClock(now, timeZone);
  const lastExam = picked[picked.length - 1].dueAt;
  const lastDateIso = studyClock(lastExam, timeZone).dateIso;

  const settings = picked.map((row) => ({
    row,
    prepHours: row.prepHours ?? DEFAULT_PREP_HOURS,
    prepDays: row.prepDays ?? DEFAULT_PREP_DAYS,
  }));
  const windowStartIso = (prepDays: number, at: Date) =>
    studyClock(new Date(at.getTime() - prepDays * 86400_000), timeZone).dateIso;
  const earliestWindow = settings
    .map((s) => windowStartIso(s.prepDays, s.row.dueAt))
    .reduce((a, b) => (a < b ? a : b));

  const [blocks, ticks, sessions] = await Promise.all([
    listBlocks(userId),
    prisma.tick.findMany({
      where: { userId, onDate: { gte: clock.dateIso, lte: lastDateIso } },
      select: { blockId: true, onDate: true },
    }),
    prisma.studySession.findMany({
      where: {
        userId,
        endedAt: { not: null },
        onDate: { gte: earliestWindow },
        courseId: { in: picked.map((r) => r.courseId as string) },
      },
      select: { courseId: true, onDate: true, minutes: true },
    }),
  ]);

  // Every dated block from tonight to the last exam that has not already been
  // done or already ended.
  const done = new Set(ticks.map((t) => `${t.onDate}|${t.blockId}`));
  const blockById = new Map(blocks.map((b) => [b.id, b]));
  const slots: PlanSlot[] = [];
  for (let dateIso = clock.dateIso; dateIso <= lastDateIso; dateIso = shiftIsoDate(dateIso, 1)) {
    const weekday = weekdayOfIso(dateIso);
    for (const b of blocks) {
      if (b.weekday !== weekday || b.minutes <= 0 || done.has(`${dateIso}|${b.id}`)) continue;
      const startsAt = zonedToUtc(dateIso, minutesOf(b.startTime), timeZone);
      const endsAt = zonedToUtc(dateIso, minutesOf(b.startTime) + b.minutes, timeZone);
      if (endsAt <= now) continue;
      slots.push({
        blockId: b.id,
        dateIso,
        startTime: b.startTime,
        endTime: b.endTime,
        minutes: b.minutes,
        startsAt,
        endsAt,
        courseId: b.courseId,
      });
    }
  }

  const exams: PlanExam[] = settings.map(({ row, prepHours, prepDays }) => {
    const fromIso = windowStartIso(prepDays, row.dueAt);
    const logged = sessions
      .filter((s) => s.courseId === row.courseId && s.onDate >= fromIso)
      .reduce((sum, s) => sum + s.minutes, 0);
    return {
      id: row.id,
      courseId: row.courseId as string,
      title: row.title,
      startsAt: row.dueAt,
      prepMinutes: prepHours * 60,
      prepDays,
      loggedMinutes: logged,
    };
  });

  const result = planExamPrep(slots, exams);
  const progress = new Map(result.progress.map((p) => [p.examId, p]));
  const assignmentFor = new Map<string, Assignment>(
    picked.map((row) => [
      row.id,
      {
        examId: row.id,
        examTitle: row.title,
        courseId: row.course!.id,
        courseName: row.course!.name,
        courseColor: row.course!.color,
      },
    ]),
  );

  const cards: ExamCard[] = settings.map(({ row, prepHours, prepDays }) => {
    const p = progress.get(row.id)!;
    const exam = exams.find((e) => e.id === row.id)!;
    return {
      id: row.id,
      title: row.title,
      courseId: row.course!.id,
      courseName: row.course!.name,
      courseColor: row.course!.color,
      startsAt: row.dueAt,
      location: row.notes,
      daysLeft: Math.ceil((row.dueAt.getTime() - now.getTime()) / 86400_000),
      prepHours,
      prepDays,
      customTarget: row.prepHours !== null || row.prepDays !== null,
      loggedMinutes: exam.loggedMinutes,
      plannedMinutes: p.plannedMinutes,
      targetMinutes: exam.prepMinutes,
      shortfallMinutes: p.shortfallMinutes,
      windowStart: p.windowStart,
      laterSittings: later.get(row.courseId as string) ?? [],
    };
  });

  const byDate = new Map<string, Map<string, Assignment>>();
  const nightMap = new Map<string, PlanNight>();
  for (const s of result.slots) {
    const b = blockById.get(s.blockId)!;
    const exam = s.examId ? assignmentFor.get(s.examId)! : null;
    if (exam) {
      const day = byDate.get(s.dateIso) ?? new Map<string, Assignment>();
      day.set(s.blockId, exam);
      byDate.set(s.dateIso, day);
    }
    const night = nightMap.get(s.dateIso) ?? { dateIso: s.dateIso, slots: [] };
    night.slots.push({
      blockId: s.blockId,
      startTime: s.startTime,
      endTime: s.endTime,
      minutes: s.minutes,
      kind: b.kind,
      usual: { courseId: b.courseId, courseName: b.courseName, courseColor: b.courseColor },
      exam,
    });
    nightMap.set(s.dateIso, night);
  }

  return { exams: cards, unlinked, nights: [...nightMap.values()], byDate };
}

/** What a block is for on one night: the exam plan wins over the template. */
export function applyPlan<
  T extends { id: string; courseId: string | null; courseName: string; courseColor: string },
>(dateIso: string, blocks: T[], plan: ExamPlan | null) {
  const day = plan?.byDate.get(dateIso);
  return blocks.map((b) => {
    const a = day?.get(b.id);
    return a
      ? { ...b, courseId: a.courseId, courseName: a.courseName, courseColor: a.courseColor, examTitle: a.examTitle }
      : { ...b, examTitle: null as string | null };
  });
}
