export interface LocationInfo {
  province: string;
  city: string;
  county: string;
  town: string;
  description: string;
}

export interface PlanningInfo {
  planName: string;
  planningPeriod: string;
  baseYear: number;
  targetYear: number;
  scope: string;
  areaM2: number;
  areaHa: number;
  areaKm2: number;
  areaMu: number;
  coreConcepts: string[];
  overallGoal: string;
  strategicPositioning: string[];
}

export interface PopulationInfo {
  dataLevel: string;
  currentTownPopulation: number | null;
  plannedTownPopulation: number | null;
  trendSummary: string;
  countyProxy?: {
    sexRatio2020?: number;
    urbanizationRate2024Percent?: number;
    agingRatio2020Percent?: number;
    [key: string]: unknown;
  };
}

export interface LanduseCategory {
  code: string;
  name: string;
  areaM2: number;
  sharePercent: number;
  subTypes?: LanduseCategory[];
}

export interface DashboardCard {
  title: string;
  value?: string | number;
  unit?: string;
  description?: string;
  [key: string]: unknown;
}

export interface PlanningStats {
  regionName: string;
  displayTitle: string;
  location: LocationInfo;
  planning: PlanningInfo;
  regionalContext?: Record<string, unknown>;
  naturalBase?: Record<string, unknown>;
  population: PopulationInfo;
  industryEconomy?: Record<string, unknown>;
  currentLanduse?: { dataYear: number; totalAreaM2: number; categories: LanduseCategory[]; keyFindings?: string[] };
  cultureTourism?: Record<string, unknown>;
  agriculture?: Record<string, unknown>;
  humanSettlement?: Record<string, unknown>;
  infrastructure?: Record<string, unknown>;
  transportation?: Record<string, unknown>;
  swot?: Record<string, unknown>;
  dashboardCards: DashboardCard[];
  dataQuality?: Record<string, unknown>;
  [key: string]: unknown;
}
