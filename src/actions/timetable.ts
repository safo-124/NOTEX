"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { baseCode, parseIcs } from "@/lib/ics";

const urlInput = z.string().url().max(500);

export async function saveFeedUrl(url: string) {
  const user = await requireUser();
  const parsed = urlInput.safeParse(url.trim());
  if (!parsed.success) return { ok: false, message: "That does not look like a calendar URL." };

  await prisma.calendarFeed.upsert({
    where: { userId: user.id },
    create: { userId: user.id, url: parsed.data },
    update: { url: parsed.data },
  });
  revalidatePath("/settings");
  return { ok: true, message: "Saved. Press Sync now to pull the timetable." };
}

export async function removeFeed() {
  const user = await requireUser();
  await prisma.calendarFeed.deleteMany({ where: { userId: user.id } });
  await prisma.classEvent.deleteMany({ where: { userId: user.id } });
  revalidatePath("/", "layout");
}

/**
 * Pull the feed and reconcile it into class_event.
 *
 * Sisu hands out a fully expanded calendar, so this is a straight replace of
 * everything from a week ago onwards: past events are left alone as a record of
 * what was scheduled, and anything the university has since cancelled
 * disappears rather than lingering.
 */
export async function syncTimetable(userId?: string) {
  const id = userId ?? (await requireUser()).id;

  const feed = await prisma.calendarFeed.findUnique({ where: { userId: id } });
  if (!feed) return { ok: false, message: "No calendar URL saved yet.", imported: 0 };

  let text: string;
  try {
    const res = await fetch(feed.url, {
      cache: "no-store",
      headers: { accept: "text/calendar, text/plain, */*" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`The calendar server answered ${res.status}.`);
    text = await res.text();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reach the calendar.";
    await prisma.calendarFeed.update({
      where: { userId: id },
      data: { lastStatus: message, lastSyncedAt: new Date() },
    });
    return { ok: false, message, imported: 0 };
  }

  const events = parseIcs(text);
  if (events.length === 0) {
    await prisma.calendarFeed.update({
      where: { userId: id },
      data: { lastStatus: "The feed contained no events.", lastSyncedAt: new Date() },
    });
    return { ok: false, message: "The feed contained no events.", imported: 0 };
  }

  const horizon = new Date(Date.now() - 7 * 24 * 3600_000);
  const fresh = events.filter((e) => e.startsAt >= horizon);

  const courses = await prisma.course.findMany({
    where: { userId: id, archived: false },
    select: { id: true, code: true },
  });
  const byCode = new Map(courses.filter((c) => c.code).map((c) => [baseCode(c.code), c.id]));

  for (const e of fresh) {
    const courseId = byCode.get(baseCode(e.code)) ?? null;
    const values = {
      courseId,
      code: baseCode(e.code),
      title: e.title,
      kind: e.kind,
      groupLabel: e.group,
      location: e.location,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      updatedAt: new Date(),
    };
    await prisma.classEvent.upsert({
      where: { userId_uid: { userId: id, uid: e.uid } },
      create: { userId: id, uid: e.uid, ...values },
      update: values,
    });
  }

  // Drop anything upcoming that the university has removed from the feed.
  await prisma.classEvent.deleteMany({
    where: {
      userId: id,
      startsAt: { gte: horizon },
      uid: { notIn: fresh.map((e) => e.uid) },
    },
  });

  // Exams are dates you prepare for, not classes you attend, so they also
  // become deadlines. Keyed by the feed UID so a re-sync updates rather than
  // duplicates, and a moved exam moves here too.
  for (const e of fresh.filter((x) => x.isExam)) {
    const courseId = byCode.get(baseCode(e.code)) ?? null;
    const values = {
      courseId,
      title: `${baseCode(e.code)} exam`,
      kind: "exam",
      dueAt: e.startsAt,
      notes: e.location,
    };
    await prisma.deadline.upsert({
      where: { userId_sourceUid: { userId: id, sourceUid: e.uid } },
      create: { userId: id, sourceUid: e.uid, ...values },
      update: values,
    });
  }

  const linked = fresh.filter((e) => byCode.has(baseCode(e.code))).length;
  await prisma.calendarFeed.update({
    where: { userId: id },
    data: {
      lastSyncedAt: new Date(),
      lastStatus: `${fresh.length} events, ${linked} matched to your courses`,
      eventCount: fresh.length,
    },
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Imported ${fresh.length} events, ${linked} matched to your courses.`,
    imported: fresh.length,
  };
}
