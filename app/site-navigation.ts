export const primaryNavigation = [
  { href: "/start", label: "BUYER JOURNEY", key: "start" },
  { href: "/auctions", label: "LIVE AUCTIONS", key: "live" },
  { href: "/inventory", label: "DEMO VEHICLES", key: "inventory" },
  { href: "/payments", label: "PAYMENTS", key: "payments" },
  { href: "/documents", label: "DOCUMENTS", key: "documents" },
  { href: "/transport", label: "TRANSPORT", key: "transport" },
  { href: "/support", label: "SUPPORT", key: "support" },
] as const;

export const accountNavigation = {
  profile: "/profile",
  login: "/login",
  register: "/register",
} as const;
