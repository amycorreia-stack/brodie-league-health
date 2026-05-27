import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Mark an action item resolved. If the item is linked to a metric whose
 * scoring_rule is `{type:'reward_on_resolve', xp_per_unit:N}`, immediately
 * award N XP to the LM on that metric for that day and re-rank.
 *
 * Idempotent: resolving an already-resolved item does NOT double-award.
 */
export async function POST(req: Request) {
  await requireUser();
  const { id } = (await req.json()) as { id: string };
  const sb = await createClient();
  const admin = createAdminClient();

  // Use admin to ensure we can read scoring_rule + write the snapshot even
  // if RLS would otherwise scope to the user.
  const { data: item } = await admin
    .from("daily_action_items")
    .select("id, lm_id, metric_id, app_id, snapshot_date, resolved_at, metrics:metric_id(slug, scoring_rule)")
    .eq("id", id)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const row = item as unknown as {
    id: string;
    lm_id: string;
    metric_id: string | null;
    app_id: string;
    snapshot_date: string;
    resolved_at: string | null;
    metrics: { slug: string; scoring_rule: Record<string, unknown> } | null;
  };

  // Already resolved → don't re-award. Use the user-scoped client to set
  // resolved_at idempotently (RLS lets the LM update their own items).
  if (row.resolved_at) {
    return NextResponse.json({ ok: true, already_resolved: true });
  }

  await sb
    .from("daily_action_items")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", id);

  const rule = row.metrics?.scoring_rule ?? {};
  const isReward = rule["type"] === "reward_on_resolve";
  const xpPerUnit = Number(rule["xp_per_unit"] ?? 0);

  if (isReward && xpPerUnit > 0 && row.metric_id) {
    // Look up existing snapshot, add xpPerUnit to its score.
    const { data: snap } = await admin
      .from("daily_snapshots")
      .select("id, score, max_score, raw_value, raw_payload")
      .eq("lm_id", row.lm_id)
      .eq("metric_id", row.metric_id)
      .eq("snapshot_date", row.snapshot_date)
      .maybeSingle();

    const currentScore = Number((snap as { score?: number } | null)?.score ?? 0);
    const nextScore = currentScore + xpPerUnit;

    if (snap) {
      await admin
        .from("daily_snapshots")
        .update({ score: nextScore })
        .eq("id", (snap as { id: string }).id);
    } else {
      await admin.from("daily_snapshots").insert({
        lm_id: row.lm_id,
        app_id: row.app_id,
        metric_id: row.metric_id,
        snapshot_date: row.snapshot_date,
        score: nextScore,
        max_score: xpPerUnit,
      });
    }

    // Re-aggregate this LM's total for the day so leaderboard reflects it
    // without waiting for the next cron. Cheaper than full recomputeScores().
    await rerollLM(row.lm_id, row.snapshot_date);
  }

  return NextResponse.json({ ok: true, awarded_xp: isReward ? xpPerUnit : 0 });
}

async function rerollLM(lmId: string, snapshotDate: string) {
  const admin = createAdminClient();
  const { data: apps } = await admin.from("apps").select("id, slug, weight, xp_floor, enabled").eq("enabled", true);
  const { data: snaps } = await admin
    .from("daily_snapshots")
    .select("app_id, score, max_score, metrics:metric_id(slug)")
    .eq("lm_id", lmId)
    .eq("snapshot_date", snapshotDate);

  type AppRow = { id: string; slug: string; weight: number; xp_floor: number };
  const appById = new Map(((apps ?? []) as AppRow[]).map((a) => [a.id, a]));

  type Bucket = { score: number; max: number; metrics: Record<string, { score: number; max: number }> };
  const perApp = new Map<string, Bucket>();
  for (const s of ((snaps ?? []) as unknown as Array<{ app_id: string; score: number; max_score: number; metrics: { slug: string } }>)) {
    const app = appById.get(s.app_id);
    if (!app) continue;
    const b = perApp.get(app.slug) ?? { score: 0, max: 0, metrics: {} };
    b.score += Number(s.score);
    b.max += Number(s.max_score);
    if (s.metrics?.slug) b.metrics[s.metrics.slug] = { score: Number(s.score), max: Number(s.max_score) };
    perApp.set(app.slug, b);
  }

  let totalXp = 0;
  let maxXp = 0;
  const breakdown: Record<string, { score: number; max: number; metrics: Record<string, { score: number; max: number }> }> = {};
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

  await admin.from("lm_xp_totals").upsert(
    {
      lm_id: lmId,
      snapshot_date: snapshotDate,
      total_xp: Math.round(totalXp * 10) / 10,
      max_xp: Math.round(maxXp * 10) / 10,
      breakdown,
    },
    { onConflict: "lm_id,snapshot_date" }
  );
}
