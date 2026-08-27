import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { channels, reminderMessage, summaryMessage } from "@/alerts";
import type { ChannelName } from "@/alerts";
import { blocksForWeekday, listBlocks, weekSnapshot } from "@/lib/queries";
import { DAY_NAMES, formatHours, minutesOf, prettyDate, studyClock } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called every 5 minutes by cron. Vercel's Hobby plan only allows ONE cron run
// per day, so this endpoint is driven from the Hetzner box instead. The crontab
// line lives in README.md (an every-5-minutes cron expression cannot be written
// inside a block comment).
//
// Every send is claimed in alert_log first, so overlapping runs, retries and a
// wide catch-up window can never send the same reminder twice.
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

    /* ---- evening summary ---- */
    const summaryMin = prefs.summaryHour * 60;
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
