import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NOTEX",
    short_name: "NOTEX",
    description: "Night study schedule, notes and reminders",
    start_url: "/tonight",
    display: "standalone",
    background_color: "#0e1424",
    theme_color: "#0e1424",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
