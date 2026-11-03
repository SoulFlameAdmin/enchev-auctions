import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "E&A East West Auctions",
    short_name: "E&A Auctions",
    description: "E&A Auctions — автомобилен каталог, търгове и профил от телефона.",
    start_url: "/app",
    scope: "/",
    lang: "bg",
    dir: "ltr",
    display: "standalone",
    background_color: "#050706",
    theme_color: "#090e0b",
    orientation: "any",
    categories: ["shopping", "business"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/brand/ea-2026-app.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Автомобили", short_name: "Каталог", url: "/inventory", icons: [{ src: "/pwa-icon/192", sizes: "192x192", type: "image/png" }] },
      { name: "Търгове — демо", short_name: "LIVE DEMO", url: "/live-auctions", icons: [{ src: "/pwa-icon/192", sizes: "192x192", type: "image/png" }] },
      { name: "Моят профил", short_name: "Профил", url: "/profile", icons: [{ src: "/pwa-icon/192", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
