"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { allowBrowserUploads, deleteObject, statObject, storageConfigured } from "@/lib/storage";

const MAX_BYTES = 100 * 1024 * 1024;

const registerInput = z.object({
  key: z.string().min(1).max(400),
  name: z.string().min(1).max(200),
  courseId: z.string().uuid().nullable().optional(),
});

/**
 * Called after the browser has PUT the file straight into the bucket. The size
 * and type come from the bucket rather than the client, so a forged request
 * cannot record a file that is not there or lie about how big it is.
 */
export async function registerFile(input: z.input<typeof registerInput>) {
  const user = await requireUser();
  const parsed = registerInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That upload could not be recorded." };

  const { key, name, courseId } = parsed.data;
  if (!key.startsWith(`${user.id}/`)) return { ok: false, message: "That key is not yours." };

  let stat: { size: number; contentType: string };
  try {
    stat = await statObject(key);
  } catch {
    return { ok: false, message: "The upload did not arrive. Try again." };
  }
  if (stat.size === 0) return { ok: false, message: "That file came through empty." };
  if (stat.size > MAX_BYTES) {
    await deleteObject(key);
    return { ok: false, message: "That file is over the 100 MB limit." };
  }

  await prisma.fileAsset.create({
    data: {
      userId: user.id,
      courseId: courseId && courseId !== "none" ? courseId : null,
      key,
      name,
      contentType: stat.contentType,
      size: stat.size,
    },
  });

  revalidatePath("/files");
  return { ok: true, message: `Uploaded ${name}.` };
}

export async function removeFile(id: string) {
  const user = await requireUser();
  const row = await prisma.fileAsset.findFirst({ where: { id, userId: user.id }, select: { key: true } });
  if (!row) return;
  await deleteObject(row.key);
  await prisma.fileAsset.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/files");
}

/** One-time bucket setup, so the browser is allowed to PUT from this origin. */
export async function enableBucketUploads() {
  await requireUser();
  if (!storageConfigured) return { ok: false, message: "Fill in the S3 variables first." };

  const origin = process.env.AUTH_URL?.replace(/\/$/, "");
  if (!origin) return { ok: false, message: "AUTH_URL is not set." };

  try {
    await allowBrowserUploads(origin);
    return { ok: true, message: `The bucket now accepts uploads from ${origin}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not set the bucket policy." };
  }
}
