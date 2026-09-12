import type { GeoJSONFeatureCollection, GeoJSONFeature } from "./map";

export interface ScenicSpotProperties {
  FID?: number;
  OBJECTID?: number;
  id?: string;
  name?: string;
  address?: string;
  photos_url?: string;
  updatetime?: string;
  gcj02lon?: number;
  gcj02lat?: number;
  wgs84lon?: number;
  wgs84lat?: number;
  type?: string;
  typecode?: string | number;
  [key: string]: unknown;
}

export interface ScenicDetail {
  FID: number;
  name?: string;
  intro?: string;
  recommend_time?: string;
  tags?: string[];
  source?: string;
  [key: string]: unknown;
}

export type ScenicSpotFC = GeoJSONFeatureCollection<ScenicSpotProperties>;
export type ScenicSpotFeature = GeoJSONFeature<ScenicSpotProperties>;
