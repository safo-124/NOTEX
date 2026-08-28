"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { channels, reminderMessage } from "@/alerts";
import type { ChannelName } from "@/alerts";

const prefsInput = z.object({
  enabled: z.coerce.boolean().default(true),
  leadMinutes: z.coerce.number().int().min(0).max(180).default(10),
  email: z.coerce.boolean().default(true),
  telegram: z.coerce.boolean().default(false),
  whatsapp: z.coerce.boolean().default(false),
  emailTo: z
    .string()
    .email("That does not look like an email address.")
    .or(z.literal(""))
    .nullable()
    .default(null),
  // A Telegram chat id is a number, negative for groups. People paste the
  // bot's t.me link here, so say what is wrong rather than "too big".
  telegramChatId: z
    .string()
    .regex(/^-?\d{1,20}$/, "The chat id is a number, like 812345678. Press Find mine to fill it in.")
    .or(z.literal(""))
    .nullable()
    .default(null),
  whatsappTo: z
    .string()
    .regex(/^\+?\d{6,20}$/, "Use digits only, in international format, e.g. 358401234567.")
    .or(z.literal(""))
    .nullable()
    .default(null),
  dailySummary: z.coerce.boolean().default(true),
  summaryHour: z.coerce.number().int().min(0).max(23).default(19),
  timezone: z.string().max(60).default("Europe/Helsinki"),
});

export async function saveAlertPrefs(input: z.input<typeof prefsInput>) {
  const user = await requireUser();

  const parsed = prefsInput.safeParse(input);
  if (!parsed.success) {
    // A bad field is a thing to correct, not a crash.
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Those settings are not valid." };
  }
  const d = parsed.data;

  await prisma.user.update({ where: { id: user.id }, data: { timezone: d.timezone } });

  const values = {
    enabled: d.enabled,
    leadMinutes: d.leadMinutes,
    channels: { email: d.email, telegram: d.telegram, whatsapp: d.whatsapp },
    emailTo: d.emailTo || null,
    telegramChatId: d.telegramChatId || null,
    whatsappTo: d.whatsappTo || null,
    dailySummary: d.dailySummary,
    summaryHour: d.summaryHour,
  };

  await prisma.alertPref.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...values },
    update: values,
  });

  revalidatePath("/settings");
  return { ok: true, message: "Saved." };
}

export async function sendTestAlert(channel: ChannelName) {
  const user = await requireUser();
  const prefs = await prisma.alertPref.findUnique({ where: { userId: user.id } });
  const impl = channels[channel];
  if (!impl.configured()) {
    return { ok: false, message: `${channel} is missing its credentials in the environment.` };
  }
  try {
    await impl.send(
      {
        email: prefs?.emailTo ?? user.email,
        telegramChatId: prefs?.telegramChatId ?? null,
        whatsappTo: prefs?.whatsappTo ?? null,
      },
      reminderMessage({
        courseName: "Test alert",
        courseCode: "",
        kind: "If you are reading this, the channel works",
        start: "23:00",
        end: "01:00",
        minutesUntil: 10,
        minutes: 120,
      }),
    );
    return { ok: true, message: `Sent a test message on ${channel}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Telegram never tells a bot who its users are until they message it first.
 * This reads the bot's pending updates and pulls out the chats that have,
 * which saves hand-parsing getUpdates JSON.
 */
export async function findTelegramChats() {
  await requireUser();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, message: "TELEGRAM_BOT_TOKEN is not set in the environment.", chats: [] };
  }

  let payload: { ok?: boolean; result?: unknown[]; description?: string };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, { cache: "no-store" });
    payload = await res.json();
    if (!res.ok || payload.ok === false) {
      return { ok: false, message: payload.description ?? `Telegram returned ${res.status}.`, chats: [] };
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not reach Telegram.",
      chats: [],
    };
  }

  const found = new Map<string, string>();
  for (const update of (payload.result ?? []) as Record<string, any>[]) {
    const chat = update.message?.chat ?? update.edited_message?.chat ?? update.channel_post?.chat;
    if (!chat?.id) continue;
    const label =
      [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
      chat.title ||
      chat.username ||
      String(chat.id);
    found.set(String(chat.id), label);
  }

  const chats = [...found].map(([id, label]) => ({ id, label }));
  if (chats.length === 0) {
    return {
      ok: false,
      message: "No chats yet. Open Telegram, send your bot any message, then try again.",
      chats,
    };
  }
  return { ok: true, message: `Found ${chats.length} chat${chats.length === 1 ? "" : "s"}.`, chats };
}
