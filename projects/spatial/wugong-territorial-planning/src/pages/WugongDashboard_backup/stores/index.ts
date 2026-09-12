import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type ActiveMode = "planning" | "status";
export type ViewMode = "3d" | "2d";

interface WugongStore {
  activeMode: ActiveMode;
  setMode: (mode: ActiveMode) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  mapReady: boolean;
  setMapReady: (v: boolean) => void;
  showCurrent: boolean;
  showPlanned: boolean;
  showRoads: boolean;
  showBoundary: boolean;
  showSatellite: boolean;
  toggleLayer: (key: "showCurrent" | "showPlanned" | "showRoads" | "showBoundary" | "showSatellite") => void;
  reset: () => void;
}

export const useWugongStore = create<WugongStore>()(
  subscribeWithSelector((set, _, store) => ({
    activeMode: "planning",
    setMode: (mode) => set({
      activeMode: mode,
      showSatellite: false,
    }),
    viewMode: "3d",
    setViewMode: (v) => set({ viewMode: v }),
    mapReady: false,
    setMapReady: (v) => set({ mapReady: v }),
    showCurrent: false,
    showPlanned: true,
    showRoads: true,
    showBoundary: true,
    showSatellite: false,
    toggleLayer: (key) => set((s) => ({ [key]: !s[key] })),
    reset: () => set(store.getInitialState()),
  }))
);
