/* Browser-local preview watchlist. No user identity or Supabase persistence.
 * Do NOT use this as evidence for production saved-vehicle functionality.
 */
export type DemoSavedVehicle = {
  lot: string;
  title: string;
  location: string;
  damage: string;
  bid: number;
  state: "LIVE" | "UPCOMING" | "BUY NOW";
  image: string;
};

export const DEMO_WATCHLIST_KEY = "enchev-demo-watchlist-v1";
export const DEMO_WATCHLIST_EVENT = "enchev:demo-watchlist-changed";

const previewVehicles: DemoSavedVehicle[] = [
  { lot: "EA-10539", title: "2022 Audi RS3 Sportback", location: "Crewe, UK", damage: "Minor scratches", bid: 21900, state: "LIVE", image: "https://images.unsplash.com/photo-1655283733642-f1d813b40616?auto=format&fit=crop&w=1100&q=84" },
  { lot: "EA-10627", title: "2020 BMW X5 xDrive40i", location: "Texas, USA", damage: "Rear end", bid: 15100, state: "UPCOMING", image: "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1100&q=84" },
  { lot: "EA-10603", title: "2026 Volkswagen Golf GTI", location: "London, UK", damage: "Clean title", bid: 16250, state: "BUY NOW", image: "https://images.unsplash.com/photo-1767949374162-5cbb31071b8f?auto=format&fit=crop&w=1100&q=84" },
];

function valid(value: unknown): value is DemoSavedVehicle {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DemoSavedVehicle>;
  return typeof item.lot === "string"
    && /^EA-\d{5}$/.test(item.lot)
    && typeof item.title === "string"
    && typeof item.location === "string"
    && typeof item.damage === "string"
    && typeof item.image === "string"
    && typeof item.bid === "number"
    && Number.isFinite(item.bid)
    && (item.state === "LIVE" || item.state === "UPCOMING" || item.state === "BUY NOW");
}

export function getDemoWatchlist(): DemoSavedVehicle[] {
  if (typeof window === "undefined") return [...previewVehicles];
  try {
    const raw = localStorage.getItem(DEMO_WATCHLIST_KEY);
    if (raw === null) return [...previewVehicles];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...previewVehicles];
    return parsed.filter(valid).slice(0, 250);
  } catch {
    return [...previewVehicles];
  }
}

export function setDemoWatchlist(items: DemoSavedVehicle[]): DemoSavedVehicle[] {
  if (typeof window === "undefined") return items;
  const unique = Array.from(new Map(items.filter(valid).map(item => [item.lot, item])).values()).slice(0, 250);
  try {
    localStorage.setItem(DEMO_WATCHLIST_KEY, JSON.stringify(unique));
    window.dispatchEvent(new Event(DEMO_WATCHLIST_EVENT));
  } catch {
    // Storage-disabled browsers retain the in-memory UI state.
  }
  return unique;
}
