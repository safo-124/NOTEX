import type { Channel } from "./types";

/**
 * Set up: create a bot with @BotFather, put the token in TELEGRAM_BOT_TOKEN,
 * send the bot any message, then read your numeric chat id from
 * https://api.telegram.org/bot<token>/getUpdates and save it in Settings.
 */
export const telegramChannel: Channel = {
  name: "telegram",
  configured() {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN);
  },
  async send(target, message) {
    if (!target.telegramChatId) throw new Error("No Telegram chat id on file");
    const res = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: target.telegramChatId,
          text: `*${message.subject}*\n\n${message.text}`,
          parse_mode: "Markdown",
          disable_notification: false,
        }),
      },
    );
    if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
  },
};
