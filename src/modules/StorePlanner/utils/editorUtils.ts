import type { StoreLayout, FixtureContents } from "@/modules/StorePlanner/types/editor";

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const createDefaultContents = (
  shelves: number = 4,
): FixtureContents => ({
  levels: Array.from({ length: shelves }, (_, i) => ({
    id: generateId(),
    slots: [
      {
        id: generateId(),
        productId: null,
        facings: 1,
        depth: 1,
        fences: 0,
        priceLabel: false,
      },
    ],
    height: (i + 1) * 40,
  })),
});

export const createDefaultLayout = (
  name: string,
  width: number,
  height: number,
  partnerId?: string,
  firstFloorName: string = "Floor 1",
): StoreLayout => {
  const floorId = generateId();
  return {
    id: generateId(),
    partnerId,
    name,
    width,
    height,
    nodes: [],
    walls: [],
    fixtures: [],
    floors: [
      {
        id: floorId,
        name: firstFloorName,
        level: 1,
        width,
        height,
        nodes: [],
        walls: [],
        fixtures: [],
        areas: [],
      },
    ],
    areas: [],
    placements: [],
    currentFloorId: floorId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    floorType: "default",
  };
};
