export function PageHead({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          {eyebrow}
        </p>
        <h1 className="text-balance font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
      </div>
      {action}
    </header>
  );
}
