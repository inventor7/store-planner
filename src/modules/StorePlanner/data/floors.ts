export interface FloorType {
  id: string;
  name: string;
  color: string;
  pattern?: "grid" | "dots" | "checkered" | "herringbone" | "none"; // Simplified for now
  patternColor?: string;
  patternOpacity?: number;
  thumbColor?: string;
}

export const floorTypes: FloorType[] = [
  {
    id: "default",
    name: "Default (Concrete)",
    color: "#e0e0e0",
    pattern: "none",
    thumbColor: "#e0e0e0",
  },
  {
    id: "tile-white",
    name: "White Tile",
    color: "#ffffff",
    pattern: "grid",
    patternColor: "#000000",
    patternOpacity: 0.1,
    thumbColor: "#f5f5f5",
  },
  {
    id: "tile-checkered",
    name: "Checkered Tile",
    color: "#ffffff",
    pattern: "checkered",
    patternColor: "#000000",
    patternOpacity: 0.15,
    thumbColor: "#333333",
  },
  {
    id: "wood-light",
    name: "Light Wood",
    color: "#f3e5ab",
    pattern: "herringbone",
    patternColor: "#8b4513",
    patternOpacity: 0.1,
    thumbColor: "#f3e5ab",
  },
  {
    id: "wood-dark",
    name: "Dark Wood",
    color: "#5d4037",
    pattern: "herringbone",
    patternColor: "#3e2723",
    patternOpacity: 0.2,
    thumbColor: "#5d4037",
  },
  {
    id: "marble",
    name: "Marble",
    color: "#f5f5f5",
    pattern: "dots", // Approximation
    patternColor: "#000000",
    patternOpacity: 0.05,
    thumbColor: "#eeeeee",
  },
  {
    id: "carpet-blue",
    name: "Blue Carpet",
    color: "#1e88e5",
    pattern: "dots",
    patternColor: "#ffffff",
    patternOpacity: 0.1,
    thumbColor: "#1e88e5",
  },
];

export const getFloorTypeById = (id?: string) => {
  return floorTypes.find((f) => f.id === id) || floorTypes[0];
};
