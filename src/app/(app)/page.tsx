import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ymd, daysAgo } from "@/lib/source-apps/util";
import { scoreColor, scoreBg } from "@/lib/colors";
import { ActionItemRow } from "@/components/ActionItemRow";
import { LeaderboardOptInToggle } from "@/components/LeaderboardOptInToggle";
import { TierBadge, StreakBadge, ChampionRibbon } from "@/components/GamificationBadges";
import { ViewAsBanner, ViewAsSwitcher } from "@/components/ViewAs";
import { LiveCountersStrip } from "@/components/LiveCounters";
import { loadLiveCounters } from "@/lib/live-counters";
import type { Tier } from "@/lib/scoring/gamification";
import Link from "next/link";

type LMRow = {
  id: string;
  full_name: string;
  email: string;
  location_name: string | null;
  district: string | null;
  current_streak: number;
  longest_streak: number;
  tier: Tier;
  avg_30d: number | null;
};

export default async function MyDay({
  searchParams,
}: {
  searchParams: Promise<{ lm?: string }>;
}) {
  const ctx = await requireUser();
  const sb = await createClient();
  const today = ymd(new Date());
  const sevenAgo = ymd(daysAgo(new Date(), 7));

  const { lm: viewAsId } = await searchParams;
  const isAdmin = ctx.profile?.role === "dm" || ctx.profile?.role === "super_admin";
  const viewingAs = isAdmin && !!viewAsId;

  // Pick the LM row. If admin is viewing-as, use admin client to bypass RLS
  // (their own RLS would normally let them see other LMs anyway, but this is
  // explicit and faster).
  let lm: LMRow | null = null;
  if (viewingAs) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("league_managers")
      .select("id, full_name, email, location_name, district, current_streak, longest_streak, tier, avg_30d")
      .eq("id", viewAsId)
      .maybeSingle();
    lm = (data ?? null) as LMRow | null;
  } else {
    const { data } = await sb
      .from("league_managers")
      .select("id, full_name, email, location_name, district, current_streak, longest_streak, tier, avg_30d")
      .eq("email", (ctx.user.email ?? "").toLowerCase())
      .maybeSingle();
    lm = (data ?? null) as LMRow | null;
  }

  // Admin-only roster for the switcher dropdown (lazy: only fetched when admin)
  let switcherOptions: Array<{ id: string; full_name: string; location_name: string | null }> = [];
  if (isAdmin) {
    const admin = createAdminClient();
    const { data: roster } = await admin
      .from("league_managers")
      .select("id, full_name, location_name")
      .eq("active", true)
      .order("full_name", { ascending: true });
    switcherOptions = (roster ?? []) as Array<{ id: string; full_name: string; location_name: string | null }>;
  }

  if (!lm) {
    return (
      <main className="space-y-6">
        {viewingAs && <ViewAsBanner name="Unknown LM" options={switcherOptions} />}
        <h1 className="text-3xl font-semibold tracking-tight">Welcome.</h1>
        <p className="text-glass-text-secondary">
          {viewingAs
            ? "That LM isn't in our roster anymore."
            : "We don't see you in the CRM managers table yet. Ask an admin to add you, then refresh."}
        </p>
        {isAdmin && !viewingAs && (
          <div className="pt-4">
            <p className="text-xs text-glass-text-tertiary mb-2 uppercase tracking-wider font-semibold">
              You&apos;re an admin — view as any LM:
            </p>
            <ViewAsSwitcher options={switcherOptions} />
          </div>
        )}
      </main>
    );
  }

  const lmId = lm.id;

  const { data: xpRow } = await sb
    .from("lm_xp_totals")
    .select("total_xp, max_xp, pct, rank_overall, breakdown")
    .eq("lm_id", lmId)
    .eq("snapshot_date", today)
    .maybeSingle();

  const { data: yesterdayRow } = await sb
    .from("lm_xp_totals")
    .select("pct")
    .eq("lm_id", lmId)
    .eq("snapshot_date", ymd(daysAgo(new Date(), 1)))
    .maybeSingle();

  const { data: trend } = await sb
    .from("lm_xp_totals")
    .select("snapshot_date, pct")
    .eq("lm_id", lmId)
    .gte("snapshot_date", sevenAgo)
    .order("snapshot_date", { ascending: true });

  const { data: actions } = await sb
    .from("daily_action_items")
    .select("id, title, detail, severity, app_id, resolved_at, metrics:metric_id(slug, scoring_rule)")
    .eq("lm_id", lmId)
    .eq("snapshot_date", today)
    .order("severity", { ascending: true });

  const { data: apps } = await sb.from("apps").select("id, slug, name");
  const appNameById = new Map((apps ?? []).map((a: { id: string; name: string }) => [a.id, a.name]));
  const appNameBySlug = new Map((apps ?? []).map((a: { slug: string; name: string }) => [a.slug, a.name]));

  const { data: recentUnlocks } = await sb
    .from("lm_achievements")
    .select("unlocked_at, achievements!inner(slug, name, icon)")
    .eq("lm_id", lmId)
    .gte("unlocked_at", sevenAgo)
    .order("unlocked_at", { ascending: false })
    .limit(5);

  // Live counters (current-season registrations, etc.) — fresh per page load.
  const liveCounters = await loadLiveCounters(lm.email);

  const todayRank = (xpRow as { rank_overall?: number } | null)?.rank_overall;
  const isDailyChamp = todayRank === 1;

  const { data: weekly } = await sb
    .from("lm_xp_totals")
    .select("lm_id, pct")
    .gte("snapshot_date", sevenAgo);
  const weeklySum = new Map<string, number>();
  for (const r of (weekly ?? []) as Array<{ lm_id: string; pct: number }>) {
    weeklySum.set(r.lm_id, (weeklySum.get(r.lm_id) ?? 0) + Number(r.pct));
  }
  const weeklyTop = [...weeklySum.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const isWeeklyChamp = weeklyTop === lmId;

  const pct = Math.round((xpRow as { pct?: number } | null)?.pct ?? 0);
  const xp = Math.round((xpRow as { total_xp?: number } | null)?.total_xp ?? 0);
  const maxXp = Math.round((xpRow as { max_xp?: number } | null)?.max_xp ?? 100);
  const yesterdayPct = (yesterdayRow as { pct?: number } | null)?.pct;
  const delta = yesterdayPct != null ? Math.round(pct - yesterdayPct) : null;
  const breakdown = ((xpRow as { breakdown?: Record<string, { score: number; max: number }> } | null)?.breakdown) ?? {};

  const firstName = (lm.full_name ?? ctx.user.email ?? "").split(" ")[0];

  return (
    <main className="space-y-8">
      {viewingAs && <ViewAsBanner name={lm.full_name} options={switcherOptions} />}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-glass-text-tertiary text-xs uppercase tracking-wider">
            {lm.location_name ?? "—"} {lm.district ? `· ${lm.district}` : ""}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {viewingAs ? `${lm.full_name}'s day` : `Good day, ${firstName}.`}
          </h1>
          <div className="flex flex-wrap gap-2 pt-1">
            <TierBadge tier={lm.tier} avg30d={lm.avg_30d} />
            <StreakBadge days={lm.current_streak ?? 0} />
            {isDailyChamp && <ChampionRibbon kind="daily" />}
            {isWeeklyChamp && !isDailyChamp && <ChampionRibbon kind="weekly" />}
          </div>
        </div>
        {!viewingAs && (
          <LeaderboardOptInToggle initial={ctx.profile?.opt_in_leaderboard ?? true} />
        )}
      </header>

      <LiveCountersStrip counters={liveCounters} />

      <section className={`rounded-2xl border p-6 ${scoreBg(pct)}`}>
        <div className="flex items-end gap-6 flex-wrap">
          <div>
            <p className="uppercase text-[11px] text-glass-text-tertiary tracking-[0.08em] font-semibold">Today&apos;s XP</p>
            <p className={`text-6xl font-semibold tracking-tight ${scoreColor(pct)}`}>
              {xp}<span className="text-glass-text-tertiary text-2xl"> / {maxXp}</span>
            </p>
            <p className="text-glass-text-secondary text-sm mt-1 flex items-center gap-2">
              <span>{pct}% of max</span>
              {todayRank && <span>· rank #{todayRank}</span>}
              {delta != null && delta !== 0 && (
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${delta > 0 ? "bg-green-500/15 text-green-300" : "bg-red-500/15 text-red-300"}`}>
                  {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} vs yest.
                </span>
              )}
            </p>
          </div>
          <div className="flex-1 min-w-[240px]">
            <p className="uppercase text-[11px] text-glass-text-tertiary tracking-[0.08em] font-semibold mb-2">Last 7 days</p>
            <Sparkline points={((trend ?? []) as Array<{ snapshot_date: string; pct: number }>).map((t) => ({ d: t.snapshot_date, p: Math.round(t.pct) }))} />
          </div>
        </div>
      </section>

      {(recentUnlocks ?? []).length > 0 && (
        <section className="rounded-2xl border border-glass-gold/30 bg-glass-gold/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider text-glass-gold font-semibold">Recently unlocked</p>
            <Link href={viewingAs ? `/achievements?lm=${lm.id}` : "/achievements"} className="text-xs text-glass-text-tertiary hover:text-glass-text">Full cabinet →</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {((recentUnlocks ?? []) as unknown as Array<{ unlocked_at: string; achievements: { slug: string; name: string; icon: string } }>).map((u, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-glass-surface-hover border border-glass-gold/30 text-sm">
                <span>{u.achievements.icon}</span>
                <span className="font-semibold">{u.achievements.name}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-base font-semibold mb-3">By app</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(breakdown).map(([slug, v]) => {
            const p = Math.round((v.score / Math.max(v.max, 1)) * 100);
            return (
              <div key={slug} className={`rounded-xl border p-4 ${scoreBg(p)}`}>
                <p className="text-glass-text-tertiary text-[10px] uppercase tracking-wider font-semibold">{appNameBySlug.get(slug) ?? slug}</p>
                <p className={`text-2xl font-semibold mt-1 ${scoreColor(p)}`}>{p}%</p>
                <p className="text-glass-text-tertiary text-xs mt-0.5">{Math.round(v.score)} / {Math.round(v.max)} pts</p>
              </div>
            );
          })}
          {Object.keys(breakdown).length === 0 && (
            <p className="text-glass-text-secondary col-span-full">No data yet. Admin needs to run a sync.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold mb-3">
          Today&apos;s focus
          {actions?.length ? (
            <span className="text-glass-text-tertiary text-sm ml-2 font-normal">
              {actions.filter((a: { resolved_at: string | null }) => !a.resolved_at).length} open
            </span>
          ) : null}
        </h2>
        <ul className="space-y-2">
          {(actions ?? []).map((a) => {
            const item = a as unknown as {
              id: string;
              title: string;
              detail: string | null;
              severity: string;
              app_id: string;
              resolved_at: string | null;
              metrics: { slug: string; scoring_rule: { type?: string; xp_per_unit?: number } } | null;
            };
            const rule = item.metrics?.scoring_rule ?? {};
            const xpReward = rule.type === "reward_on_resolve" ? Number(rule.xp_per_unit ?? 0) : 0;
            return (
              <ActionItemRow
                key={item.id}
                id={item.id}
                title={item.title}
                detail={item.detail}
                severity={item.severity}
                appName={appNameById.get(item.app_id) ?? ""}
                resolvedAt={item.resolved_at}
                readOnly={viewingAs}
                xpReward={xpReward}
              />
            );
          })}
          {(!actions || actions.length === 0) && (
            <li className="text-glass-text-secondary">Clean board. Keep stacking.</li>
          )}
        </ul>
      </section>
    </main>
  );
}

function Sparkline({ points }: { points: Array<{ d: string; p: number }> }) {
  if (!points.length) return <p className="text-glass-text-tertiary text-sm">No history yet.</p>;
  const w = 260, h = 60, pad = 4;
  const max = 100, min = 0;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const path = points
    .map((p, i) => {
      const x = pad + i * step;
      const y = h - pad - ((p.p - min) / (max - min)) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} style={{ color: "var(--glass-gold)" }}>
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} />
      {points.map((p, i) => {
        const x = pad + i * step;
        const y = h - pad - ((p.p - min) / (max - min)) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r={2.5} fill="currentColor" />;
      })}
    </svg>
  );
}
