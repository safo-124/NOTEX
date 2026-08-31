"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const noteInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().max(200).default("Untitled"),
  body: z.string().default(""),
  courseId: z.string().uuid().nullable().optional(),
  blockId: z.string().uuid().nullable().optional(),
  onDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).default([]),
  pinned: z.coerce.boolean().default(false),
});

/** Title carries more weight than body, so a title hit ranks above a mention. */
async function reindex(id: string) {
  await prisma.$executeRaw`
    UPDATE "note"
    SET "searchVector" =
      setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(body, '')), 'B')
    WHERE id = ${id}::uuid`;
}

export async function saveNote(input: z.input<typeof noteInput>) {
  const user = await requireUser();
  const data = noteInput.parse(input);
  const values = {
    title: data.title.trim() || "Untitled",
    body: data.body,
    courseId: data.courseId ?? null,
    blockId: data.blockId ?? null,
    onDate: data.onDate ?? null,
    tags: data.tags,
    pinned: data.pinned,
  };

  if (data.id) {
    await prisma.note.updateMany({ where: { id: data.id, userId: user.id }, data: values });
    await reindex(data.id);
    revalidatePath("/notes");
    return data.id;
  }

  const row = await prisma.note.create({
    data: { ...values, userId: user.id },
    select: { id: true },
  });
  await reindex(row.id);
  revalidatePath("/notes");
  return row.id;
}

export async function deleteNote(id: string) {
  const user = await requireUser();
  await prisma.note.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/notes");
}
