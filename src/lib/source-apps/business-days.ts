/**
 * Business-day helpers. v1: Mon-Fri only, ignoring stat holidays.
 * Layer in holidays via brodie-facilities.holidays table when needed.
 */

export function isWeekend(d: Date): boolean {
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6; // Sun or Sat
}

/** Add N business days to a date. N can be negative. */
export function addBusinessDays(start: Date, n: number): Date {
  const d = new Date(start);
  if (n === 0) return d;
  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + step);
    if (!isWeekend(d)) remaining--;
  }
  return d;
}

/** Count business days between two dates (inclusive of `from`, exclusive of `to`). */
export function businessDaysBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let count = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    if (!isWeekend(cursor)) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/**
 * Add N business hours (Mon-Fri, 9-5 ET implied — but we treat business days
 * as 24h blocks). 48 BH = 2 business days. So this just adds N/24 business
 * days. Use for SLAs framed in "business hours."
 */
export function addBusinessHours(start: Date, hours: number): Date {
  const days = hours / 24;
  const whole = Math.floor(days);
  const partial = days - whole;
  let d = addBusinessDays(start, whole);
  if (partial > 0) {
    // For the fractional remainder, just add that many real hours and skip
    // weekends if we land on one (simplification — fine at the 48BH level).
    d = new Date(d);
    d.setUTCHours(d.getUTCHours() + Math.round(partial * 24));
    while (isWeekend(d)) d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}
