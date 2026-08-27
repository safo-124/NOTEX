import { prisma } from "@/lib/prisma";
import { durationMinutes, minutesOf, mondayOfIso, shiftIsoDate, studyClock, weekdayOfIso } from "@/lib/time";

export type BlockWithCourse = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  kind: string;
  minutes: number;
  courseId: string | null;
  courseName: string;
  courseCode: string;
  courseColor: string;
};

export async function listCourses(userId: string) {
  return prisma.course.findMany({
    where: { userId, archived: false },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}

export async function listBlocks(userId: string): Promise<BlockWithCourse[]> {
  const rows = await prisma.block.findMany({
    where: { userId },
    include: { course: { select: { name: true, code: true, color: true } } },
  });

  return rows
    .map((r) => ({
      id: r.id,
      weekday: r.weekday,
      startTime: r.startTime,
      endTime: r.endTime,
      kind: r.kind,
      minutes: durationMinutes(r.startTime, r.endTime),
      courseId: r.courseId,
      courseName: r.course?.name ?? "Unassigned",
      courseCode: r.course?.code ?? "",
      courseColor: r.course?.color ?? "var(--chart-6)",
    }))
    .sort((a, b) =>
      a.weekday === b.weekday ? minutesOf(a.startTime) - minutesOf(b.startTime) : a.weekday - b.weekday,
    );
}

export function blocksForWeekday(all: BlockWithCourse[], weekday: number) {
  return all.filter((b) => b.weekday === weekday);
}

export async function ticksForWeek(userId: string, mondayIso: string) {
  return prisma.tick.findMany({
    where: { userId, onDate: { gte: mondayIso, lte: shiftIsoDate(mondayIso, 6) } },
    select: { blockId: true, onDate: true, minutes: true },
  });
}

/** Everything the schedule screens need, in three queries. */
export async function weekSnapshot(userId: string, at: Date, timeZone: string) {
  const clock = studyClock(at, timeZone);
  const mondayIso = mondayOfIso(clock.dateIso);

  const [allBlocks, tickRows, courses] = await Promise.all([
    listBlocks(userId),
    ticksForWeek(userId, mondayIso),
    listCourses(userId),
  ]);

  const doneKeys = new Set(tickRows.map((t) => `${t.onDate}|${t.blockId}`));
  const days = Array.from({ length: 7 }, (_, i) => {
    const dateIso = shiftIsoDate(mondayIso, i);
    const weekday = weekdayOfIso(dateIso);
    return {
      dateIso,
      weekday,
      blocks: blocksForWeekday(allBlocks, weekday).map((b) => ({
        ...b,
        dateIso,
        done: doneKeys.has(`${dateIso}|${b.id}`),
      })),
    };
  });

  const perCourse = new Map<string, { planned: number; done: number }>();
  for (const day of days) {
    for (const b of day.blocks) {
      const key = b.courseId ?? "unassigned";
      const cur = perCourse.get(key) ?? { planned: 0, done: 0 };
      cur.planned += b.minutes;
      if (b.done) cur.done += b.minutes;
      perCourse.set(key, cur);
    }
  }

  return { clock, mondayIso, days, courses, perCourse, allBlocks };
}

export async function searchNotes(userId: string, q: string, courseId?: string) {
  const term = q.trim();
  const rows = await prisma.note.findMany({
    where: {
      userId,
      ...(courseId ? { courseId } : {}),
      ...(term
        ? {
            OR: [
              { title: { contains: term, mode: "insensitive" as const } },
              { body: { contains: term, mode: "insensitive" as const } },
              { tags: { has: term } },
            ],
          }
        : {}),
    },
    include: { course: { select: { name: true, color: true } } },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: 200,
  });

  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    tags: n.tags,
    pinned: n.pinned,
    onDate: n.onDate,
    updatedAt: n.updatedAt,
    courseId: n.courseId,
    courseName: n.course?.name ?? null,
    courseColor: n.course?.color ?? null,
  }));
}

export async function listFiles(userId: string, courseId?: string) {
  const rows = await prisma.fileAsset.findMany({
    where: { userId, ...(courseId ? { courseId } : {}) },
    include: { course: { select: { name: true, color: true } } },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    contentType: f.contentType,
    createdAt: f.createdAt,
    courseId: f.courseId,
    courseName: f.course?.name ?? null,
    courseColor: f.course?.color ?? null,
  }));
}

export type AlertChannels = { email: boolean; telegram: boolean; whatsapp: boolean };

export async function getAlertPrefs(userId: string) {
  const row = await prisma.alertPref.findUnique({ where: { userId } });
  if (!row) return null;
  // `channels` is a Json column, so it comes back untyped.
  return { ...row, channels: (row.channels ?? {}) as Partial<AlertChannels> };
}

export async function getUserTimezone(userId: string) {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return me?.timezone ?? "Europe/Helsinki";
}
