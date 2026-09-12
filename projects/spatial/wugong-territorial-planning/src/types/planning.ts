import type { GeoJSONFeatureCollection, GeoJSONFeature } from "./map";

export interface LanduseProperties {
  FID?: number;
  OBJECTID?: number;
  OBJECTID_1?: number;
  Landuse_ty?: string;
  Shape_Leng?: number;
  Shape_Area?: number;
  Area?: number;
  ORIG_FID?: number;
  [key: string]: unknown;
}

export interface RoadProperties {
  FID?: number;
  OBJECTID?: number;
  length?: number;
  Shape_Leng?: number;
  [key: string]: unknown;
}

export interface BoundaryProperties {
  FID?: number;
  OBJECTID?: number;
  SHAPE_Leng?: number;
  SHAPE_Area?: number;
  Area?: number;
  [key: string]: unknown;
}

export type LanduseFC = GeoJSONFeatureCollection<LanduseProperties>;
export type LanduseFeature = GeoJSONFeature<LanduseProperties>;
export type RoadFC = GeoJSONFeatureCollection<RoadProperties>;
export type RoadFeature = GeoJSONFeature<RoadProperties>;
export type BoundaryFC = GeoJSONFeatureCollection<BoundaryProperties>;
