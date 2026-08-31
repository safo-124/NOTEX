import { readFileSync } from "node:fs";
import { parseIcs, baseCode } from "./ics";

const events = parseIcs(readFileSync(process.argv[2], "utf8"));
console.log("parsed events:", events.length);

const now = new Date("2026-08-28T00:00:00Z");
const future = events.filter((e) => e.startsAt >= now).sort((a, b) => +a.startsAt - +b.startsAt);
console.log("future events:", future.length);

const mine = new Set(["COMP.SGN.100", "COMP.SGN.350", "COMM.SYS.300", "ITC.CEE.300", "LANG.SUV.005"]);
const matched = future.filter((e) => mine.has(baseCode(e.code)));
console.log("matched to my courses:", matched.length);

console.log("\nnext 10 of mine:");
for (const e of matched.slice(0, 10)) {
  const hrs = (+e.endsAt - +e.startsAt) / 3600000;
  console.log(
    `  ${e.startsAt.toISOString().slice(0, 16).replace("T", " ")}Z  ${hrs}h  ${baseCode(e.code).padEnd(13)} ${e.kind.padEnd(12)} ${(e.title || "").slice(0, 34).padEnd(34)} ${e.location ?? ""}`.slice(0, 160),
  );
}

const kinds = new Map<string, number>();
for (const e of events) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1);
console.log("\nkinds:", [...kinds].sort((a, b) => b[1] - a[1]).slice(0, 8));

const bad = events.filter((e) => !e.code || !/^[A-Z]/.test(e.code));
console.log("events with no usable code:", bad.length);
if (bad[0]) console.log("  example:", bad[0].title.slice(0, 100));
