import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { ScenicDetail } from "@/types/tourism";

interface TourismStore {
  mapPlayComplete: boolean;
  selectedSpot: ScenicDetail | null;
  filteredDetail: Record<string, string> | null;
  setSelected: (s: ScenicDetail | null) => void;
  setFilteredDetail: (d: Record<string, string> | null) => void;
  reset: () => void;
}

export const useTourismStore = create<TourismStore>()(
  subscribeWithSelector((set, _, store) => ({
    mapPlayComplete: false,
    selectedSpot: null,
    filteredDetail: null,
    setSelected: (s) => set({ selectedSpot: s, filteredDetail: null }),
    setFilteredDetail: (d) => set({ filteredDetail: d }),
    reset: () => set(store.getInitialState()),
  }))
);
