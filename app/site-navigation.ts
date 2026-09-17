export const primaryNavigation = [
  { href: "/inventory", label: "АВТОМОБИЛИ", key: "inventory" },
  { href: "/live-auctions", label: "ТЪРГОВЕ НА ЖИВО", key: "live" },
  { href: "/#how", label: "КАК ДА КУПЯ", key: "how" },
  { href: "/transport", label: "ТРАНСПОРТ", key: "transport" },
  { href: "/vehicle-history", label: "ИСТОРИЯ НА МПС", key: "history" },
  { href: "/support", label: "ПОДДРЪЖКА", key: "support" },
] as const;

export const accountNavigation = {
  profile: "/profile",
  register: "/profile?view=register",
} as const;
