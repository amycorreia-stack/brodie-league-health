/**
 * Run a full sync + score + gamification pass from the CLI. Reads .env.local
 * via `set -a; source .env.local` before invoking, e.g.:
 *
 *   set -a && source .env.local && set +a && npx tsx scripts/sync-now.ts
 */
import { runDailySync, recomputeScores } from "@/lib/scoring/engine";

async function main() {
  console.log("→ runDailySync()...");
  const report = await runDailySync({ triggeredBy: "manual" });
  for (const r of report) {
    const tag =
      r.status === "success" ? "✓" :
      r.status === "error"   ? "✗" :
      r.status === "partial" ? "~" : "·";
    console.log(`  ${tag} ${r.app.padEnd(16)} ${r.status.padEnd(14)} rows=${r.rows ?? 0}${r.error ? `  err=${r.error}` : ""}`);
  }

  console.log("\n→ recomputeScores()...");
  const scored = await recomputeScores();
  console.log(`  computed ${scored.computed} LMs for ${scored.date}`);
}
main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
