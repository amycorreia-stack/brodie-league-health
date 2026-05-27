import { TIER_ICON, TIER_LABEL, type Tier } from "@/lib/scoring/gamification";

export function TierBadge({ tier, avg30d }: { tier: Tier; avg30d?: number | null }) {
  const color =
    tier === "hall_of_fame" ? "border-glass-gold text-glass-gold bg-glass-gold/10" :
    tier === "elite"        ? "border-purple-400/40 text-purple-300 bg-purple-400/10" :
    tier === "pro"          ? "border-blue-400/40 text-blue-300 bg-blue-400/10" :
                              "border-glass-border text-glass-text-secondary bg-glass-surface";
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${color}`}>
      <span>{TIER_ICON[tier]}</span>
      <span>{TIER_LABEL[tier]}</span>
      {avg30d != null && <span className="text-glass-text-tertiary font-normal">· {Math.round(avg30d)}% / 30d</span>}
    </span>
  );
}

export function StreakBadge({ days }: { days: number }) {
  if (!days) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-glass-border text-glass-text-tertiary bg-glass-surface text-xs font-semibold">
        <span className="opacity-40">🔥</span>
        <span>No streak</span>
      </span>
    );
  }
  const intense = days >= 7;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${
      intense
        ? "border-orange-400/60 text-orange-300 bg-orange-400/15"
        : "border-orange-400/30 text-orange-200 bg-orange-400/5"
    }`}>
      <span>🔥</span>
      <span>{days}-day streak</span>
    </span>
  );
}

export function ChampionRibbon({ kind }: { kind: "daily" | "weekly" }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-glass-gold/50 text-glass-gold bg-glass-gold/10 text-xs font-semibold">
      <span>{kind === "daily" ? "🥇" : "🏅"}</span>
      <span>{kind === "daily" ? "Today's champion" : "This week's champion"}</span>
    </span>
  );
}
