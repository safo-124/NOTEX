import type { Channel } from "./types";

/**
 * Meta Cloud API.
 *
 * Outside a 24 hour conversation window WhatsApp only delivers PRE-APPROVED
 * template messages, so a reminder that arrives at 22:50 unprompted must be a
 * template. Create one in Meta Business Manager with a single body variable,
 * approve it, then set WHATSAPP_TEMPLATE_NAME. Until that exists this channel
 * reports itself unconfigured and the dispatcher skips it.
 */
export const whatsappChannel: Channel = {
  name: "whatsapp",
  configured() {
    return Boolean(
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
        process.env.WHATSAPP_ACCESS_TOKEN &&
        process.env.WHATSAPP_TEMPLATE_NAME,
    );
  },
  async send(target, message) {
    if (!target.whatsappTo) throw new Error("No WhatsApp number on file");
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: target.whatsappTo,
          type: "template",
          template: {
            name: process.env.WHATSAPP_TEMPLATE_NAME,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: message.text.slice(0, 900) }],
              },
            ],
          },
        }),
      },
    );
    if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`);
  },
};
