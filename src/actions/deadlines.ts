"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getUserTimezone } from "@/lib/queries";
import { parseLocalInput } from "@/lib/time";

const deadlineInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, "Give it a title.").max(160),
  kind: z.enum(["assignment", "exam", "project", "other"]).default("assignment"),
  courseId: z.string().uuid().nullable().optional(),
  dueAt: z.string().min(1, "Pick a date."),
  notes: z.string().max(2000).nullable().optional(),
});

export async function saveDeadline(input: z.input<typeof deadlineInput>) {
  const user = await requireUser();
  const parsed = deadlineInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the fields." };

  const d = parsed.data;
  const dueAt = parseLocalInput(d.dueAt, await getUserTimezone(user.id));
  if (!dueAt) return { ok: false, message: "That date did not parse." };

  const values = {
    title: d.title.trim(),
    kind: d.kind,
    courseId: d.courseId ?? null,
    dueAt,
    notes: d.notes?.trim() || null,
  };

  if (d.id) await prisma.deadline.updateMany({ where: { id: d.id, userId: user.id }, data: values });
  else await prisma.deadline.create({ data: { ...values, userId: user.id } });

  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function toggleDeadlineDone(id: string) {
  const user = await requireUser();
  const row = await prisma.deadline.findFirst({ where: { id, userId: user.id }, select: { done: true } });
  if (!row) return;
  await prisma.deadline.updateMany({ where: { id, userId: user.id }, data: { done: !row.done } });
  revalidatePath("/", "layout");
}

export async function deleteDeadline(id: string) {
  const user = await requireUser();
  await prisma.deadline.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/", "layout");
}

const examInput = z.object({
  id: z.string().uuid().optional(),
  courseId: z.string().uuid({ message: "Pick the course." }),
  title: z.string().max(160).optional(),
  dueAt: z.string().min(1, "Pick the date and time."),
  location: z.string().max(200).optional(),
  prepHours: z.coerce.number().int().min(0, "Hours cannot be negative.").max(300, "300 hours at most."),
  prepDays: z.coerce.number().int().min(1, "Start at least a day before.").max(90, "90 days at most."),
});

/**
 * Add an exam by hand, or change one. An exam that came from Sisu keeps the
 * date and room Sisu gives it, since the next sync would put them back anyway;
 * only its preparation target is yours to change.
 */
export async function saveExam(input: z.input<typeof examInput>) {
  const user = await requireUser();
  const parsed = examInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the fields." };
  const d = parsed.data;
  const prep = { prepHours: d.prepHours, prepDays: d.prepDays };

  const existing = d.id
    ? await prisma.deadline.findFirst({ where: { id: d.id, userId: user.id, kind: "exam" }, select: { sourceUid: true } })
    : null;
  if (d.id && !existing) return { ok: false, message: "That exam no longer exists." };

  if (existing?.sourceUid) {
    await prisma.deadline.updateMany({ where: { id: d.id, userId: user.id }, data: prep });
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved." };
  }

  const course = await prisma.course.findFirst({
    where: { id: d.courseId, userId: user.id },
    select: { code: true, name: true },
  });
  if (!course) return { ok: false, message: "Pick one of your courses." };

  const dueAt = parseLocalInput(d.dueAt, await getUserTimezone(user.id));
  if (!dueAt) return { ok: false, message: "That date did not parse." };
  if (!d.id && dueAt <= new Date()) return { ok: false, message: "That time has already passed." };

  const values = {
    courseId: d.courseId,
    title: d.title?.trim() || `${course.code || course.name} exam`,
    dueAt,
    notes: d.location?.trim() || null,
    ...prep,
  };

  if (d.id) await prisma.deadline.updateMany({ where: { id: d.id, userId: user.id }, data: values });
  else await prisma.deadline.create({ data: { ...values, userId: user.id, kind: "exam" } });

  revalidatePath("/", "layout");
  return { ok: true, message: d.id ? "Saved." : "Exam added." };
}
