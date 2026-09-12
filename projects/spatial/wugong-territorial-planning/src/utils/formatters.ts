/**
 * Wugong area: 1 sq degree ≈ 10,207,800,000 m² ≈ 15,311,700 亩 (at lat ~34.33°)
 * Wugong length: 1 degree ≈ 103,416 meters
 */
const M2_PER_SQ_DEG = 10_207_800_000;
const M_PER_DEG = 103_416;

/** Format area: auto-detect m² vs deg², output 亩 + 公顷 */
export function formatArea(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return "暂无数据";
  if (value <= 0) return "暂无数据";

  let m2: number;
  if (value > 100) {
    m2 = value; // already in m² (Shape_Area in projected coords)
  } else if (value < 1 && value > 0.0000001) {
    m2 = value * M2_PER_SQ_DEG; // WGS84 square degrees
  } else {
    m2 = value;
  }

  const mu = m2 * 0.0015;
  const ha = m2 / 10000;

  if (mu >= 10000) {
    return `${ha.toFixed(2)} 公顷（${mu.toFixed(0)} 亩）`;
  } else if (mu >= 1) {
    return `${mu.toFixed(1)} 亩（${ha.toFixed(3)} 公顷）`;
  } else {
    return `${m2.toFixed(1)} ㎡（${mu.toFixed(3)} 亩）`;
  }
}

/** Format length: auto-detect meters vs degrees */
export function formatLength(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return "暂无数据";
  if (value <= 0) return "暂无数据";

  let m: number;
  if (value > 100) {
    m = value;
  } else if (value < 1 && value > 0.000001) {
    m = value * M_PER_DEG;
  } else {
    m = value;
  }

  if (m >= 1000) {
    return `${(m / 1000).toFixed(2)} km（${m.toFixed(0)} m）`;
  }
  return `${m.toFixed(1)} m`;
}

export function formatNullable(value: unknown): string {
  if (value == null || value === "") return "暂无数据";
  return String(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return "暂无数据";
  return `${value.toFixed(1)}%`;
}
