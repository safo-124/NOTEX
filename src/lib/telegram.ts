import { createHash } from "node:crypto";

const API = "https://api.telegram.org";

/**
 * Telegram signs every webhook delivery with a secret you choose at
 * registration. Deriving it from AUTH_SECRET keeps it stable per deployment
 * without adding another variable to keep in sync across environments.
 */
export function webhookSecret() {
  const base = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(`${base}:telegram-webhook`).digest("hex").slice(0, 48);
}

function token() {
  const value = process.env.TELEGRAM_BOT_TOKEN;
  if (!value) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return value;
}

async function call(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = (await res.json()) as { ok: boolean; description?: string; result?: unknown };
  if (!res.ok || !payload.ok) throw new Error(payload.description ?? `Telegram ${res.status}`);
  return payload.result;
}

export async function sendTelegram(chatId: string, text: string) {
  await call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    link_preview_options: { is_disabled: true },
  });
}

export async function setTelegramWebhook(url: string) {
  return call("setWebhook", {
    url,
    secret_token: webhookSecret(),
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
}

export async function deleteTelegramWebhook() {
  return call("deleteWebhook", { drop_pending_updates: true });
}

export async function getTelegramWebhookInfo() {
  return (await call("getWebhookInfo", {})) as { url?: string; last_error_message?: string };
}
