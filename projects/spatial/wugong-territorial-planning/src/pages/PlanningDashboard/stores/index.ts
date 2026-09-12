import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface ConfigStore {
  mapPlayComplete: boolean;
  showCurrent: boolean;
  showPlanned: boolean;
  showRoads: boolean;
  hoveredFeature: Record<string, unknown> | null;
  toggle: (key: "showCurrent" | "showPlanned" | "showRoads") => void;
  setHovered: (f: Record<string, unknown> | null) => void;
  reset: () => void;
}

export const usePlanningStore = create<ConfigStore>()(
  subscribeWithSelector((set, _, store) => ({
    mapPlayComplete: false,
    showCurrent: true,
    showPlanned: true,
    showRoads: true,
    hoveredFeature: null,
    toggle: (key) => set((s) => ({ [key]: !s[key] })),
    setHovered: (f) => set({ hoveredFeature: f }),
    reset: () => set(store.getInitialState()),
  }))
);
