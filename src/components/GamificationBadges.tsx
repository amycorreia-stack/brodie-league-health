import { TIER_LABEL, type Tier } from "@/lib/scoring/gamification";

/**
 * Status pills with the "ON THE CLOCK / → DONE" aesthetic from the rest
 * of the Brodie suite. Always-dark chip background so they read as a
 * discrete element in both light and dark themes. Subtle tinted border
 * per status, glow on the leading dot.
 */

const CHIP_BG = "#1F1F23";        // dark glass — same color both themes
const CHIP_TEXT = "#F2F2F4";       // light text always
const CHIP_TEXT_MUTE = "#8A8A92"; // for sublabels

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
  background: CHIP_BG,
  border: "1px solid #2A2A2F",
  color: CHIP_TEXT,
  transition: "border-color 160ms ease",
};

function dotColor(tier: Tier): string {
  if (tier === "hall_of_fame") return "#F2A900";
  if (tier === "elite")        return "#af52de";
  if (tier === "pro")          return "#007aff";
  return "#34d399"; // rookie
}

function tierBorder(tier: Tier): string {
  if (tier === "hall_of_fame") return "rgba(242, 169, 0, 0.45)";
  if (tier === "elite")        return "rgba(175, 82, 222, 0.45)";
  if (tier === "pro")          return "rgba(0, 122, 255, 0.45)";
  return "rgba(52, 211, 153, 0.45)";
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
        boxShadow: `0 0 0 1px rgba(0,0,0,0.4), 0 0 8px ${color}90`,
        display: "inline-block",
      }}
    />
  );
}

export function TierBadge({ tier, avg30d }: { tier: Tier; avg30d?: number | null }) {
  return (
    <span style={{ ...PILL_BASE, borderColor: tierBorder(tier) }}>
      <GlowDot color={dotColor(tier)} />
      <span>{TIER_LABEL[tier]}</span>
      {avg30d != null && (
        <span style={{ color: CHIP_TEXT_MUTE, fontWeight: 500 }}>
          · {Math.round(avg30d)}% / 30d
        </span>
      )}
    </span>
  );
}

export function StreakBadge({ days }: { days: number }) {
  if (!days) {
    return (
      <span style={{ ...PILL_BASE, color: CHIP_TEXT_MUTE }}>
        <span aria-hidden style={{ opacity: 0.5 }}>🔥</span>
        <span>No streak</span>
      </span>
    );
  }
  const intense = days >= 7;
  return (
    <span
      style={{
        ...PILL_BASE,
        color: intense ? "#fb923c" : CHIP_TEXT,
        borderColor: intense ? "rgba(251, 146, 60, 0.55)" : "rgba(251, 146, 60, 0.3)",
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
        color: "#F2A900",
        borderColor: "rgba(242, 169, 0, 0.55)",
      }}
    >
      <span aria-hidden>{kind === "daily" ? "🥇" : "🏅"}</span>
      <span>{kind === "daily" ? "Today's champion" : "This week's champion"}</span>
    </span>
  );
}
