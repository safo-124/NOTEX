/**
 * Night-shift time model.
 *
 * Study runs across midnight, so a "study day" starts at 04:00 and any clock
 * time before noon belongs to the small hours at the END of that night.
 * All of it is computed in the user's own timezone, never the server's.
 */

export const DAY_ROLLOVER_HOUR = 4;

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type ZonedNow = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

/** Wall-clock parts of `at` as seen in `timeZone`. */
export function zonedParts(at: Date, timeZone: string): ZonedNow {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday as string] ?? 0,
  };
}

export function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function shiftIsoDate(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function weekdayOfIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The study date (the day the night STARTED) and minutes elapsed into it. */
export function studyClock(at: Date, timeZone: string) {
  const p = zonedParts(at, timeZone);
  let dateIso = isoDate(p.year, p.month, p.day);
  let minutes = p.hour * 60 + p.minute;
  if (p.hour < DAY_ROLLOVER_HOUR) {
    dateIso = shiftIsoDate(dateIso, -1);
    minutes += 1440;
  }
  return { dateIso, minutes, weekday: weekdayOfIso(dateIso) };
}

/** "23:00" -> 1380, "01:15" -> 1515. Times before noon sit after midnight. */
export function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map((n) => Number(n) || 0);
  return h < 12 ? h * 60 + m + 1440 : h * 60 + m;
}

export function durationMinutes(start: string, end: string) {
  const d = minutesOf(end) - minutesOf(start);
  return d > 0 ? d : 0;
}

export function formatHours(minutes: number) {
  const h = minutes / 60;
  return `${Math.round(h * 100) / 100}`.replace(/\.0+$/, "") + " h";
}

export function mondayOfIso(iso: string) {
  const wd = weekdayOfIso(iso);
  return shiftIsoDate(iso, -((wd + 6) % 7));
}

export function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}
