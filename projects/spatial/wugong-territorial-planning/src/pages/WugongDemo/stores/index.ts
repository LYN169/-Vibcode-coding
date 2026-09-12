import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type ActiveMode = "planning" | "status";
export type MainLayer = "planned_landuse" | "current_landuse" | "none";

interface ConfigStore {
  mapPlayComplete: boolean;
  cloud: boolean; bar: boolean; rotation: boolean; heat: boolean; mode: boolean;
  activeMode: ActiveMode;
  setActiveMode: (m: ActiveMode) => void;
  mainLayer: MainLayer;
  setMainLayer: (l: MainLayer) => void;
  showBoundary: boolean; showRoads: boolean; showSpots: boolean; showSatellite: boolean;
  toggle: (key: string) => void;
  toggleOverlay: (key: string) => void;
  reset: () => void;
}

export const useWugongStore = create<ConfigStore>()(
  subscribeWithSelector((set, _, store) => ({
    mapPlayComplete: false, cloud: true, bar: true, rotation: false, heat: true, mode: true,
    activeMode: "planning",
    setActiveMode: (m) => set({
      activeMode: m,
      mainLayer: m === "planning" ? "planned_landuse" : "none",
      showSatellite: m === "status",
      showSpots: m === "status",
      showRoads: false,
    }),
    mainLayer: "planned_landuse",
    setMainLayer: (l) => set({ mainLayer: l }),
    showBoundary: true, showRoads: false, showSpots: false, showSatellite: false,
    toggle: (key: any) => set((s: any) => ({ [key]: !s[key] })),
  toggleOverlay: (key) => set((s: any) => ({ [key]: !s[key] })),
    reset: () => set(store.getInitialState()),
  }))
);

export const useConfigStore = useWugongStore;
