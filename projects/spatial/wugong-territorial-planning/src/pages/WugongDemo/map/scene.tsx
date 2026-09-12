import { Suspense, useEffect, useState } from "react";
import Cloud from "./cloud";
import Bottom from "./bottom";
import WugongBase from "./wugongBase";
import { loadGeoJson } from "@/utils/loadGeoJson";
import { loadCsv, parseScenicDetailRows } from "@/utils/loadCsv";
import type { BoundaryFC, LanduseFC, RoadFC } from "@/types/planning";
import type { ScenicSpotFC } from "@/types/tourism";

export type WugongData = {
  boundary: BoundaryFC; currentLU: LanduseFC; plannedLU: LanduseFC;
  roads: RoadFC; spots: ScenicSpotFC; details: Record<string, string>[];
};

export default function Scene({ onDataLoad }: { onDataLoad?: (d: WugongData) => void }) {
  const [data, setData] = useState<WugongData | null>(null);

  useEffect(() => {
    Promise.all([
      loadGeoJson<BoundaryFC>("boundary.geojson"),
      loadGeoJson<LanduseFC>("current_landuse.geojson"),
      loadGeoJson<LanduseFC>("planned_landuse.geojson"),
      loadGeoJson<RoadFC>("planned_roads.geojson"),
      loadGeoJson<ScenicSpotFC>("scenic_spots.geojson"),
      loadCsv("scenic_detail.csv").then(parseScenicDetailRows),
    ]).then(([b, c, p, r, s, rows]) => {
      const d = { boundary: b, currentLU: c, plannedLU: p, roads: r, spots: s, details: rows };
      setData(d);
      onDataLoad?.(d);
    }).catch((e) => console.error("[WugongDemo] Data load failed:", e));
  }, []);

  if (!data) {
    return (
      <Suspense fallback={null}>
        <Cloud />
        <Bottom />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <Cloud />
      <Bottom />
      <WugongBase data={data} />
    </Suspense>
  );
}
