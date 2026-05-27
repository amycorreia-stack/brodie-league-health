import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ymd } from "@/lib/source-apps/util";
import { scoreColor } from "@/lib/colors";
import { TIER_ICON, TIER_LABEL, type Tier } from "@/lib/scoring/gamification";

export default async function Leaderboard() {
  await requireUser();
  const sb = await createClient();
  const today = ymd(new Date());

  const { data: rows } = await sb
    .from("lm_xp_totals")
    .select("lm_id, total_xp, max_xp, pct, rank_overall, league_managers!inner(full_name, location_name, district, current_streak, tier, avg_30d)")
    .eq("snapshot_date", today)
    .order("total_xp", { ascending: false })
    .limit(100);

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="text-glass-text-secondary text-sm mt-1">
          Today&apos;s ranking. Opt out from My Day if you want off the board.
        </p>
      </header>

      <div className="rounded-2xl border border-glass-border bg-glass-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-glass-surface-hover text-glass-text-tertiary uppercase text-[10px] tracking-wider">
            <tr>
              <th className="text-left p-3 font-semibold w-12">Rank</th>
              <th className="text-left p-3 font-semibold">LM</th>
              <th className="text-left p-3 font-semibold">Tier</th>
              <th className="text-left p-3 font-semibold">Streak</th>
              <th className="text-right p-3 font-semibold">XP</th>
              <th className="text-right p-3 font-semibold">Today %</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => {
              const row = r as unknown as {
                lm_id: string;
                total_xp: number;
                max_xp: number;
                pct: number;
                rank_overall: number;
                league_managers: { full_name: string; location_name: string | null; district: string | null; current_streak: number; tier: Tier; avg_30d: number | null };
              };
              const pct = Math.round(row.pct);
              const lmInfo = row.league_managers;
              const isChamp = row.rank_overall === 1;
              return (
                <tr key={row.lm_id} className={`border-t border-glass-border-light hover:bg-glass-surface-hover ${isChamp ? "bg-glass-gold/5" : ""}`}>
                  <td className="p-3 font-mono text-glass-text-secondary">
                    {isChamp ? <span className="text-glass-gold">🥇</span> : row.rank_overall}
                  </td>
                  <td className="p-3">
                    <div>{lmInfo.full_name}</div>
                    <div className="text-xs text-glass-text-tertiary">{lmInfo.location_name}{lmInfo.district ? ` · ${lmInfo.district}` : ""}</div>
                  </td>
                  <td className="p-3 text-xs">
                    <span title={`${Math.round(lmInfo.avg_30d ?? 0)}% / 30d avg`}>
                      {TIER_ICON[lmInfo.tier]} {TIER_LABEL[lmInfo.tier]}
                    </span>
                  </td>
                  <td className="p-3 text-xs">
                    {lmInfo.current_streak > 0 ? <span>🔥 {lmInfo.current_streak}d</span> : <span className="text-glass-text-tertiary">—</span>}
                  </td>
                  <td className="p-3 text-right">{Math.round(row.total_xp)} / {Math.round(row.max_xp)}</td>
                  <td className={`p-3 text-right font-semibold ${scoreColor(pct)}`}>{pct}%</td>
                </tr>
              );
            })}
            {(!rows || rows.length === 0) && (
              <tr><td colSpan={6} className="p-6 text-center text-glass-text-tertiary">No scores yet today.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
