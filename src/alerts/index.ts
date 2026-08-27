import { emailChannel } from "./email";
import { telegramChannel } from "./telegram";
import { whatsappChannel } from "./whatsapp";
import type { Channel, ChannelName } from "./types";

export const channels: Record<ChannelName, Channel> = {
  email: emailChannel,
  telegram: telegramChannel,
  whatsapp: whatsappChannel,
};

export * from "./types";
export * from "./render";
