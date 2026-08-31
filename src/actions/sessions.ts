"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getUserTimezone } from "@/lib/queries";
import { studyClock } from "@/lib/time";

/** Beyond this, a timer was forgotten rather than run. */
const RUNAWAY_MINUTES = 5 * 60;

export async function startSession(input: { blockId?: string | null; courseId?: string | null }) {
  const user = await requireUser();
  const tz = await getUserTimezone(user.id);

  // One timer at a time: starting a new one closes whatever was running.
  await stopSession();

  let courseId = input.courseId ?? null;
  if (!courseId && input.blockId) {
    const block = await prisma.block.findFirst({
      where: { id: input.blockId, userId: user.id },
      select: { courseId: true },
    });
    courseId = block?.courseId ?? null;
  }

  const session = await prisma.studySession.create({
    data: {
      userId: user.id,
      blockId: input.blockId ?? null,
      courseId,
      onDate: studyClock(new Date(), tz).dateIso,
    },
    select: { id: true, startedAt: true },
  });

  revalidatePath("/", "layout");
  return { ok: true, startedAt: session.startedAt.toISOString() };
}

export async function stopSession() {
  const user = await requireUser();
  const running = await prisma.studySession.findFirst({
    where: { userId: user.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!running) return { ok: false, minutes: 0 };

  const endedAt = new Date();
  const elapsed = Math.max(0, Math.round((endedAt.getTime() - running.startedAt.getTime()) / 60_000));

  // Clamping a forgotten timer to its maximum would quietly log hours that
  // never happened, which is worse than logging none.
  const forgotten = elapsed > RUNAWAY_MINUTES;
  const minutes = forgotten ? 0 : elapsed;

  await prisma.studySession.update({
    where: { id: running.id },
    data: { endedAt, minutes, note: forgotten ? "discarded: ran over 5 hours" : null },
  });

  if (forgotten) {
    revalidatePath("/", "layout");
    return { ok: true, minutes: 0, message: "That timer ran over five hours, so nothing was logged." };
  }

  // A block you actually sat through counts as done.
  if (running.blockId && minutes >= 10) {
    await prisma.tick.upsert({
      where: { blockId_onDate: { blockId: running.blockId, onDate: running.onDate } },
      create: { userId: user.id, blockId: running.blockId, onDate: running.onDate, minutes },
      update: { minutes },
    });
  }

  revalidatePath("/", "layout");
  return { ok: true, minutes, message: `Logged ${minutes} minutes.` };
}

/** Throw away a mistaken timer rather than logging a bogus stretch. */
export async function discardSession() {
  const user = await requireUser();
  await prisma.studySession.deleteMany({ where: { userId: user.id, endedAt: null } });
  revalidatePath("/", "layout");
}
