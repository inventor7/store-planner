import type { WallNode, WallSegment } from "@/modules/StorePlanner/types/editor";

interface Point {
  x: number;
  y: number;
}

interface Edge {
  id: string;
  start: string;
  end: string;
}

/**
 * Service for detecting closed areas (rooms/floors) in a store layout.
 * Uses planar graph face detection (traversing clockwise/counter-clockwise edges).
 */
export class AreaDetectionService {
  /**
   * Detects all closed areas from a set of nodes and wall segments.
   * Returns an array of node ID arrays, each representing a closed polygon.
   */
  static detectAreas(nodes: WallNode[], walls: WallSegment[]): string[][] {
    if (nodes.length < 3 || walls.length < 3) return [];

    const adj = new Map<string, string[]>();
    nodes.forEach((n) => adj.set(n.id, []));
    walls.forEach((w) => {
      adj.get(w.startNodeId)?.push(w.endNodeId);
      adj.get(w.endNodeId)?.push(w.startNodeId);
    });

    const nodeMap = new Map<string, WallNode>(nodes.map((n) => [n.id, n]));
    const visitedHalfEdges = new Set<string>(); // "startNodeId->endNodeId"
    const areas: string[][] = [];

    // For each half-edge, find its face
    for (const wall of walls) {
      const directions: [string, string][] = [
        [wall.startNodeId, wall.endNodeId],
        [wall.endNodeId, wall.startNodeId],
      ];

      for (const [startId, endId] of directions) {
        const key = `${startId}->${endId}`;
        if (visitedHalfEdges.has(key)) continue;

        const cycle = this.findFace(startId, endId, adj, nodeMap, visitedHalfEdges);
        if (cycle.length >= 3) {
          // Check if it's an inner face (positive area)
          if (this.calculateArea(cycle, nodeMap) > 0) {
            areas.push(cycle);
          }
        }
      }
    }

    return areas;
  }

  private static findFace(
    startId: string,
    nextId: string,
    adj: Map<string, string[]>,
    nodeMap: Map<string, WallNode>,
    visited: Set<string>,
  ): string[] {
    const cycle: string[] = [startId];
    let current = startId;
    let next = nextId;

    while (!visited.has(`${current}->${next}`)) {
      visited.add(`${current}->${next}`);
      cycle.push(next);

      const prev = current;
      current = next;

      const neighbors = adj.get(current) || [];
      if (neighbors.length < 2) break; // Not a closed loop

      // Find the next edge in the face by picking the most "right" one (counter-clockwise)
      next = this.findMostCounterClockwiseNeighbor(prev, current, neighbors, nodeMap);

      if (next === startId) {
        visited.add(`${current}->${next}`);
        return cycle;
      }
    }

    return [];
  }

  private static findMostCounterClockwiseNeighbor(
    prevId: string,
    currId: string,
    neighbors: string[],
    nodeMap: Map<string, WallNode>,
  ): string {
    const curr = nodeMap.get(currId)!;
    const prev = nodeMap.get(prevId)!;

    // Angle of vector (curr -> prev)
    const baseAngle = Math.atan2(prev.y - curr.y, prev.x - curr.x);

    let bestNeighbor = neighbors[0];
    let minAngleDiff = 2 * Math.PI;

    for (const neighborId of neighbors) {
      if (neighborId === prevId) continue;
      const neighbor = nodeMap.get(neighborId)!;
      const angle = Math.atan2(neighbor.y - curr.y, neighbor.x - curr.x);

      // Calculate clockwise difference: (baseAngle - angle) normalized to [0, 2PI]
      let diff = baseAngle - angle;
      while (diff <= 0) diff += 2 * Math.PI;
      while (diff > 2 * Math.PI) diff -= 2 * Math.PI;

      if (diff < minAngleDiff) {
        minAngleDiff = diff;
        bestNeighbor = neighborId;
      }
    }

    return bestNeighbor!;
  }

  private static calculateArea(cycle: string[], nodeMap: Map<string, WallNode>): number {
    let area = 0;
    for (let i = 0; i < cycle.length; i++) {
      const p1 = nodeMap.get(cycle[i]!)!;
      const p2 = nodeMap.get(cycle[(i + 1) % cycle.length]!)!;
      area += p1.x * p2.y - p2.x * p1.y;
    }
    return area / 2;
  }
}
