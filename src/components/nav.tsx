"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, FileText, Moon, Settings, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/tonight", label: "Tonight", icon: Moon },
  { href: "/week", label: "Week", icon: CalendarDays },
  { href: "/notes", label: "Notes", icon: BookOpen },
  { href: "/files", label: "Files", icon: FileText },
  { href: "/settings", label: "Alerts", icon: Settings },
];

const desktopExtra = [{ href: "/courses", label: "Courses", icon: Layers }];

export function DesktopNav() {
  const path = usePathname();
  return (
    <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r border-[var(--border)] p-4 md:flex">
      <div className="mb-6 px-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Night study
        </p>
        <p className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight">NOTEX</p>
      </div>
      {[...items.slice(0, 4), ...desktopExtra, items[4]].map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-[var(--accent)] font-semibold text-[var(--accent-foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[var(--border)] bg-[var(--card)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px]",
              active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]",
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
