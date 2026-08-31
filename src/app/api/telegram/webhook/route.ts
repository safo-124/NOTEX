import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegram, webhookSecret } from "@/lib/telegram";
import { blocksForWeekday, listBlocks } from "@/lib/queries";
import { DAY_NAMES, formatHours, minutesOf, studyClock } from "@/lib/time";

export const dynamic = "force-dynamic";

const HELP = [
  "*NOTEX*",
  "",
  "/tonight - tonight's plan",
  "/go - start a timer on the next block",
  "/stop - stop the timer and log the time",
  "/done - tick off the next unfinished block (/done 2 for the second)",
  "/note something worth keeping - save a note",
  "/week - hours logged so far this week",
  "/due - what is coming up",
].join("\n");

/** Telegram identifies people by chat id; the app knows it from Settings. */
async function resolveUser(chatId: string) {
  const prefs = await prisma.alertPref.findFirst({
    where: { telegramChatId: chatId },
    include: { user: { select: { id: true, timezone: true } } },
  });
  return prefs?.user ?? null;
}

async function tonightPlan(userId: string, tz: string) {
  const clock = studyClock(new Date(), tz);
  const all = await listBlocks(userId);
  const blocks = blocksForWeekday(all, clock.weekday);

  const ticks = await prisma.tick.findMany({
    where: { userId, onDate: clock.dateIso },
    select: { blockId: true },
  });
  const done = new Set(ticks.map((t) => t.blockId));
  return { clock, blocks, done };
}

async function handle(text: string, user: { id: string; timezone: string }) {
  const tz = user.timezone || "Europe/Helsinki";
  const [rawCommand, ...rest] = text.trim().split(/\s+/);
  const command = rawCommand.toLowerCase().replace(/@.*$/, "");
  const argument = rest.join(" ");

  if (command === "/start" || command === "/help") return HELP;

  if (command === "/tonight") {
    const { clock, blocks, done } = await tonightPlan(user.id, tz);
    if (blocks.length === 0) return `Nothing scheduled for ${DAY_NAMES[clock.weekday]}.`;

    const classes = await prisma.classEvent.findMany({
      where: {
        userId: user.id,
        startsAt: { gte: new Date(`${clock.dateIso}T00:00:00Z`), lte: new Date(`${clock.dateIso}T23:59:59Z`) },
      },
      orderBy: { startsAt: "asc" },
      take: 8,
    });

    const lines = [`*${DAY_NAMES[clock.weekday]}*`];
    if (classes.length) {
      lines.push("", "_On campus_");
      for (const c of classes) {
        const at = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(c.startsAt);
        lines.push(`${at}  ${c.code} ${c.kind}`);
      }
    }
    lines.push("", "_Study_");
    blocks.forEach((b, i) => {
      lines.push(`${i + 1}. ${b.startTime}-${b.endTime}  ${b.courseName}${done.has(b.id) ? "  done" : ""}`);
    });
    return lines.join("\n");
  }

  if (command === "/done") {
    const { clock, blocks, done } = await tonightPlan(user.id, tz);
    const index = Number(argument);
    const target = Number.isFinite(index) && index > 0 ? blocks[index - 1] : blocks.find((b) => !done.has(b.id));
    if (!target) return "Nothing left to tick off tonight.";
    if (done.has(target.id)) return `${target.courseName} was already ticked.`;

    await prisma.tick.upsert({
      where: { blockId_onDate: { blockId: target.id, onDate: clock.dateIso } },
      create: { userId: user.id, blockId: target.id, onDate: clock.dateIso, minutes: target.minutes },
      update: {},
    });
    return `Ticked off ${target.courseName} (${target.startTime}-${target.endTime}).`;
  }

  if (command === "/go") {
    const running = await prisma.studySession.findFirst({ where: { userId: user.id, endedAt: null } });
    if (running) return "A timer is already running. Send /stop first.";

    const { clock, blocks, done } = await tonightPlan(user.id, tz);
    const target = blocks.find((b) => !done.has(b.id)) ?? blocks[0];
    if (!target) return "No blocks tonight to start.";

    await prisma.studySession.create({
      data: { userId: user.id, blockId: target.id, courseId: target.courseId, onDate: clock.dateIso },
    });
    return `Timer started on ${target.courseName}. Send /stop when you finish.`;
  }

  if (command === "/stop") {
    const running = await prisma.studySession.findFirst({
      where: { userId: user.id, endedAt: null },
      orderBy: { startedAt: "desc" },
      include: { course: { select: { name: true } } },
    });
    if (!running) return "No timer is running.";

    const endedAt = new Date();
    const minutes = Math.max(0, Math.min(480, Math.round((endedAt.getTime() - running.startedAt.getTime()) / 60_000)));
    await prisma.studySession.update({ where: { id: running.id }, data: { endedAt, minutes } });

    if (running.blockId && minutes >= 10) {
      await prisma.tick.upsert({
        where: { blockId_onDate: { blockId: running.blockId, onDate: running.onDate } },
        create: { userId: user.id, blockId: running.blockId, onDate: running.onDate, minutes },
        update: { minutes },
      });
    }
    return `Logged ${formatHours(minutes)} on ${running.course?.name ?? "study"}.`;
  }

  if (command === "/note") {
    if (!argument) return "Send the note after the command, for example: /note revisit the DFT symmetry proof";
    const { clock, blocks, done } = await tonightPlan(user.id, tz);
    const now = clock.minutes;
    const current =
      blocks.find((b) => now >= minutesOf(b.startTime) && now < minutesOf(b.endTime)) ??
      blocks.find((b) => !done.has(b.id));

    const note = await prisma.note.create({
      data: {
        userId: user.id,
        courseId: current?.courseId ?? null,
        blockId: current?.id ?? null,
        onDate: clock.dateIso,
        title: argument.slice(0, 60),
        body: argument,
        tags: ["telegram"],
      },
      select: { id: true },
    });
    return `Saved${current?.courseName ? ` under ${current.courseName}` : ""}.`;
  }

  if (command === "/week") {
    const clock = studyClock(new Date(), tz);
    const monday = clock.dateIso;
    const rows = await prisma.studySession.groupBy({
      by: ["courseId"],
      where: { userId: user.id, endedAt: { not: null }, startedAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
      _sum: { minutes: true },
    });
    if (rows.length === 0) return "No time logged in the last seven days.";

    const courses = await prisma.course.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
    });
    const nameOf = new Map(courses.map((c) => [c.id, c.name]));

    const lines = ["*Last seven days*"];
    let total = 0;
    for (const r of rows.sort((a, b) => (b._sum.minutes ?? 0) - (a._sum.minutes ?? 0))) {
      const minutes = r._sum.minutes ?? 0;
      total += minutes;
      lines.push(`${formatHours(minutes).padStart(6)}  ${nameOf.get(r.courseId ?? "") ?? "Unassigned"}`);
    }
    lines.push("", `Total ${formatHours(total)}`);
    return lines.join("\n");
  }

  if (command === "/due") {
    const rows = await prisma.deadline.findMany({
      where: { userId: user.id, done: false, dueAt: { gte: new Date() } },
      include: { course: { select: { name: true } } },
      orderBy: { dueAt: "asc" },
      take: 8,
    });
    if (rows.length === 0) return "Nothing due.";
    return [
      "*Coming up*",
      ...rows.map((d) => {
        const days = Math.ceil((d.dueAt.getTime() - Date.now()) / 86400_000);
        return `${String(days).padStart(3)}d  ${d.title}${d.course ? ` (${d.course.name})` : ""}`;
      }),
    ].join("\n");
  }

  return `I did not understand that.\n\n${HELP}`;
}

export async function POST(req: Request) {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let update: { message?: { chat?: { id?: number }; text?: string } };
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const chatId = update.message?.chat?.id;
  const text = update.message?.text;
  // Always answer 200: Telegram retries anything else, and a retry storm is
  // worse than a dropped message.
  if (!chatId || !text) return NextResponse.json({ ok: true });

  try {
    const user = await resolveUser(String(chatId));
    const reply = user
      ? await handle(text, { id: user.id, timezone: user.timezone })
      : "This chat is not linked to a NOTEX account. Open Settings, press Find mine, and save.";
    await sendTelegram(String(chatId), reply);
  } catch (err) {
    try {
      await sendTelegram(String(chatId), `Something went wrong: ${err instanceof Error ? err.message : "unknown error"}`);
    } catch {
      // The reply failing is not worth a retry either.
    }
  }

  return NextResponse.json({ ok: true });
}
