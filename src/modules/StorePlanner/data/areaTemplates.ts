import type { AreaTemplate } from "@/modules/StorePlanner/types/areaTemplates";
import type { WallNode, WallSegment } from "@/modules/StorePlanner/types/editor";

const generateId = () => Math.random().toString(36).substr(2, 9);

export const areaTemplates: AreaTemplate[] = [
  {
    id: "square",
    name: "Square",
    description: "A simple 4-sided area",
    icon: "lucide:square",
    generate: (startX: number, startY: number, size: number) => {
      const nodeIds = [generateId(), generateId(), generateId(), generateId()];
      const nodes: WallNode[] = [
        { id: nodeIds[0]!, x: startX, y: startY },
        { id: nodeIds[1]!, x: startX + size, y: startY },
        { id: nodeIds[2]!, x: startX + size, y: startY + size },
        { id: nodeIds[3]!, x: startX, y: startY + size },
      ];
      const walls: WallSegment[] = nodeIds.map((id, i) => ({
        id: generateId(),
        startNodeId: id,
        endNodeId: nodeIds[(i + 1) % nodeIds.length]!,
        thickness: 20,
        type: "wall",
      }));
      return { nodes, walls };
    },
  },
  {
    id: "l-shape",
    name: "L Shape",
    description: "An L-shaped area",
    icon: "lucide:layout-template",
    generate: (startX: number, startY: number, size: number) => {
      const nodeIds = Array.from({ length: 6 }, () => generateId());
      const s = size / 2;
      const nodes: WallNode[] = [
        { id: nodeIds[0]!, x: startX, y: startY },
        { id: nodeIds[1]!, x: startX + size, y: startY },
        { id: nodeIds[2]!, x: startX + size, y: startY + s },
        { id: nodeIds[3]!, x: startX + s, y: startY + s },
        { id: nodeIds[4]!, x: startX + s, y: startY + size },
        { id: nodeIds[5]!, x: startX, y: startY + size },
      ];
      const walls: WallSegment[] = nodeIds.map((id, i) => ({
        id: generateId(),
        startNodeId: id,
        endNodeId: nodeIds[(i + 1) % nodeIds.length]!,
        thickness: 20,
        type: "wall",
      }));
      return { nodes, walls };
    },
  },
  {
    id: "t-shape",
    name: "T Shape",
    description: "A T-shaped area",
    icon: "lucide:layout-template",
    generate: (startX: number, startY: number, size: number) => {
      const nodeIds = Array.from({ length: 8 }, () => generateId());
      const s = size / 3;
      const nodes: WallNode[] = [
        { id: nodeIds[0]!, x: startX + s, y: startY },
        { id: nodeIds[1]!, x: startX + 2 * s, y: startY },
        { id: nodeIds[2]!, x: startX + 2 * s, y: startY + s },
        { id: nodeIds[3]!, x: startX + size, y: startY + s },
        { id: nodeIds[4]!, x: startX + size, y: startY + 2 * s },
        { id: nodeIds[5]!, x: startX, y: startY + 2 * s },
        { id: nodeIds[6]!, x: startX, y: startY + s },
        { id: nodeIds[7]!, x: startX + s, y: startY + s },
      ];
      const walls: WallSegment[] = nodeIds.map((id, i) => ({
        id: generateId(),
        startNodeId: id,
        endNodeId: nodeIds[(i + 1) % nodeIds.length]!,
        thickness: 20,
        type: "wall",
      }));
      return { nodes, walls };
    },
  },
  {
    id: "u-shape",
    name: "U Shape",
    description: "A U-shaped area",
    icon: "lucide:layout-template",
    generate: (startX: number, startY: number, size: number) => {
      const nodeIds = Array.from({ length: 8 }, () => generateId());
      const s = size / 3;
      const nodes: WallNode[] = [
        { id: nodeIds[0]!, x: startX, y: startY },
        { id: nodeIds[1]!, x: startX + s, y: startY },
        { id: nodeIds[2]!, x: startX + s, y: startY + 2 * s },
        { id: nodeIds[3]!, x: startX + 2 * s, y: startY + 2 * s },
        { id: nodeIds[4]!, x: startX + 2 * s, y: startY },
        { id: nodeIds[5]!, x: startX + size, y: startY },
        { id: nodeIds[6]!, x: startX + size, y: startY + size },
        { id: nodeIds[7]!, x: startX, y: startY + size },
      ];
      const walls: WallSegment[] = nodeIds.map((id, i) => ({
        id: generateId(),
        startNodeId: id,
        endNodeId: nodeIds[(i + 1) % nodeIds.length]!,
        thickness: 20,
        type: "wall",
      }));
      return { nodes, walls };
    },
  },
];
