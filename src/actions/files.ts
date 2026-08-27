"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { deleteObject, putObject, storageConfigured } from "@/lib/storage";

const MAX_BYTES = 25 * 1024 * 1024;

export async function uploadFile(form: FormData) {
  const user = await requireUser();
  if (!storageConfigured) {
    return { ok: false, message: "Object storage is not configured yet. Fill in the S3_ variables." };
  }

  const file = form.get("file");
  const courseId = (form.get("courseId") as string) || null;
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file first." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "That file is over the 25 MB limit." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  const key = `${user.id}/${Date.now()}-${safeName}`;

  await putObject(key, buffer, file.type || "application/octet-stream");
  await prisma.fileAsset.create({
    data: {
      userId: user.id,
      courseId: courseId && courseId !== "none" ? courseId : null,
      key,
      name: safeName,
      contentType: file.type || "application/octet-stream",
      size: buffer.byteLength,
    },
  });

  revalidatePath("/files");
  return { ok: true, message: `Uploaded ${safeName}.` };
}

export async function removeFile(id: string) {
  const user = await requireUser();
  const row = await prisma.fileAsset.findFirst({ where: { id, userId: user.id }, select: { key: true } });
  if (!row) return;
  await deleteObject(row.key);
  await prisma.fileAsset.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/files");
}
