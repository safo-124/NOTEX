import nodemailer from "nodemailer";
import type { Channel } from "./types";

export const emailChannel: Channel = {
  name: "email",
  configured() {
    return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);
  },
  async send(target, message) {
    if (!target.email) throw new Error("No email address on file");
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASSWORD
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
    });
    await transport.sendMail({
      from: process.env.MAIL_FROM,
      to: target.email,
      subject: message.subject,
      text: message.text,
      html: message.html ?? `<pre style="font:14px/1.5 ui-monospace,monospace">${escapeHtml(message.text)}</pre>`,
    });
  },
};

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
