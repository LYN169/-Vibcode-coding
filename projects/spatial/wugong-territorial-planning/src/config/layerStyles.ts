/**
 * Layer style configuration for WugongDashboard.
 *
 * Priority: CSV files in public/styles/ > this default config.
 *
 * To populate from ArcGIS .lyr files, export the symbology table from
 * ArcGIS Pro as CSV and place the files at:
 *   public/styles/current_landuse_style.csv
 *   public/styles/planned_landuse_style.csv
 *   public/styles/planned_roads_style.csv
 *
 * CSV format:
 *   Land use layers:  layer,matchField,value,label,fillColor,lineColor,opacity
 *   Road layer:       layer,matchField,value,label,lineColor,lineWidth,opacity
 */

export interface LanduseStyleEntry {
  value: string;
  label: string;
  fillColor: string;
  lineColor: string;
  opacity: number;
}

export interface LanduseLayerStyle {
  matchFields: string[];
  defaultFill: string;
  defaultLine: string;
  defaultOpacity: number;
  categories: LanduseStyleEntry[];
}

export interface RoadStyleEntry {
  value: string;
  label: string;
  lineColor: string;
  lineWidth: number;
  opacity: number;
}

export interface RoadLayerStyle {
  matchFields: string[];
  defaultLine: string;
  defaultWidth: number;
  defaultOpacity: number;
  categories: RoadStyleEntry[];
}

// ── Temporary colors — TODO: replace with official ArcGIS lyr color table ──

export const currentLanduseStyle: LanduseLayerStyle = {
  matchFields: ["二级名", "一级名"],
  defaultFill: "#d4a76a",
  defaultLine: "#b8935a",
  defaultOpacity: 0.30,
  categories: [
    // TODO: replace with actual ArcGIS symbology table from 用地分类配色.lyr
    // 居住用地
    { value: "城镇住宅用地", label: "城镇住宅", fillColor: "#f5d998", lineColor: "#d4b878", opacity: 0.45 },
    { value: "农村宅基地", label: "农村宅基地", fillColor: "#f0c878", lineColor: "#d0a858", opacity: 0.40 },
    // 公共服务
    { value: "机关团体用地", label: "机关团体", fillColor: "#f7a8b8", lineColor: "#d78898", opacity: 0.40 },
    { value: "教育用地", label: "教育用地", fillColor: "#f7b8c8", lineColor: "#d798a8", opacity: 0.40 },
    // 工业
    { value: "工业用地", label: "工业用地", fillColor: "#c8b8d8", lineColor: "#a898b8", opacity: 0.40 },
    // 道路与交通
    { value: "城镇村道路用地", label: "道路", fillColor: "#d0d0d0", lineColor: "#b0b0b0", opacity: 0.30 },
    { value: "交通场站用地", label: "交通场站", fillColor: "#c0c0c0", lineColor: "#a0a0a0", opacity: 0.40 },
    // 绿地
    { value: "公园绿地", label: "公园绿地", fillColor: "#a8d8a8", lineColor: "#88b888", opacity: 0.45 },
    { value: "防护绿地", label: "防护绿地", fillColor: "#90c890", lineColor: "#70a870", opacity: 0.40 },
    // 商业
    { value: "商业用地", label: "商业用地", fillColor: "#f5a8a8", lineColor: "#d58888", opacity: 0.45 },
    // 耕地
    { value: "水浇地", label: "水浇地", fillColor: "#d8e8a0", lineColor: "#b8c880", opacity: 0.40 },
    { value: "旱地", label: "旱地", fillColor: "#e0e8b8", lineColor: "#c0c898", opacity: 0.38 },
  ],
};

export const plannedLanduseStyle: LanduseLayerStyle = {
  matchFields: ["二类_1", "一类_1", "Landuse_ty"],
  defaultFill: "#7eb8da",
  defaultLine: "#5e98ba",
  defaultOpacity: 0.55,
  categories: [
    // TODO: replace with actual ArcGIS symbology table from 武功镇未来土地利用9_1.lyr
    { value: "城镇住宅用地", label: "城镇住宅", fillColor: "#f5d080", lineColor: "#d4b060", opacity: 0.55 },
    { value: "农村宅基地", label: "农村宅基地", fillColor: "#e8c070", lineColor: "#c8a050", opacity: 0.55 },
    { value: "商业用地", label: "商业用地", fillColor: "#f09090", lineColor: "#d07070", opacity: 0.55 },
    { value: "工业用地", label: "工业用地", fillColor: "#c0a8d8", lineColor: "#a088b8", opacity: 0.55 },
    { value: "公园绿地", label: "公园绿地", fillColor: "#90d090", lineColor: "#70b070", opacity: 0.55 },
    { value: "教育用地", label: "教育用地", fillColor: "#f0b0c0", lineColor: "#d090a0", opacity: 0.55 },
    { value: "医疗卫生用地", label: "医疗用地", fillColor: "#f0c0c0", lineColor: "#d0a0a0", opacity: 0.55 },
    { value: "交通场站用地", label: "交通场站", fillColor: "#b8b8b8", lineColor: "#989898", opacity: 0.55 },
    { value: "文化设施用地", label: "文化设施", fillColor: "#d8c0e0", lineColor: "#b8a0c0", opacity: 0.55 },
  ],
};

export const plannedRoadStyle: RoadLayerStyle = {
  matchFields: ["道路类"],
  defaultLine: "#e88040",
  defaultWidth: 2,
  defaultOpacity: 0.9,
  categories: [
    // TODO: replace with actual ArcGIS symbology table from 规划交通路网.lyr
    { value: "主干路", label: "主干路", lineColor: "#e83030", lineWidth: 2.5, opacity: 0.9 },
    { value: "次干路", label: "次干路", lineColor: "#e88040", lineWidth: 2.0, opacity: 0.85 },
    { value: "支路", label: "支路", lineColor: "#f0b860", lineWidth: 1.5, opacity: 0.80 },
  ],
};

// ── CSV style loader ──

export async function loadLanduseStyleFromCSV(url: string): Promise<LanduseLayerStyle | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split("\n").slice(1); // skip header
    const categories: LanduseStyleEntry[] = [];
    let defaultFill = "#888888";
    let defaultLine = "#666666";
    let defaultOpacity = 0.5;
    for (const line of lines) {
      const cols = line.split(",").map((c) => c.trim());
      if (cols[0] === "layer" || cols.length < 6) continue;
      if (cols[0] === "default") {
        defaultFill = cols[4] || defaultFill;
        defaultLine = cols[5] || defaultLine;
        defaultOpacity = parseFloat(cols[6]) || defaultOpacity;
        continue;
      }
      categories.push({
        value: cols[2],
        label: cols[3] || cols[2],
        fillColor: cols[4],
        lineColor: cols[5],
        opacity: parseFloat(cols[6]) || 0.5,
      });
    }
    return { matchFields: ["二级名", "一类_1", "Landuse_ty"], defaultFill, defaultLine, defaultOpacity, categories };
  } catch {
    return null;
  }
}

export async function loadRoadStyleFromCSV(url: string): Promise<RoadLayerStyle | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split("\n").slice(1);
    const categories: RoadStyleEntry[] = [];
    let defaultLine = "#e88040";
    let defaultWidth = 2;
    let defaultOpacity = 0.9;
    for (const line of lines) {
      const cols = line.split(",").map((c) => c.trim());
      if (cols[0] === "layer" || cols.length < 6) continue;
      if (cols[0] === "default") {
        defaultLine = cols[4] || defaultLine;
        defaultWidth = parseFloat(cols[5]) || defaultWidth;
        defaultOpacity = parseFloat(cols[6]) || defaultOpacity;
        continue;
      }
      categories.push({
        value: cols[2],
        label: cols[3] || cols[2],
        lineColor: cols[4],
        lineWidth: parseFloat(cols[5]) || 2,
        opacity: parseFloat(cols[6]) || 0.9,
      });
    }
    return { matchFields: ["道路类"], defaultLine, defaultWidth, defaultOpacity, categories };
  } catch {
    return null;
  }
}

/**
 * Match a property value against style categories.
 * Returns the matching style entry or undefined (use defaults).
 */
export function matchStyle(
  props: Record<string, unknown>,
  matchFields: string[],
  categories: LanduseStyleEntry[]
): LanduseStyleEntry | undefined {
  for (const field of matchFields) {
    const val = props[field];
    if (val == null || val === "") continue;
    const strVal = String(val).trim();
    for (const cat of categories) {
      if (cat.value === strVal) return cat;
    }
    // Partial match
    for (const cat of categories) {
      if (strVal.includes(cat.value) || cat.value.includes(strVal)) return cat;
    }
  }
  return undefined;
}

export function matchRoadStyle(
  props: Record<string, unknown>,
  categories: RoadStyleEntry[]
): RoadStyleEntry | undefined {
  const val = String(props["道路类"] ?? "");
  if (!val.trim()) return undefined;
  for (const cat of categories) {
    if (cat.value === val.trim()) return cat;
    if (val.includes(cat.value) || cat.value.includes(val)) return cat;
  }
  return undefined;
}
