/**
 * Per-app deep links for the "Lock in →" CTA on each By-app card.
 *
 * If a URL is wrong, fix it here — these are deployed Brodie apps the LM
 * needs to jump into to take action. The label is what shows on hover; the
 * URL is where they land.
 */
export type AppDeepLink = {
  url: string;
  label: string;
};

export const APP_DEEP_LINKS: Record<string, AppDeepLink> = {
  crm: {
    url: "https://brodie-crm.vercel.app",
    label: "Open CRM pipeline →",
  },
  facilities: {
    url: "https://brodie-facilities.vercel.app",
    label: "Open Facilities →",
  },
  ref_payroll: {
    url: "https://brodie-ref-payroll.vercel.app",
    label: "Open Ref Payroll →",
  },
  training: {
    url: "https://brodie-training.vercel.app",
    label: "Open Training →",
  },
  stats_health: {
    url: "https://brodie-stats-health.vercel.app",
    label: "Open Stats Health →",
  },
  content_health: {
    url: "https://brodie-content-health.vercel.app",
    label: "Open Content Health →",
  },
  checklist: {
    url: "https://brodie-checklist.vercel.app",
    label: "Open Checklist →",
  },
  ops_schedule: {
    url: "https://brodie-ops-schedule.vercel.app",
    label: "Open Schedule →",
  },
};
