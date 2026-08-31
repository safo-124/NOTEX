import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Fraunces, Karla, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", weight: ["400", "600"] });
const body = Karla({ subsets: ["latin"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "NOTEX",
  description: "Night study schedule, notes and reminders",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "NOTEX", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1424" },
  ],
  viewportFit: "cover",
};

/**
 * The theme choice rides on a cookie, so the server can stamp it on <html>
 * before anything renders. No pre-paint script, no flash, and nothing for
 * React to complain about.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const choice = (await cookies()).get("notex-theme")?.value;
  const theme = choice === "dark" || choice === "light" ? choice : undefined;

  return (
    <html lang="en" data-theme={theme} suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} ${mono.variable} font-sans`}>{children}</body>
    </html>
  );
}
