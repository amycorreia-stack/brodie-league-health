/**
 * Live, non-XP counters surfaced at the top of My Day. These are queried
 * fresh against the source apps every page load — they intentionally bypass
 * daily_snapshots so they always reflect right-now numbers.
 *
 * Currently:
 *   - registered_teams_current_season — count of teams.status in ('registered','full')
 *     for the LM's assigned locations, scoped to the current CRM season.
 */
import { sourceClient, sourceConfigured } from "@/lib/source-apps/clients";

export type LiveCounters = {
  registered_teams_current_season: number | null;
  season_label: string | null;
  source_available: boolean;
};

export async function loadLiveCounters(lmEmail: string): Promise<LiveCounters> {
  const empty: LiveCounters = {
    registered_teams_current_season: null,
    season_label: null,
    source_available: false,
  };
  if (!sourceConfigured("crm")) return empty;
  const sb = sourceClient("crm")!;

  // figure out the LM's assigned locations from the CRM managers table
  const { data: mgr } = await sb
    .from("managers")
    .select("assigned_locations, role, active")
    .eq("email", lmEmail.toLowerCase())
    .maybeSingle();

  if (!mgr) return { ...empty, source_available: true };
  const locIds = ((mgr as { assigned_locations: string[] | null }).assigned_locations ?? []);
  if (!locIds.length) return { ...empty, source_available: true };

  // current season = most recently updated season_captain_goals row
  const { data: latestGoal } = await sb
    .from("season_captain_goals")
    .select("season")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const currentSeason = (latestGoal as { season?: string } | null)?.season ?? null;
  if (!currentSeason) return { ...empty, source_available: true };

  const { count } = await sb
    .from("teams")
    .select("*", { count: "exact", head: true })
    .in("location_id", locIds)
    .eq("season", currentSeason)
    .in("status", ["registered", "full"]);

  return {
    registered_teams_current_season: count ?? 0,
    season_label: currentSeason,
    source_available: true,
  };
}
