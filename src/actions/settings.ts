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
  emailTo: z.string().email().or(z.literal("")).nullable().default(null),
  telegramChatId: z.string().max(40).nullable().default(null),
  whatsappTo: z.string().max(30).nullable().default(null),
  dailySummary: z.coerce.boolean().default(true),
  summaryHour: z.coerce.number().int().min(0).max(23).default(19),
  timezone: z.string().max(60).default("Europe/Helsinki"),
});

export async function saveAlertPrefs(input: z.input<typeof prefsInput>) {
  const user = await requireUser();
  const d = prefsInput.parse(input);

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
