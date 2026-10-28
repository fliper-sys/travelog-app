import type { TradeData } from "@/lib/offline/useTradeData";

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const plural = (n: number) => `${n} change${n === 1 ? "" : "s"}`;

export function syncLabel(d: Pick<TradeData, "state" | "pendingCount" | "lastSync" | "slow">): {
  short: string;
  long: string;
} {
  switch (d.state) {
    case "syncing":
      return d.slow
        ? {
            short: "Waiting for connection…",
            long: d.pendingCount ? ` · ${plural(d.pendingCount)} saved on this device` : " · all saved on this device",
          }
        : { short: "Syncing…", long: "" };
    case "offline":
      return {
        short: "Offline",
        long: d.pendingCount ? ` · ${plural(d.pendingCount)} saved on this device` : " · all saved on this device",
      };
    case "pending":
      return { short: `${plural(d.pendingCount)} waiting`, long: "" };
    case "problem":
      return { short: "Sync problem", long: "" };
    default:
      return { short: "Synced", long: d.lastSync ? ` · ${timeAgo(d.lastSync)}` : "" };
  }
}

/** Small pill showing whether data is safely on the server. */
export default function SyncStatus({ data }: { data: TradeData }) {
  const { short, long } = syncLabel(data);
  return (
    <span className={`sync-pill ${data.state}`} role="status" aria-live="polite">
      <span className="dot" aria-hidden="true" />
      <span>
        {short}
        <span className="long">{long}</span>
      </span>
    </span>
  );
}
