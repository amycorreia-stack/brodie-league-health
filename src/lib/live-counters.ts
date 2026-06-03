/**
 * Live, non-XP counters surfaced at the top of My Day. These are queried
 * fresh against the source apps every page load — they intentionally bypass
 * daily_snapshots so they always reflect right-now numbers.
 *
 * Source of truth: brodie-crm.leads where lead_type='current_player'. These
 * are populated by the CRM's Metabase → Player One sync (status='completed'
 * registrations in Player One). Closer to live than the local teams table.
 */
import { sourceClient, sourceConfigured } from "@/lib/source-apps/clients";

export type LiveCounters = {
  registered_athletes: number | null;
  registered_teams: number | null;
  source_available: boolean;
};

export async function loadLiveCounters(lmEmail: string): Promise<LiveCounters> {
  const empty: LiveCounters = {
    registered_athletes: null,
    registered_teams: null,
    source_available: false,
  };
  if (!sourceConfigured("crm")) return empty;
  const sb = sourceClient("crm")!;

  // LM's assigned CRM location ids (text array)
  const { data: mgr } = await sb
    .from("managers")
    .select("assigned_locations, role, active")
    .eq("email", lmEmail.toLowerCase())
    .maybeSingle();

  const locIds = ((mgr as { assigned_locations: string[] | null } | null)?.assigned_locations ?? []);
  if (!locIds.length) return { ...empty, source_available: true };

  // Athletes: exact count of current_player leads at this LM's locations
  const { count: athleteCount } = await sb
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("lead_type", "current_player")
    .in("location_id", locIds);

  // Teams: count rows in team_roster_snapshot at this LM's locations for
  // the most recent season per location. This is the source-of-truth for
  // actually-registered teams (each row = one team with captain + roster).
  // The old impl counted distinct team_name strings from leads, which was
  // free-text and inflated/deflated the number wildly.
  const { data: snapshot } = await sb
    .from("team_roster_snapshot")
    .select("team_id, location_id, season, fetched_at")
    .in("location_id", locIds)
    .order("fetched_at", { ascending: false })
    .limit(10000);

  // For each location, take the most recent season (by fetched_at) and
  // count unique teams in it. Auto-handles per-location season rollover.
  type Snap = { team_id: string; location_id: string; season: string; fetched_at: string };
  const seasonByLoc = new Map<string, string>();
  for (const s of (snapshot ?? []) as Snap[]) {
    if (!seasonByLoc.has(s.location_id)) seasonByLoc.set(s.location_id, s.season);
  }
  const uniqueTeams = new Set<string>();
  for (const s of (snapshot ?? []) as Snap[]) {
    if (seasonByLoc.get(s.location_id) === s.season) uniqueTeams.add(s.team_id);
  }

  return {
    registered_athletes: athleteCount ?? 0,
    registered_teams: uniqueTeams.size,
    source_available: true,
  };
}
