import type { LiveCounters as Counters } from "@/lib/live-counters";

export function LiveCountersStrip({ counters }: { counters: Counters }) {
  if (!counters.source_available) return null;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <CounterCard
        label="Registered teams"
        sublabel={counters.season_label ? `Current season · ${counters.season_label}` : "Current season"}
        value={counters.registered_teams_current_season}
        accent
      />
      {/* Slots reserved for upcoming live counters (e.g. paid invoices this month,
          shifts filled this week, etc.). Keeping the grid balanced for now. */}
      <CounterCard label="Coming soon" sublabel="More live counters as we add them" value={null} />
      <CounterCard label="Coming soon" sublabel="More live counters as we add them" value={null} />
    </section>
  );
}

function CounterCard({
  label,
  sublabel,
  value,
  accent = false,
}: {
  label: string;
  sublabel: string;
  value: number | null;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: "var(--glass-surface)",
        borderColor: accent ? "var(--glass-gold)" : "var(--glass-border)",
      }}
    >
      <p
        className="uppercase text-[10px] tracking-[0.08em] font-semibold mb-1"
        style={{ color: accent ? "var(--glass-gold)" : "var(--glass-text-tertiary)" }}
      >
        {label}
      </p>
      <p className="text-4xl font-semibold tracking-tight">
        {value == null ? <span style={{ color: "var(--glass-text-tertiary)" }}>—</span> : value}
      </p>
      <p className="text-xs mt-1" style={{ color: "var(--glass-text-tertiary)" }}>{sublabel}</p>
    </div>
  );
}
