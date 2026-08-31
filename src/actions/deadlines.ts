"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

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
  const dueAt = new Date(d.dueAt);
  if (Number.isNaN(dueAt.getTime())) return { ok: false, message: "That date did not parse." };

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
