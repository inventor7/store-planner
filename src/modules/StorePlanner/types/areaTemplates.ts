import type { WallNode, WallSegment } from "./editor";

export interface AreaTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  generate: (
    startX: number,
    startY: number,
    size: number,
  ) => {
    nodes: WallNode[];
    walls: WallSegment[];
  };
}
