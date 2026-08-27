export type ChannelName = "email" | "telegram" | "whatsapp";

export type OutboundMessage = {
  subject: string;
  /** Plain text, used as-is by Telegram and WhatsApp. */
  text: string;
  /** Optional HTML body for email. */
  html?: string;
};

export type ChannelTarget = {
  email?: string | null;
  telegramChatId?: string | null;
  whatsappTo?: string | null;
};

export interface Channel {
  name: ChannelName;
  /** False when the environment is missing credentials, so it is skipped quietly. */
  configured(): boolean;
  send(target: ChannelTarget, message: OutboundMessage): Promise<void>;
}
