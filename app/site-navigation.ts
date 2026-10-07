export const primaryNavigation = [
  { href: "/inventory", label: "VEHICLES", key: "inventory" },
  { href: "/live-auctions", label: "LIVE AUCTIONS", key: "live" },
  { href: "/#how", label: "HOW TO BUY", key: "how" },
  { href: "/transport", label: "TRANSPORT", key: "transport" },
  { href: "/vehicle-history", label: "VEHICLE HISTORY", key: "history" },
  { href: "/support", label: "SUPPORT", key: "support" },
] as const;

export const accountNavigation = {
  profile: "/profile",
  register: "/profile?view=register",
} as const;
