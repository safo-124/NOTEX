"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stamped = document.documentElement.getAttribute("data-theme");
    if (stamped === "dark" || stamped === "light") {
      setTheme(stamped);
      return;
    }
    setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);

  if (theme === null) return <span className="size-10" />;

  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => {
        setTheme(next);
        document.documentElement.setAttribute("data-theme", next);
        // A cookie rather than localStorage, so the server can stamp the
        // attribute on the next request and the page never flashes.
        document.cookie = `notex-theme=${next}; path=/; max-age=31536000; samesite=lax`;
      }}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
