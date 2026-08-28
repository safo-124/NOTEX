import { prisma } from "@/lib/prisma";

/**
 * The autumn 2026 plan, applied once when an account is still empty.
 *
 * Deliberately NOT a server action: the app layout calls it while rendering,
 * and revalidatePath during a render is unsupported. There is nothing to
 * revalidate anyway, since this runs before the first paint of a new account.
 */
export async function ensureDefaultPlan(userId: string) {
  const existing = await prisma.course.count({ where: { userId } });
  if (existing > 0) return;

  const seedCourses = [
    { key: "sgn100", name: "Introduction to Signal Processing", code: "COMP.SGN.100", color: "var(--chart-1)", focus: true },
    { key: "sgn350", name: "Imaging Sensors and Systems", code: "COMP.SGN.350", color: "var(--chart-2)", focus: true },
    { key: "comm300", name: "Communication Theory", code: "COMM.SYS.300", color: "var(--chart-3)", focus: false },
    { key: "itc300", name: "Statistical Signal Processing", code: "ITC.CEE.300", color: "var(--chart-4)", focus: false },
    { key: "fi5", name: "Finnish 5", code: "Suomi 5", color: "var(--chart-5)", focus: false },
    { key: "review", name: "Review and problem sets", code: "All courses", color: "var(--chart-6)", focus: false },
  ];

  const ids = new Map<string, string>();
  for (const [i, c] of seedCourses.entries()) {
    const row = await prisma.course.create({
      data: { userId, name: c.name, code: c.code, color: c.color, focus: c.focus, position: i },
      select: { id: true },
    });
    ids.set(c.key, row.id);
  }

  const plan: Array<[number, string, string, string, string]> = [
    [1, "20:00", "22:30", "sgn100", "Lectures and reading"],
    [1, "23:00", "01:00", "sgn100", "Deep block 1"],
    [1, "01:15", "03:00", "comm300", "Deep block 2"],
    [2, "20:00", "22:30", "sgn350", "Lectures and reading"],
    [2, "23:00", "01:00", "sgn350", "Deep block 1"],
    [2, "01:15", "03:00", "fi5", "Deep block 2"],
    [3, "20:00", "22:30", "itc300", "Lectures and reading"],
    [3, "23:00", "01:00", "sgn100", "Deep block 1"],
    [3, "01:15", "03:00", "itc300", "Deep block 2"],
    [4, "20:00", "22:30", "comm300", "Lectures and reading"],
    [4, "23:00", "01:00", "sgn350", "Deep block 1"],
    [4, "01:15", "03:00", "comm300", "Deep block 2"],
    [5, "20:00", "22:30", "sgn100", "Lectures and reading"],
    [5, "23:00", "01:00", "sgn100", "Deep block 1"],
    [5, "01:15", "03:00", "sgn350", "Deep block 2"],
    [6, "20:00", "22:30", "sgn350", "Lectures and reading"],
    [6, "23:00", "01:00", "sgn350", "Deep block 1"],
    [6, "01:15", "03:00", "itc300", "Deep block 2"],
    [0, "20:00", "22:30", "review", "Catch-up reading"],
    [0, "23:00", "01:00", "sgn100", "Deep block 1"],
    [0, "01:15", "03:00", "review", "Deep block 2"],
  ];

  await prisma.block.createMany({
    data: plan.map(([weekday, startTime, endTime, key, kind]) => ({
      userId,
      weekday,
      startTime,
      endTime,
      courseId: ids.get(key) ?? null,
      kind,
    })),
  });
}
