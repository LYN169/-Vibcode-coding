import type { PlanningStats } from "@/types/stats";

let cached: PlanningStats | null = null;

export async function loadStats(): Promise<PlanningStats> {
  if (cached) return cached;

  try {
    const mod = await import("../../public/data/stats.json");
    cached = (mod.default ?? mod) as PlanningStats;
    return cached;
  } catch {
    const res = await fetch("/sc-datav/data/stats.json");
    if (!res.ok) throw new Error(`[loadStats] FAILED (HTTP ${res.status})`);
    cached = await res.json();
    return cached as PlanningStats;
  }
}
