import { createAdminClient } from "@/lib/supabase/admin";

/**
 * DM the LM's manager when a new dispute is filed. No-op if SLACK_BOT_TOKEN
 * is missing — we never want to block the LM's submission on Slack.
 *
 * If we can't figure out who their DM is (no reports_to mapping in CRM yet),
 * fall back to messaging the first super_admin we find.
 */
export async function notifyDmOfDispute(disputeId: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;
  const admin = createAdminClient();

  const { data: d } = await admin
    .from("metric_disputes")
    .select(
      "id, lm_id, snapshot_date, reason, league_managers!inner(full_name, email, reports_to), metrics!inner(name, slug, apps!inner(name))"
    )
    .eq("id", disputeId)
    .maybeSingle();
  if (!d) return;

  const row = d as unknown as {
    id: string;
    lm_id: string;
    snapshot_date: string;
    reason: string;
    league_managers: { full_name: string; email: string; reports_to: string | null };
    metrics: { name: string; slug: string; apps: { name: string } };
  };

  // Resolve the DM's Slack ID. reports_to is the DM's email in CRM.
  let dmSlackId: string | null = null;
  if (row.league_managers.reports_to) {
    const { data: dmProfile } = await admin
      .from("profiles")
      .select("slack_user_id, email")
      .ilike("email", row.league_managers.reports_to)
      .maybeSingle();
    dmSlackId = (dmProfile as { slack_user_id: string | null } | null)?.slack_user_id ?? null;
    if (!dmSlackId && (dmProfile as { email?: string } | null)?.email) {
      dmSlackId = await lookupSlackByEmail(token, (dmProfile as { email: string }).email);
    }
  }

  // Fallback: any super_admin profile with a Slack ID.
  if (!dmSlackId) {
    const { data: admins } = await admin
      .from("profiles")
      .select("slack_user_id, email")
      .eq("role", "super_admin")
      .limit(5);
    for (const a of (admins ?? []) as Array<{ slack_user_id: string | null; email: string }>) {
      if (a.slack_user_id) {
        dmSlackId = a.slack_user_id;
        break;
      }
      const id = await lookupSlackByEmail(token, a.email);
      if (id) {
        dmSlackId = id;
        break;
      }
    }
  }
  if (!dmSlackId) return;

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://brodie-league-health.vercel.app";
  const link = `${base}/district/disputes`;

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*New score dispute filed*\n` +
          `*${row.league_managers.full_name}* flagged *${row.metrics.apps.name} — ${row.metrics.name}* for ${row.snapshot_date}.`,
      },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `> ${row.reason.slice(0, 500)}` },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Review in League Health" },
          url: link,
          style: "primary",
        },
      ],
    },
  ];

  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ channel: dmSlackId, blocks, text: "New score dispute filed" }),
  }).catch(() => {});
}

async function lookupSlackByEmail(token: string, email: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    const j = (await r.json()) as { ok: boolean; user?: { id: string } };
    if (j.ok && j.user?.id) return j.user.id;
  } catch {}
  return null;
}
