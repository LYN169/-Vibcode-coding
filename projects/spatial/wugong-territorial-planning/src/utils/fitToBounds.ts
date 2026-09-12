import { Box2, Vector2 } from "three";
import { geoMercator } from "d3-geo";

export interface FitResult {
  projection: ReturnType<typeof geoMercator>;
  center: [number, number];
  scale: number;
  /** Projected-space bbox (not lon/lat!) */
  projBbox: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number };
  /** World-space offset to center boundary at origin */
  offset: [number, number];
}

export function fitToBounds(
  allFeatures: Array<{ features: Array<{ geometry: { type: string; coordinates: unknown } }> }>,
  targetWidth = 100,
): FitResult {
  // 1. Lon/lat bbox
  const llBbox = new Box2();
  const add = (c: number[]) => llBbox.expandByPoint(new Vector2(c[0], c[1]));
  allFeatures.forEach((fc) => fc.features.forEach((ft) => {
    const g = ft.geometry; if (!g) return;
    const c = g.coordinates;
    if (g.type === "Point") add(c as number[]);
    else if (g.type === "LineString") (c as number[][]).forEach(add);
    else if (g.type === "Polygon") (c as number[][][]).forEach((r) => r.forEach(add));
    else if (g.type === "MultiPolygon") (c as number[][][][]).forEach((p) => p.forEach((r) => r.forEach(add)));
  }));

  if (!isFinite(llBbox.min.x)) {
    return { projection: geoMercator().scale(1000).translate([0,0]), center: [0,0], scale: 1000,
      projBbox: { minX: -50, maxX: 50, minY: -50, maxY: 50, width: 100, height: 100 }, offset: [0,0] };
  }

  const cx = (llBbox.min.x + llBbox.max.x) / 2;
  const cy = (llBbox.min.y + llBbox.max.y) / 2;

  // 2. Projected bbox — use provisional projection
  const projBbox = new Box2();
  const provisionalProj = geoMercator().center([cx, cy] as [number, number]).translate([0, 0]);
  allFeatures.forEach((fc) => fc.features.forEach((ft) => {
    const g = ft.geometry; if (!g) return;
    const pa = (coord: number[]) => {
      const p = provisionalProj(coord as [number, number]);
      if (p) projBbox.expandByPoint(new Vector2(p[0], -p[1]));
    };
    const c = g.coordinates;
    if (g.type === "Point") pa(c as number[]);
    else if (g.type === "LineString") (c as number[][]).forEach(pa);
    else if (g.type === "Polygon") (c as number[][][]).forEach((r) => r.forEach(pa));
    else if (g.type === "MultiPolygon") (c as number[][][][]).forEach((p) => p.forEach((r) => r.forEach(pa)));
  }));

  const pw = projBbox.max.x - projBbox.min.x;
  const ph = projBbox.max.y - projBbox.min.y;
  const size = Math.max(pw, ph, 0.001);
  const scale = (targetWidth / size) * 1000;

  // World offset = center of projected bbox (negate to center at origin)
  const ocx = (projBbox.min.x + projBbox.max.x) / 2;
  const ocy = (projBbox.min.y + projBbox.max.y) / 2;

  // Final projection with correct scale
  const projection = geoMercator().center([cx, cy] as [number, number]).scale(scale).translate([0, 0]);

  // Re-project with final scale for accurate bbox
  const finalBbox = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  allFeatures.forEach((fc) => fc.features.forEach((ft) => {
    const g = ft.geometry; if (!g) return;
    const pa = (coord: number[]) => {
      const p = projection(coord as [number, number]);
      if (p) { finalBbox.minX = Math.min(finalBbox.minX, p[0]); finalBbox.maxX = Math.max(finalBbox.maxX, p[0]);
        finalBbox.minY = Math.min(finalBbox.minY, -p[1]); finalBbox.maxY = Math.max(finalBbox.maxY, -p[1]); }
    };
    const c = g.coordinates;
    if (g.type === "Point") pa(c as number[]);
    else if (g.type === "LineString") (c as number[][]).forEach(pa);
    else if (g.type === "Polygon") (c as number[][][]).forEach((r) => r.forEach(pa));
    else if (g.type === "MultiPolygon") (c as number[][][][]).forEach((p) => p.forEach((r) => r.forEach(pa)));
  }));

  return {
    projection,
    center: [cx, cy],
    scale,
    projBbox: {
      minX: finalBbox.minX, maxX: finalBbox.maxX,
      minY: finalBbox.minY, maxY: finalBbox.maxY,
      width: finalBbox.maxX - finalBbox.minX,
      height: finalBbox.maxY - finalBbox.minY,
    },
    offset: [-ocx, -ocy],
  };
}
