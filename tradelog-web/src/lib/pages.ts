export type PageId =
  | "dashboard"
  | "journal"
  | "reviews"
  | "analytics"
  | "strategies"
  | "psychology"
  | "calendar"
  | "settings";

export const PAGES: Record<PageId, { title: string; sub: string }> = {
  dashboard: { title: "Overview", sub: "Your trading performance at a glance." },
  journal: { title: "Trade Journal", sub: "Your trading history, in one place." },
  reviews: { title: "Trade Reviews", sub: "Review decisions, execution and psychology." },
  analytics: { title: "Analytics", sub: "Turn results into repeatable insights." },
  strategies: { title: "Strategy Performance", sub: "Compare the setups behind your results." },
  psychology: { title: "Psychology", sub: "Notice the emotions behind your decisions." },
  calendar: { title: "Review Calendar", sub: "Build a consistent post-trade review habit." },
  settings: { title: "Settings", sub: "Your workspace and account." },
};

export const NAV: { id: PageId; icon: string; label: string; short: string }[] = [
  { id: "dashboard", icon: "◫", label: "Overview", short: "Overview" },
  { id: "journal", icon: "▤", label: "Trade Journal", short: "Journal" },
  { id: "reviews", icon: "☑", label: "Trade Reviews", short: "Reviews" },
  { id: "analytics", icon: "⌁", label: "Analytics", short: "Analytics" },
  { id: "strategies", icon: "◎", label: "Strategies", short: "Strategies" },
  { id: "psychology", icon: "◉", label: "Psychology", short: "Mindset" },
  { id: "calendar", icon: "▦", label: "Review Calendar", short: "Calendar" },
  { id: "settings", icon: "⚙", label: "Settings", short: "Settings" },
];

/** Pages whose numbers follow the date-range selector. */
export const RANGED_PAGES: PageId[] = ["dashboard", "analytics", "strategies", "psychology"];

export function isPageId(value: string): value is PageId {
  return value in PAGES;
}
