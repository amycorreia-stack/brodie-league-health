import { TIER_ICON, TIER_LABEL, type Tier } from "@/lib/scoring/gamification";

/**
 * Glass pill styling — matches the "ON THE CLOCK / → DONE" aesthetic
 * across the Brodie suite. Dark glass surface, hairline border, soft glow
 * on the leading dot, tight type, uppercase letter-spacing.
 */

const PILL_BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  background: "rgba(28, 28, 30, 0.6)",
  border: "1px solid var(--glass-border)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  transition: "background 160ms ease, border-color 160ms ease",
};

function dotColor(tier: Tier): string {
  if (tier === "hall_of_fame") return "#FFB800";
  if (tier === "elite")        return "#af52de";
  if (tier === "pro")          return "#007aff";
  return "#34d399"; // rookie: green like "ON THE CLOCK"
}

function tierBorder(tier: Tier): string {
  if (tier === "hall_of_fame") return "rgba(255, 184, 0, 0.4)";
  if (tier === "elite")        return "rgba(175, 82, 222, 0.4)";
  if (tier === "pro")          return "rgba(0, 122, 255, 0.4)";
  return "rgba(52, 211, 153, 0.35)";
}

function GlowDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 0 1px rgba(0,0,0,0.4), 0 0 6px ${color}80`,
        display: "inline-block",
      }}
    />
  );
}

export function TierBadge({ tier, avg30d }: { tier: Tier; avg30d?: number | null }) {
  const dot = dotColor(tier);
  const border = tierBorder(tier);
  return (
    <span
      style={{
        ...PILL_BASE,
        borderColor: border,
        color: "var(--glass-text)",
      }}
    >
      <GlowDot color={dot} />
      <span>{TIER_LABEL[tier]}</span>
      {avg30d != null && (
        <span style={{ color: "var(--glass-text-tertiary)", fontWeight: 500 }}>
          · {Math.round(avg30d)}% / 30d
        </span>
      )}
    </span>
  );
}

export function StreakBadge({ days }: { days: number }) {
  if (!days) {
    return (
      <span style={{ ...PILL_BASE, color: "var(--glass-text-tertiary)" }}>
        <span aria-hidden style={{ opacity: 0.4 }}>🔥</span>
        <span>No streak</span>
      </span>
    );
  }
  const intense = days >= 7;
  return (
    <span
      style={{
        ...PILL_BASE,
        color: intense ? "#fb923c" : "var(--glass-text)",
        borderColor: intense ? "rgba(251, 146, 60, 0.5)" : "rgba(251, 146, 60, 0.25)",
        background: intense
          ? "linear-gradient(180deg, rgba(251, 146, 60, 0.10), rgba(28, 28, 30, 0.6))"
          : "rgba(28, 28, 30, 0.6)",
      }}
    >
      <span aria-hidden>🔥</span>
      <span>{days}-day streak</span>
    </span>
  );
}

export function ChampionRibbon({ kind }: { kind: "daily" | "weekly" }) {
  return (
    <span
      style={{
        ...PILL_BASE,
        color: "var(--glass-gold)",
        borderColor: "rgba(255, 184, 0, 0.5)",
        background:
          "linear-gradient(180deg, rgba(255, 184, 0, 0.12), rgba(28, 28, 30, 0.6))",
      }}
    >
      <span aria-hidden>{kind === "daily" ? "🥇" : "🏅"}</span>
      <span>{kind === "daily" ? "Today's champion" : "This week's champion"}</span>
    </span>
  );
}
