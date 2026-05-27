"use client";

import { useState } from "react";

export function LeaderboardOptInToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function flip() {
    setBusy(true);
    const next = !on;
    const res = await fetch("/api/me/leaderboard-opt-in", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ opt_in: next }),
    });
    if (res.ok) setOn(next);
    setBusy(false);
  }

  return (
    <button
      onClick={flip}
      disabled={busy}
      className="text-xs px-3 py-1.5 rounded-full border border-glass-border bg-glass-surface hover:bg-glass-surface-hover transition"
      title="Toggle whether you appear on the global leaderboard"
    >
      Leaderboard:{" "}
      <span className={on ? "text-glass-gold font-semibold" : "text-glass-text-tertiary"}>
        {on ? "on" : "off"}
      </span>
    </button>
  );
}
