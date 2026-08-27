"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Bottom sheet on phones, centred dialog on desktop. Built on <dialog>. */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 w-full max-w-lg bg-transparent p-0 text-[var(--foreground)] backdrop:bg-black/55",
        "mt-auto sm:m-auto",
        className,
      )}
    >
      <div className="flex flex-col gap-4 rounded-t-2xl border border-[var(--border)] bg-[var(--card)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lg sm:rounded-2xl sm:pb-5">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
