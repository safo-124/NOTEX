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
  groupFilter: z.string().max(60).nullable().default(null),
});

export async function saveCourse(input: z.input<typeof courseInput>) {
  const user = await requireUser();
  const data = courseInput.parse(input);

  if (data.id) {
    await prisma.course.updateMany({
      where: { id: data.id, userId: user.id },
      data: {
        name: data.name,
        code: data.code,
        color: data.color,
        focus: data.focus,
        groupFilter: data.groupFilter?.trim() || null,
      },
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
        groupFilter: data.groupFilter?.trim() || null,
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
    throw new Error("A block must end after it starts. Times before 04:00 count as the small hours of that night.");
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
