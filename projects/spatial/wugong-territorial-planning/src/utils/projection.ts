import { Vector2 } from "three";
import { geoMercator } from "d3-geo";

export function createProjection(center: [number, number], scale = 1000) {
  return geoMercator().center(center).scale(scale).translate([0, 0]);
}

export function projectCoord(
  projection: ReturnType<typeof geoMercator>,
  coord: [number, number]
): Vector2 {
  const [x, y] = projection(coord)!;
  return new Vector2(x, -y);
}

export function safeGet<T>(obj: T | undefined | null, fallback: string = "暂无数据"): string {
  if (obj === null || obj === undefined) return fallback;
  if (typeof obj === "string" && obj.trim() === "") return fallback;
  return String(obj);
}

export function safeGetNum(
  obj: number | undefined | null,
  unit: string = "",
  decimals: number = 1
): string {
  if (obj === null || obj === undefined) return "暂无数据";
  if (typeof obj !== "number" || !isFinite(obj)) return "暂无数据";
  return `${obj.toFixed(decimals)}${unit}`;
}
