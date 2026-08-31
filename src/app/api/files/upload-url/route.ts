import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { signedUploadUrl, storageConfigured } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MAX_BYTES = 100 * 1024 * 1024;

const input = z.object({
  name: z.string().min(1).max(200),
  contentType: z.string().max(160).default("application/octet-stream"),
  size: z.number().int().positive().max(MAX_BYTES),
});

/**
 * Hands the browser a short-lived URL to PUT the file directly into the bucket.
 * The row in the database is only created afterwards, by registerFile, once the
 * object is actually there.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!storageConfigured) {
    return NextResponse.json({ error: "Object storage is not configured." }, { status: 503 });
  }

  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Bad request" }, { status: 400 });
  }

  const safeName = parsed.data.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  const key = `${session.user.id}/${Date.now()}-${safeName}`;

  return NextResponse.json({
    key,
    name: safeName,
    url: await signedUploadUrl(key, parsed.data.contentType),
  });
}
