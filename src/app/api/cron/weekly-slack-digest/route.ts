import { NextResponse } from "next/server";
import { sendWeeklySlackDigest } from "@/lib/slack/weekly-digest";
import { requireCron } from "@/lib/cron-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = requireCron(req);
  if (denied) return denied;
  const result = await sendWeeklySlackDigest();
  return NextResponse.json({ ok: true, ...result });
}
