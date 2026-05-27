export function scoreColor(pct: number): string {
  if (pct >= 85) return "text-green-400";
  if (pct >= 65) return "text-yellow-400";
  return "text-red-400";
}
export function scoreBg(pct: number): string {
  if (pct >= 85) return "bg-green-500/10 border-green-500/30";
  if (pct >= 65) return "bg-yellow-500/10 border-yellow-500/30";
  return "bg-red-500/10 border-red-500/30";
}
export function severityDot(severity: string): string {
  if (severity === "critical") return "bg-red-500";
  if (severity === "high") return "bg-orange-400";
  if (severity === "medium") return "bg-yellow-400";
  return "bg-glass-text-tertiary";
}
