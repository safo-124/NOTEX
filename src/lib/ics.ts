/**
 * A small iCalendar reader, scoped to what Sisu actually emits.
 *
 * Sisu's feed is already fully expanded: no RRULE inside events, every DTSTART
 * in UTC, and DURATION rather than DTEND. The fallbacks below cover DTEND and
 * floating local times in case that ever changes, but the happy path is simple
 * enough that a dependency would cost more than it saves.
 */

export type IcsEvent = {
  uid: string;
  code: string;
  title: string;
  kind: string;
  group: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  /// Sisu writes exams as "CODE, Course name, Exam 13.10.2026 - ...".
  isExam: boolean;
};

function unfold(text: string) {
  // RFC 5545 folds long lines by starting the continuation with a space or tab.
  return text.replace(/\r?\n[ \t]/g, "");
}

function unescape(value: string) {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function readProp(block: string, name: string) {
  const m = block.match(new RegExp(`^${name}(?:;[^:\\n]*)?:(.*)$`, "m"));
  return m ? m[1].trim() : null;
}

/** "20260901T090000Z" or "20260901T090000" (treated as UTC only if Z). */
function parseStamp(value: string): Date | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? "Z" : "Z"}`;
  return new Date(iso);
}

/** "PT2H", "PT1H30M", "PT45M". */
function parseDuration(value: string) {
  const m = value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const [, d, h, mi, s] = m;
  return (
    (Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(mi ?? 0) * 60 + Number(s ?? 0)) * 1000
  );
}

/**
 * Sisu writes SUMMARY as:
 *   "CODE, Course name, Teaching period text - Common - Lecture:  - Room"
 *   "CODE, Course name, ... - Groups - Group 3: Hervanta - Room"
 * so the code is up to the first comma, the name up to the second, and the
 * teaching type is the word before the first colon in the tail.
 */
function parseSummary(summary: string) {
  const parts = summary.split(",");
  const code = (parts[0] ?? "").trim();
  const title = (parts[1] ?? "").trim();

  let kind = "Class";
  let group: string | null = null;

  const kindMatch = summary.match(/ - ([A-Za-zÄÖäö ]+?):\s*(.*?)(?: - |$)/);
  if (kindMatch) {
    kind = kindMatch[1].trim();
    const rest = kindMatch[2].trim();
    if (rest) group = rest;
  }
  if (/\bGroup \d/i.test(kind)) {
    group = kind;
    kind = "Small group";
  }

  const isExam = /^exam\b/i.test((parts[2] ?? "").trim());
  if (isExam) kind = "Exam";

  return { code, title, kind, group, isExam };
}

/** Course codes carry an implementation suffix: ITC.CEE.300-19 -> ITC.CEE.300 */
export function baseCode(code: string) {
  return code.trim().toUpperCase().replace(/-\d+$/, "");
}

export function parseIcs(text: string): IcsEvent[] {
  const body = unfold(text);
  const blocks = body.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
  const events: IcsEvent[] = [];

  for (const block of blocks) {
    const uid = readProp(block, "UID");
    const dtstart = readProp(block, "DTSTART");
    if (!uid || !dtstart) continue;

    const startsAt = parseStamp(dtstart);
    if (!startsAt || Number.isNaN(startsAt.getTime())) continue;

    let endsAt: Date | null = null;
    const duration = readProp(block, "DURATION");
    const dtend = readProp(block, "DTEND");
    if (duration) endsAt = new Date(startsAt.getTime() + parseDuration(duration));
    else if (dtend) endsAt = parseStamp(dtend);
    if (!endsAt || Number.isNaN(endsAt.getTime())) endsAt = new Date(startsAt.getTime() + 2 * 3600_000);

    const summary = unescape(readProp(block, "SUMMARY") ?? "");
    const { code, title, kind, group, isExam } = parseSummary(summary);

    events.push({
      uid,
      code,
      title: title || summary.slice(0, 120),
      kind,
      group,
      location: readProp(block, "LOCATION") ? unescape(readProp(block, "LOCATION") as string) : null,
      startsAt,
      endsAt,
      isExam,
    });
  }

  return events;
}
