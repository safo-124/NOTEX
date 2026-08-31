import { formatHours } from "@/lib/time";
import type { OutboundMessage } from "./types";

export function reminderMessage(input: {
  courseName: string;
  courseCode: string;
  kind: string;
  start: string;
  end: string;
  minutesUntil: number;
  minutes: number;
}): OutboundMessage {
  const when =
    input.minutesUntil <= 0 ? "starting now" : `in ${input.minutesUntil} min`;
  return {
    subject: `${input.courseName} ${when}`,
    text: [
      `${input.start} to ${input.end} (${formatHours(input.minutes)})`,
      `${input.courseName}${input.courseCode ? ` [${input.courseCode}]` : ""}`,
      input.kind,
    ].join("\n"),
  };
}

export function summaryMessage(input: {
  dateLabel: string;
  lines: string[];
  doneMinutes: number;
  plannedMinutes: number;
}): OutboundMessage {
  const pct = input.plannedMinutes
    ? Math.round((input.doneMinutes / input.plannedMinutes) * 100)
    : 0;
  return {
    subject: `Tonight: ${input.dateLabel}`,
    text: [
      ...input.lines,
      "",
      `This week: ${formatHours(input.doneMinutes)} of ${formatHours(input.plannedMinutes)} (${pct}%)`,
    ].join("\n"),
  };
}

export function classMessage(input: {
  courseName: string;
  code: string;
  kind: string;
  start: string;
  end: string;
  location: string | null;
  minutesUntil: number;
}): OutboundMessage {
  const when = input.minutesUntil <= 0 ? "starting now" : `in ${input.minutesUntil} min`;
  return {
    subject: `${input.kind}: ${input.courseName} ${when}`,
    text: [
      `${input.start} to ${input.end}`,
      `${input.courseName} [${input.code}]`,
      input.location ?? "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
