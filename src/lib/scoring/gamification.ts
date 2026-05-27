import { createAdminClient } from "@/lib/supabase/admin";
import { ymd, daysAgo } from "@/lib/source-apps/util";

export type Tier = "rookie" | "pro" | "elite" | "hall_of_fame";

const TIER_THRESHOLDS: Array<{ tier: Tier; minAvgPct: number }> = [
  { tier: "hall_of_fame", minAvgPct: 85 },
  { tier: "elite",        minAvgPct: 70 },
  { tier: "pro",          minAvgPct: 50 },
  { tier: "rookie",       minAvgPct: 0 },
];

export const TIER_LABEL: Record<Tier, string> = {
  rookie: "Rookie",
  pro: "Pro",
  elite: "Elite",
  hall_of_fame: "Hall of Fame",
};
export const TIER_ICON: Record<Tier, string> = {
  rookie: "🟢",
  pro: "🏀",
  elite: "🏆",
  hall_of_fame: "👑",
};
const TIER_ORDER: Tier[] = ["rookie", "pro", "elite", "hall_of_fame"];
export function tierAtLeast(actual: Tier, min: Tier): boolean {
  return TIER_ORDER.indexOf(actual) >= TIER_ORDER.indexOf(min);
}

export const STREAK_THRESHOLD_PCT = 80;

function tierFor(avgPct: number): Tier {
  for (const t of TIER_THRESHOLDS) if (avgPct >= t.minAvgPct) return t.tier;
  return "rookie";
}

/**
 * Recompute streak / longest_streak / tier / avg_30d for every LM AND check
 * achievements. Should run after recomputeScores.
 */
export async function recomputeGamification(date?: Date): Promise<{ updated: number; awarded: number }> {
  const sb = createAdminClient();
  const today = date ?? new Date();
  const todayStr = ymd(today);
  const thirtyAgo = ymd(daysAgo(today, 30));
  const sevenAgo = ymd(daysAgo(today, 6)); // last 7 days inclusive of today

  const { data: lms } = await sb
    .from("league_managers")
    .select("id, email, current_streak, longest_streak, tier")
    .eq("active", true);
  const lmList = (lms ?? []) as Array<{ id: string; email: string; current_streak: number; longest_streak: number; tier: string }>;

  const { data: xpRows } = await sb
    .from("lm_xp_totals")
    .select("lm_id, snapshot_date, pct, rank_overall")
    .gte("snapshot_date", thirtyAgo)
    .lte("snapshot_date", todayStr)
    .order("snapshot_date", { ascending: false });

  // group xp by lm
  const xpByLm = new Map<string, Array<{ date: string; pct: number; rank: number | null }>>();
  for (const r of (xpRows ?? []) as Array<{ lm_id: string; snapshot_date: string; pct: number; rank_overall: number | null }>) {
    if (!xpByLm.has(r.lm_id)) xpByLm.set(r.lm_id, []);
    xpByLm.get(r.lm_id)!.push({ date: r.snapshot_date, pct: Number(r.pct), rank: r.rank_overall });
  }

  // weekly champion: who has the highest sum(pct) over last 7 days?
  const weeklySum = new Map<string, number>();
  for (const [lmId, days] of xpByLm) {
    const sum = days.filter((d) => d.date >= sevenAgo).reduce((s, d) => s + d.pct, 0);
    weeklySum.set(lmId, sum);
  }
  const weeklyChampId =
    [...weeklySum.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // achievement catalog
  const { data: achievements } = await sb.from("achievements").select("id, slug, criteria");
  type Ach = { id: string; slug: string; criteria: Record<string, unknown> };
  const achList = (achievements ?? []) as Ach[];
  const achBySlug = new Map(achList.map((a) => [a.slug, a]));

  const { data: existing } = await sb
    .from("lm_achievements")
    .select("lm_id, achievement_id");
  const existingSet = new Set(
    (existing ?? []).map((e: { lm_id: string; achievement_id: string }) => `${e.lm_id}:${e.achievement_id}`)
  );

  // per-LM metric history for metric_streak checks
  const { data: snapHistory } = await sb
    .from("daily_snapshots")
    .select("lm_id, snapshot_date, score, max_score, metrics!inner(app_id, slug), apps:metrics(app_id)")
    .gte("snapshot_date", thirtyAgo);

  type SnapRow = {
    lm_id: string;
    snapshot_date: string;
    score: number;
    max_score: number;
    metrics: { app_id: string; slug: string };
  };
  const snaps = (snapHistory ?? []) as unknown as SnapRow[];

  const { data: appsRows } = await sb.from("apps").select("id, slug");
  const appSlugById = new Map(
    (appsRows ?? []).map((a: { id: string; slug: string }) => [a.id, a.slug])
  );

  // today's clean-board check
  const { data: openActions } = await sb
    .from("daily_action_items")
    .select("lm_id, resolved_at")
    .eq("snapshot_date", todayStr);
  const openByLm = new Map<string, number>();
  for (const a of (openActions ?? []) as Array<{ lm_id: string; resolved_at: string | null }>) {
    openByLm.set(a.lm_id, (openByLm.get(a.lm_id) ?? 0) + (a.resolved_at ? 0 : 1));
  }

  const toAward: Array<{ lm_id: string; achievement_id: string }> = [];
  const lmUpdates: Array<{ id: string; current_streak: number; longest_streak: number; tier: Tier; avg_30d: number | null }> = [];

  for (const lm of lmList) {
    const days = xpByLm.get(lm.id) ?? [];
    if (!days.length) {
      lmUpdates.push({ id: lm.id, current_streak: 0, longest_streak: lm.longest_streak ?? 0, tier: "rookie", avg_30d: null });
      continue;
    }

    // sort desc by date (already), walk consecutive days
    const sortedDesc = [...days].sort((a, b) => b.date.localeCompare(a.date));
    const today0 = sortedDesc[0]?.date;
    let currentStreak = 0;
    if (today0 === todayStr) {
      const dayMap = new Map(sortedDesc.map((d) => [d.date, d.pct]));
      let cursor = today;
      while (true) {
        const k = ymd(cursor);
        const pct = dayMap.get(k);
        if (pct == null || pct < STREAK_THRESHOLD_PCT) break;
        currentStreak++;
        cursor = daysAgo(cursor, 1);
      }
    }
    const longestStreak = Math.max(currentStreak, lm.longest_streak ?? 0);

    const avg30 = days.reduce((s, d) => s + d.pct, 0) / days.length;
    const tier = tierFor(avg30);

    lmUpdates.push({
      id: lm.id,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      tier,
      avg_30d: Math.round(avg30 * 10) / 10,
    });

    // ---- achievement checks ----
    const todayRow = sortedDesc[0]?.date === todayStr ? sortedDesc[0] : null;
    const todayPct = todayRow?.pct ?? 0;
    const todayRank = todayRow?.rank ?? null;
    const yesterdayRow = sortedDesc[1]?.date === ymd(daysAgo(today, 1)) ? sortedDesc[1] : null;
    const dayDelta = yesterdayRow ? todayPct - yesterdayRow.pct : 0;

    // first_century: today's total_xp >= 100. We need actual XP not pct.
    // (cheap follow-up query per LM, but the table is small)
    const { data: todayXp } = await sb
      .from("lm_xp_totals")
      .select("total_xp")
      .eq("lm_id", lm.id)
      .eq("snapshot_date", todayStr)
      .maybeSingle();
    const xpToday = (todayXp as { total_xp?: number } | null)?.total_xp ?? 0;

    const tryAward = (slug: string, when: boolean) => {
      if (!when) return;
      const ach = achBySlug.get(slug);
      if (!ach) return;
      if (existingSet.has(`${lm.id}:${ach.id}`)) return;
      toAward.push({ lm_id: lm.id, achievement_id: ach.id });
      existingSet.add(`${lm.id}:${ach.id}`);
    };

    tryAward("first_century", xpToday >= 100);
    tryAward("perfect_day",   todayPct >= 100);
    tryAward("streak_3",      currentStreak >= 3);
    tryAward("streak_7",      currentStreak >= 7);
    tryAward("streak_30",     currentStreak >= 30);
    tryAward("tier_pro",      tierAtLeast(tier, "pro"));
    tryAward("tier_elite",    tierAtLeast(tier, "elite"));
    tryAward("tier_hof",      tierAtLeast(tier, "hall_of_fame"));
    tryAward("daily_champ",   todayRank === 1);
    tryAward("weekly_champ",  weeklyChampId === lm.id);
    tryAward("comeback_kid",  dayDelta >= 20);

    // clean_board: action items existed today AND all are resolved.
    // Need both a total-count and an unresolved-count > 0 vs 0.
    const { data: todayActions } = await sb
      .from("daily_action_items")
      .select("id, resolved_at")
      .eq("lm_id", lm.id)
      .eq("snapshot_date", todayStr);
    const acts = (todayActions ?? []) as Array<{ resolved_at: string | null }>;
    const cleanBoard = acts.length > 0 && acts.every((a) => !!a.resolved_at);
    tryAward("clean_board", cleanBoard);

    // crm_killer: 5 consecutive days at 95%+ score across all of CRM's metrics
    const lmSnaps = snaps.filter((s) => s.lm_id === lm.id);
    const crmAppId = [...appSlugById.entries()].find(([, slug]) => slug === "crm")?.[0];
    if (crmAppId) {
      const byDate = new Map<string, { score: number; max: number }>();
      for (const s of lmSnaps.filter((x) => x.metrics?.app_id === crmAppId)) {
        const e = byDate.get(s.snapshot_date) ?? { score: 0, max: 0 };
        e.score += Number(s.score);
        e.max += Number(s.max_score);
        byDate.set(s.snapshot_date, e);
      }
      const datesDesc = [...byDate.keys()].sort().reverse();
      let run = 0;
      for (const d of datesDesc) {
        const e = byDate.get(d)!;
        const pct = e.max ? (e.score / e.max) * 100 : 0;
        if (pct >= 95) run++; else break;
      }
      tryAward("crm_killer", run >= 5);
    }

    // facility_steward: invoice_on_time = 100% for 14 days straight
    const facAppId = [...appSlugById.entries()].find(([, slug]) => slug === "facilities")?.[0];
    if (facAppId) {
      const facMetricSnaps = lmSnaps.filter(
        (s) => s.metrics?.app_id === facAppId && s.metrics?.slug === "invoice_on_time"
      );
      const datesDesc = [...new Set(facMetricSnaps.map((s) => s.snapshot_date))].sort().reverse();
      let run = 0;
      for (const d of datesDesc) {
        const s = facMetricSnaps.find((x) => x.snapshot_date === d)!;
        const pct = s.max_score ? (Number(s.score) / Number(s.max_score)) * 100 : 0;
        if (pct >= 100) run++; else break;
      }
      tryAward("facility_steward", run >= 14);
    }
  }

  // batch writes
  let updated = 0;
  for (const u of lmUpdates) {
    await sb
      .from("league_managers")
      .update({
        current_streak: u.current_streak,
        longest_streak: u.longest_streak,
        tier: u.tier,
        avg_30d: u.avg_30d,
        updated_at: new Date().toISOString(),
      })
      .eq("id", u.id);
    updated++;
  }
  let awarded = 0;
  if (toAward.length) {
    const { error } = await sb.from("lm_achievements").insert(toAward);
    if (!error) awarded = toAward.length;
  }
  return { updated, awarded };
}
