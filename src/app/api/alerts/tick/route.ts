import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { channels, classMessage, reminderMessage, summaryMessage } from "@/alerts";
import type { ChannelName } from "@/alerts";
import { blocksForWeekday, listBlocks, weekSnapshot } from "@/lib/queries";
import { DAY_NAMES, formatHours, minutesOf, prettyDate, studyClock, zonedParts } from "@/lib/time";
import { syncTimetable } from "@/actions/timetable";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called every 5 minutes by cron. Vercel's Hobby plan only allows ONE cron run
// per day, so this endpoint is driven from the Hetzner box instead. The crontab
// line lives in README.md (an every-5-minutes cron expression cannot be written
// inside a block comment).
//
// Every send is claimed in alert_log first, so overlapping runs, retries and a
// wide catch-up window can never send the same reminder twice.
const summaryMinutes = (hour: number) => hour * 60;

async function run() {
  const now = new Date();
  const rows = await prisma.alertPref.findMany({
    where: { enabled: true },
    include: { user: { select: { id: true, email: true, timezone: true } } },
  });

  let sent = 0;
  let failed = 0;

  for (const prefs of rows) {
    const tz = prefs.user.timezone || "Europe/Helsinki";
    const clock = studyClock(now, tz);
    const flags = (prefs.channels ?? {}) as Partial<Record<ChannelName, boolean>>;
    const target = {
      email: prefs.emailTo ?? prefs.user.email,
      telegramChatId: prefs.telegramChatId,
      whatsappTo: prefs.whatsappTo,
    };
    const active = (Object.keys(channels) as ChannelName[]).filter(
      (name) => flags[name] && channels[name].configured(),
    );
    if (active.length === 0) continue;

    /* ---- close timers left running ---- */
    const stale = await prisma.studySession.findMany({
      where: { userId: prefs.userId, endedAt: null, startedAt: { lt: new Date(now.getTime() - 6 * 3600_000) } },
      select: { id: true },
    });
    if (stale.length) {
      // Six hours in, this is a timer someone forgot, not a study session.
      // Recording zero is honest; recording six hours is not.
      await prisma.studySession.updateMany({
        where: { id: { in: stale.map((s) => s.id) } },
        data: { endedAt: now, minutes: 0, note: "auto-closed: left running" },
      });
    }

    /* ---- keep the timetable fresh ---- */
    const feed = await prisma.calendarFeed.findUnique({ where: { userId: prefs.userId } });
    if (feed) {
      const age = feed.lastSyncedAt ? Date.now() - feed.lastSyncedAt.getTime() : Infinity;
      if (age > 6 * 3600_000) {
        try {
          await syncTimetable(prefs.userId);
        } catch {
          // A calendar that is briefly unreachable must not stop reminders.
        }
      }
    }

    /* ---- class reminders ---- */
    if (prefs.classReminders) {
      const soon = new Date(now.getTime() + prefs.classLeadMinutes * 60_000);
      const upcoming = await prisma.classEvent.findMany({
        where: { userId: prefs.userId, startsAt: { gt: now, lte: soon } },
        include: { course: { select: { name: true, groupFilter: true } } },
      });

      for (const event of upcoming) {
        const filter = event.course?.groupFilter?.trim();
        if (filter && !(event.groupLabel ?? "").toLowerCase().includes(filter.toLowerCase())) continue;

        const p = zonedParts(event.startsAt, tz);
        const q = zonedParts(event.endsAt, tz);
        const two = (n: number) => String(n).padStart(2, "0");
        const message = classMessage({
          courseName: event.course?.name ?? event.title,
          code: event.code,
          kind: event.kind,
          start: `${two(p.hour)}:${two(p.minute)}`,
          end: `${two(q.hour)}:${two(q.minute)}`,
          location: event.location,
          minutesUntil: Math.max(0, Math.round((event.startsAt.getTime() - now.getTime()) / 60_000)),
        });

        for (const name of active) {
          // The uid is stable across syncs; the row id is not, because a sync
          // replaces the rows wholesale.
          const claimed = await claim(prefs.userId, `class:${event.uid}`, clock.dateIso, "class", name);
          if (!claimed) continue;
          try {
            await channels[name].send(target, message);
            sent++;
          } catch (err) {
            failed++;
            await markFailed(claimed, err);
          }
        }
      }
    }

    /* ---- block reminders ---- */
    const all = await listBlocks(prefs.userId);
    for (const block of blocksForWeekday(all, clock.weekday)) {
      const startMin = minutesOf(block.startTime);
      const fireAt = startMin - prefs.leadMinutes;
      if (clock.minutes < fireAt || clock.minutes >= startMin) continue;

      const message = reminderMessage({
        courseName: block.courseName,
        courseCode: block.courseCode,
        kind: block.kind,
        start: block.startTime,
        end: block.endTime,
        minutesUntil: Math.max(0, startMin - clock.minutes),
        minutes: block.minutes,
      });

      for (const name of active) {
        const claimed = await claim(prefs.userId, block.id, clock.dateIso, "reminder", name);
        if (!claimed) continue;
        try {
          await channels[name].send(target, message);
          sent++;
        } catch (err) {
          failed++;
          await markFailed(claimed, err);
        }
      }
    }

    /* ---- deadline warnings ---- */
    if (prefs.dailySummary && clock.minutes >= summaryMinutes(prefs.summaryHour) && clock.minutes < summaryMinutes(prefs.summaryHour) + 60) {
      const due = await prisma.deadline.findMany({
        where: {
          userId: prefs.userId,
          done: false,
          dueAt: { gte: now, lte: new Date(now.getTime() + 3 * 86400_000) },
        },
        include: { course: { select: { name: true } } },
        orderBy: { dueAt: "asc" },
      });

      for (const d of due) {
        const days = Math.ceil((d.dueAt.getTime() - now.getTime()) / 86400_000);
        const message = {
          subject: `Due in ${days} day${days === 1 ? "" : "s"}: ${d.title}`,
          text: [d.course?.name ?? "", d.dueAt.toISOString().slice(0, 16).replace("T", " ")].filter(Boolean).join("\n"),
        };
        for (const name of active) {
          const claimed = await claim(prefs.userId, `deadline:${d.id}`, clock.dateIso, "deadline", name);
          if (!claimed) continue;
          try {
            await channels[name].send(target, message);
            sent++;
          } catch (err) {
            failed++;
            await markFailed(claimed, err);
          }
        }
      }
    }

    /* ---- evening summary ---- */
    const summaryMin = summaryMinutes(prefs.summaryHour);
    if (prefs.dailySummary && clock.minutes >= summaryMin && clock.minutes < summaryMin + 60) {
      const snap = await weekSnapshot(prefs.userId, now, tz);
      const today = snap.days.find((d) => d.dateIso === clock.dateIso);
      if (today && today.blocks.length) {
        let planned = 0;
        let done = 0;
        for (const [, v] of snap.perCourse) {
          planned += v.planned;
          done += v.done;
        }
        const message = summaryMessage({
          dateLabel: `${DAY_NAMES[clock.weekday]} ${prettyDate(clock.dateIso)}`,
          lines: today.blocks.map(
            (b) =>
              `${b.startTime}-${b.endTime}  ${b.courseName} (${formatHours(b.minutes)})${b.done ? " done" : ""}`,
          ),
          doneMinutes: done,
          plannedMinutes: planned,
        });
        for (const name of active) {
          const claimed = await claim(prefs.userId, "summary", clock.dateIso, "summary", name);
          if (!claimed) continue;
          try {
            await channels[name].send(target, message);
            sent++;
          } catch (err) {
            failed++;
            await markFailed(claimed, err);
          }
        }
      }
    }
  }

  return { ok: true, users: rows.length, sent, failed, at: now.toISOString() };
}

/** Write the log row first; a unique violation means someone already sent it. */
async function claim(userId: string, dedupeKey: string, onDate: string, kind: string, channel: string) {
  try {
    const row = await prisma.alertLog.create({
      data: { userId, dedupeKey, onDate, kind, channel, status: "sent" },
      select: { id: true },
    });
    return row.id;
  } catch {
    return null;
  }
}

async function markFailed(id: string, err: unknown) {
  await prisma.alertLog.update({
    where: { id },
    data: { status: "error", error: err instanceof Error ? err.message : String(err) },
  });
}

function authorized(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  // Vercel Cron sends CRON_SECRET; the Hetzner cron sends ALERT_CRON_SECRET.
  const secrets = [process.env.ALERT_CRON_SECRET, process.env.CRON_SECRET].filter(Boolean);
  return secrets.length > 0 && secrets.some((s) => header === `Bearer ${s}`);
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}
