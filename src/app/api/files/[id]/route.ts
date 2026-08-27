import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { signedDownloadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Files stay private in the bucket; this hands out a 5 minute signed link. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const row = await prisma.fileAsset.findFirst({
    where: { id, userId: session.user.id },
    select: { key: true, name: true },
  });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.redirect(await signedDownloadUrl(row.key, row.name));
}
