import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Re-aggregate one LM's daily total from their existing daily_snapshots rows.
 * Cheaper than a full recomputeScores() pass. Used by:
 *   - action-resolve (when a reward-on-resolve action awards XP)
 *   - dispute-resolve (when a DM approves a dispute with score_adjustment)
 *
 * NOTE: this does NOT re-rank everyone. The next cron run handles rank.
 */
export async function rerollLM(lmId: string, snapshotDate: string) {
  const admin = createAdminClient();
  const { data: apps } = await admin
    .from("apps")
    .select("id, slug, weight, xp_floor, enabled")
    .eq("enabled", true);
  const { data: snaps } = await admin
    .from("daily_snapshots")
    .select("app_id, score, max_score, metrics:metric_id(slug)")
    .eq("lm_id", lmId)
    .eq("snapshot_date", snapshotDate);

  type AppRow = { id: string; slug: string; weight: number; xp_floor: number };
  const appById = new Map(((apps ?? []) as AppRow[]).map((a) => [a.id, a]));

  type Bucket = {
    score: number;
    max: number;
    metrics: Record<string, { score: number; max: number }>;
  };
  const perApp = new Map<string, Bucket>();
  for (const s of (snaps ?? []) as unknown as Array<{
    app_id: string;
    score: number;
    max_score: number;
    metrics: { slug: string };
  }>) {
    const app = appById.get(s.app_id);
    if (!app) continue;
    const b = perApp.get(app.slug) ?? { score: 0, max: 0, metrics: {} };
    b.score += Number(s.score);
    b.max += Number(s.max_score);
    if (s.metrics?.slug) {
      b.metrics[s.metrics.slug] = {
        score: Number(s.score),
        max: Number(s.max_score),
      };
    }
    perApp.set(app.slug, b);
  }

  let totalXp = 0;
  let maxXp = 0;
  const breakdown: Record<
    string,
    { score: number; max: number; metrics: Record<string, { score: number; max: number }> }
  > = {};
  for (const [slug, b] of perApp) {
    const app = [...appById.values()].find((a) => a.slug === slug);
    if (!app) continue;
    const mult = Number(app.weight);
    const scaled = b.score * mult;
    const flooredScaled = Math.max(scaled, Number(app.xp_floor));
    const scaledMax = b.max * mult;
    totalXp += flooredScaled;
    maxXp += scaledMax;
    breakdown[slug] = { score: flooredScaled, max: scaledMax, metrics: b.metrics };
  }

  const pct = maxXp > 0 ? (totalXp / maxXp) * 100 : 0;

  await admin.from("lm_xp_totals").upsert(
    {
      lm_id: lmId,
      snapshot_date: snapshotDate,
      total_xp: Math.round(totalXp * 10) / 10,
      max_xp: Math.round(maxXp * 10) / 10,
      pct: Math.round(pct * 10) / 10,
      breakdown,
    },
    { onConflict: "lm_id,snapshot_date" }
  );
}
