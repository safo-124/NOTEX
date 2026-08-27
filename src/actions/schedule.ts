"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { durationMinutes } from "@/lib/time";

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const courseInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  code: z.string().max(60).default(""),
  color: z.string().max(60).default("var(--chart-1)"),
  focus: z.coerce.boolean().default(false),
});

export async function saveCourse(input: z.input<typeof courseInput>) {
  const user = await requireUser();
  const data = courseInput.parse(input);

  if (data.id) {
    await prisma.course.updateMany({
      where: { id: data.id, userId: user.id },
      data: { name: data.name, code: data.code, color: data.color, focus: data.focus },
    });
  } else {
    const count = await prisma.course.count({ where: { userId: user.id } });
    await prisma.course.create({
      data: {
        userId: user.id,
        name: data.name,
        code: data.code,
        color: data.color,
        focus: data.focus,
        position: count,
      },
    });
  }
  revalidatePath("/", "layout");
}

export async function deleteCourse(id: string) {
  const user = await requireUser();
  await prisma.course.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/", "layout");
}

const blockInput = z.object({
  id: z.string().uuid().optional(),
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(timeRe),
  endTime: z.string().regex(timeRe),
  courseId: z.string().uuid().nullable().optional(),
  kind: z.string().max(80).default("Study block"),
});

export async function saveBlock(input: z.input<typeof blockInput>) {
  const user = await requireUser();
  const data = blockInput.parse(input);
  if (durationMinutes(data.startTime, data.endTime) === 0) {
    throw new Error("A block must end after it starts. Times before noon count as after midnight.");
  }

  const values = {
    weekday: data.weekday,
    startTime: data.startTime,
    endTime: data.endTime,
    courseId: data.courseId ?? null,
    kind: data.kind,
  };

  if (data.id) {
    await prisma.block.updateMany({ where: { id: data.id, userId: user.id }, data: values });
  } else {
    await prisma.block.create({ data: { ...values, userId: user.id } });
  }
  revalidatePath("/", "layout");
}

export async function deleteBlock(id: string) {
  const user = await requireUser();
  await prisma.block.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/", "layout");
}

export async function toggleTick(blockId: string, onDate: string) {
  const user = await requireUser();

  const existing = await prisma.tick.findUnique({
    where: { blockId_onDate: { blockId, onDate } },
    select: { id: true, userId: true },
  });

  if (existing) {
    if (existing.userId !== user.id) throw new Error("Not yours");
    await prisma.tick.delete({ where: { id: existing.id } });
  } else {
    const block = await prisma.block.findFirst({
      where: { id: blockId, userId: user.id },
      select: { startTime: true, endTime: true },
    });
    if (!block) throw new Error("Block not found");
    await prisma.tick.create({
      data: {
        userId: user.id,
        blockId,
        onDate,
        minutes: durationMinutes(block.startTime, block.endTime),
      },
    });
  }
  revalidatePath("/", "layout");
}

/** The autumn 2026 plan, applied once when an account is still empty. */
export async function seedDefaultPlan() {
  const user = await requireUser();
  const existing = await prisma.course.count({ where: { userId: user.id } });
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
      data: { userId: user.id, name: c.name, code: c.code, color: c.color, focus: c.focus, position: i },
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
      userId: user.id,
      weekday,
      startTime,
      endTime,
      courseId: ids.get(key) ?? null,
      kind,
    })),
  });

  revalidatePath("/", "layout");
}
