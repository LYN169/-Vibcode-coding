export interface LayerStyle {
  color: string;
  opacity: number;
  lineWidth?: number;
  lineColor?: string;
  fillOpacity?: number;
  visible: boolean;
  label: string;
}

export const LAYERS: Record<string, LayerStyle> = {
  boundary: {
    color: "#ea580c",
    opacity: 1.0,
    lineWidth: 3,
    lineColor: "#ea580c",
    fillOpacity: 0.05,
    visible: true,
    label: "规划范围",
  },
  currentLanduse: {
    color: "#f59e0b",
    opacity: 0.75,
    lineWidth: 1,
    lineColor: "#d97706",
    fillOpacity: 0.35,
    visible: true,
    label: "现状用地",
  },
  plannedLanduse: {
    color: "#3b82f6",
    opacity: 0.75,
    lineWidth: 1,
    lineColor: "#2563eb",
    fillOpacity: 0.35,
    visible: true,
    label: "规划用地",
  },
  plannedRoads: {
    color: "#ef4444",
    opacity: 0.9,
    lineWidth: 2,
    lineColor: "#dc2626",
    visible: true,
    label: "规划道路",
  },
  scenicSpots: {
    color: "#8b5cf6",
    opacity: 1.0,
    visible: true,
    label: "景点",
  },
};
