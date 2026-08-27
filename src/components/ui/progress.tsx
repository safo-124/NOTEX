import { cn } from "@/lib/utils";

export function Progress({
  value,
  color,
  className,
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]", className)}>
      <div
        className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
        style={{ width: pct + "%", background: color ?? "var(--primary)" }}
      />
    </div>
  );
}
