import { Card } from "@/components/ui/card";
import type { ClassRow } from "@/lib/queries";

/** Timetabled classes: fixed obligations, styled apart from chosen study blocks. */
export function ClassList({ rows, compact = false }: { rows: ClassRow[]; compact?: boolean }) {
  if (rows.length === 0) return null;

  if (compact) {
    return (
      <ul className="mb-2 flex flex-col gap-1 border-b border-dashed border-[var(--border)] pb-2">
        {rows.map((c) => (
          <li key={c.id} className="grid grid-cols-[96px_1fr] gap-2 text-[13px]">
            <span className="font-mono text-xs tabular text-[var(--muted-foreground)]">
              {c.startLabel} to {c.endLabel}
            </span>
            <span className="truncate">
              <span style={{ color: c.courseColor ?? undefined }}>{c.code}</span>{" "}
              <span className="text-[var(--muted-foreground)]">{c.kind}</span>
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((c) => (
        <Card
          key={c.id}
          className="flex items-start gap-3 border-dashed p-3.5"
          style={{ borderLeftColor: c.courseColor ?? "var(--border)", borderLeftWidth: 3, borderLeftStyle: "solid" }}
        >
          <div className="w-14 shrink-0 font-mono text-xs tabular text-[var(--muted-foreground)]">
            <div>{c.startLabel}</div>
            <div>{c.endLabel}</div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-tight">{c.courseName ?? c.title}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {c.kind}
              {c.groupLabel ? ` · ${c.groupLabel}` : ""}
            </p>
            {c.location ? (
              <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">{c.location}</p>
            ) : null}
          </div>
          <span className="shrink-0 font-mono text-[11px]" style={{ color: c.courseColor ?? undefined }}>
            {c.code}
          </span>
        </Card>
      ))}
    </div>
  );
}
