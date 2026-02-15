import { defineStore } from "pinia";
import { useEditorLayout } from "./useEditorLayout";
import { useEditorSelection } from "./useEditorSelection";
import { useEditorTools } from "./useEditorTools";
import { generateId } from "@/modules/StorePlanner/utils/editorUtils";
import { areaTemplates } from "@/modules/StorePlanner/data/areaTemplates";
import type { WallNode, WallSegment, StructureType } from "@/modules/StorePlanner/types/editor";

export const useEditorConstruction = defineStore("editor-construction", () => {
  const layoutStore = useEditorLayout();
  const selectionStore = useEditorSelection();
  const toolsStore = useEditorTools();

  const getWallCoordinates = (
    wall: WallSegment,
  ): { x1: number; y1: number; x2: number; y2: number } | null => {
    if (!layoutStore.currentLayout) return null;
    const startNode = layoutStore.currentLayout.nodes.find((n) => n.id === wall.startNodeId);
    const endNode = layoutStore.currentLayout.nodes.find((n) => n.id === wall.endNodeId);
    if (!startNode || !endNode) return null;
    return { x1: startNode.x, y1: startNode.y, x2: endNode.x, y2: endNode.y };
  };

  const getNodePosition = (nodeId: string): { x: number; y: number } | null => {
    if (!layoutStore.currentLayout) return null;
    const node = layoutStore.currentLayout.nodes.find((n) => n.id === nodeId);
    return node ? { x: node.x, y: node.y } : null;
  };

  const addNode = (x: number, y: number): string => {
    const nodeId = generateId();
    const node: WallNode = { id: nodeId, x, y };
    if (layoutStore.currentLayout) {
      layoutStore.currentLayout.nodes.push(node);
      layoutStore.recalculateAreas();
      layoutStore.commit();
    }
    return nodeId;
  };

  const updateNode = (id: string, updates: Partial<WallNode>, shouldCommit = true) => {
    if (!layoutStore.currentLayout) return;
    const node = layoutStore.currentLayout.nodes.find((n) => n.id === id);
    if (node) {
      Object.assign(node, updates);
      // OPTIMIZATION: We skip recalculateAreas here because moving nodes
      // doesn't change which nodes form which areas.
      if (shouldCommit) layoutStore.commit();
    }
  };

  const addWall = (startNodeId: string, endNodeId: string, type: StructureType): string => {
    if (!layoutStore.currentLayout) return "";

    const existingWall = layoutStore.currentLayout.walls.find(
      (w) =>
        (w.startNodeId === startNodeId && w.endNodeId === endNodeId) ||
        (w.startNodeId === endNodeId && w.endNodeId === startNodeId),
    );

    if (existingWall) {
      existingWall.type = type;
      existingWall.thickness = 20;
      existingWall.doorSwing = type === "door" ? "left" : undefined;
      layoutStore.commit();
      selectionStore.selectWall(existingWall.id);
      return existingWall.id;
    }

    const wall: WallSegment = {
      id: generateId(),
      startNodeId,
      endNodeId,
      thickness: 20,
      type,
      doorSwing: type === "door" ? "left" : undefined,
    };
    layoutStore.currentLayout.walls.push(wall);
    layoutStore.recalculateAreas();
    layoutStore.commit();
    selectionStore.selectWall(wall.id);
    return wall.id;
  };

  const updateWall = (id: string, updates: Partial<WallSegment>, shouldCommit = true) => {
    if (!layoutStore.currentLayout) return;
    const wall = layoutStore.currentLayout.walls.find((w) => w.id === id);
    if (wall) {
      Object.assign(wall, updates);
      if (shouldCommit) layoutStore.commit();
    }
  };

  const deleteWall = (id: string) => {
    if (!layoutStore.currentLayout) return;

    const wallToRemove = layoutStore.currentLayout.walls.find((w) => w.id === id);
    if (!wallToRemove) return;

    // Simply remove the wall without collapsing connections
    layoutStore.currentLayout.walls = layoutStore.currentLayout.walls.filter((w) => w.id !== id);

    // Check if the nodes are still used by other walls, if not, remove them
    const usedNodeIds = new Set<string>();
    layoutStore.currentLayout.walls.forEach((w) => {
      usedNodeIds.add(w.startNodeId);
      usedNodeIds.add(w.endNodeId);
    });

    // Only remove nodes that are no longer connected to any walls
    layoutStore.currentLayout.nodes = layoutStore.currentLayout.nodes.filter((n) =>
      usedNodeIds.has(n.id),
    );

    // Update areas to remove references to any deleted nodes
    layoutStore.currentLayout.areas.forEach((a) => {
      a.nodeIds = a.nodeIds.filter((nid) => usedNodeIds.has(nid));
    });

    // Don't recalculate areas as this might remove existing floors
    // Instead, just commit the changes to preserve the existing areas
    layoutStore.commit();

    if (selectionStore.selectedWallId === id) {
      selectionStore.selectWall(null);
    }
  };

  const deleteNode = (id: string) => {
    if (!layoutStore.currentLayout) return;

    // Existing deleteNode logic is good (it merges walls).
    // ... (Keep existing implementation) ...

    // Fallback implementation if needed:
    const connectedWalls = layoutStore.currentLayout.walls.filter(
      (w) => w.startNodeId === id || w.endNodeId === id,
    );

    if (connectedWalls.length === 2 && connectedWalls[0] && connectedWalls[1]) {
      const w1 = connectedWalls[0];
      const w2 = connectedWalls[1];
      const n1 = w1.startNodeId === id ? w1.endNodeId : w1.startNodeId;
      const n2 = w2.startNodeId === id ? w2.endNodeId : w2.startNodeId;

      const newWall: WallSegment = {
        id: generateId(),
        startNodeId: n1,
        endNodeId: n2,
        thickness: w1.thickness,
        type: w1.type,
        height: w1.height,
      };

      layoutStore.currentLayout.walls = layoutStore.currentLayout.walls.filter(
        (w) => w.id !== w1.id && w.id !== w2.id,
      );
      layoutStore.currentLayout.walls.push(newWall);
    } else {
      layoutStore.currentLayout.walls = layoutStore.currentLayout.walls.filter(
        (w) => w.startNodeId !== id && w.endNodeId !== id,
      );
    }

    layoutStore.currentLayout.nodes = layoutStore.currentLayout.nodes.filter((n) => n.id !== id);

    layoutStore.recalculateAreas();
    layoutStore.commit();

    if (selectionStore.selectedNodeId === id) {
      selectionStore.selectNode(null);
    }
  };

  const deleteArea = (id: string) => {
    // ... (Keep existing implementation) ...
    if (!layoutStore.currentLayout) return;
    const area = layoutStore.currentLayout.areas.find((a) => a.id === id);
    if (!area) return;

    // (Logic to remove walls that are unique to this area)
    const areaWalls = layoutStore.currentLayout.walls.filter((w) => {
      return area.nodeIds.includes(w.startNodeId) && area.nodeIds.includes(w.endNodeId);
    });

    const wallsToRemove = areaWalls.filter((w) => {
      const otherAreas = layoutStore.currentLayout!.areas.filter((a) => a.id !== id);
      return !otherAreas.some(
        (a) => a.nodeIds.includes(w.startNodeId) && a.nodeIds.includes(w.endNodeId),
      );
    });

    if (wallsToRemove.length === 0 && areaWalls.length > 0) {
      wallsToRemove.push(areaWalls[0]!);
    }

    const wallIdsToRemove = new Set(wallsToRemove.map((w) => w.id));
    layoutStore.currentLayout.walls = layoutStore.currentLayout.walls.filter(
      (w) => !wallIdsToRemove.has(w.id),
    );

    // Clean up orphaned nodes
    const usedNodeIds = new Set<string>();
    layoutStore.currentLayout.walls.forEach((w) => {
      usedNodeIds.add(w.startNodeId);
      usedNodeIds.add(w.endNodeId);
    });
    layoutStore.currentLayout.nodes = layoutStore.currentLayout.nodes.filter((n) =>
      usedNodeIds.has(n.id),
    );

    layoutStore.currentLayout.areas = layoutStore.currentLayout.areas.filter((a) => a.id !== id);

    layoutStore.recalculateAreas();
    layoutStore.commit();

    if (selectionStore.selectedAreaId === id) {
      selectionStore.selectArea(null);
    }
  };

  // Helper: Check if two line segments intersect and return intersection point
  const getLineIntersection = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number,
  ): { x: number; y: number } | null => {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.0001) return null; // Parallel or coincident

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    // Check if intersection is within both line segments
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1),
      };
    }
    return null;
  };

  const findMergeableAreas = (areaId: string): string[] => {
    if (!layoutStore.currentLayout) return [];
    const area = layoutStore.currentLayout.areas.find((a) => a.id === areaId);
    if (!area) return [];

    // Get walls for this area
    const areaWalls = layoutStore.currentLayout.walls.filter(
      (w) => area.nodeIds.includes(w.startNodeId) && area.nodeIds.includes(w.endNodeId),
    );

    const mergeableIds: string[] = [];
    const POSITION_TOLERANCE = 5;

    for (const otherArea of layoutStore.currentLayout.areas) {
      if (otherArea.id === areaId) continue;

      // Check 1: Shared nodes (same position)
      const area1Nodes = area.nodeIds
        .map((id) => {
          const n = layoutStore.currentLayout!.nodes.find((x) => x.id === id);
          return n ? { id, x: n.x, y: n.y } : null;
        })
        .filter(Boolean);

      const area2Nodes = otherArea.nodeIds
        .map((id) => {
          const n = layoutStore.currentLayout!.nodes.find((x) => x.id === id);
          return n ? { id, x: n.x, y: n.y } : null;
        })
        .filter(Boolean);

      let sharedNodes = 0;
      for (const n1 of area1Nodes) {
        for (const n2 of area2Nodes) {
          const dx = Math.abs(n1!.x - n2!.x);
          const dy = Math.abs(n1!.y - n2!.y);
          if (dx <= POSITION_TOLERANCE && dy <= POSITION_TOLERANCE) {
            sharedNodes++;
            break;
          }
        }
      }

      if (sharedNodes >= 2) {
        console.log("[DEBUG] ✅ Area mergeable (shared nodes):", otherArea.id);
        mergeableIds.push(otherArea.id);
        continue;
      }

      // Check 2: Intersecting walls
      const otherWalls = layoutStore.currentLayout.walls.filter(
        (w) => otherArea.nodeIds.includes(w.startNodeId) && otherArea.nodeIds.includes(w.endNodeId),
      );

      let hasIntersection = false;
      for (const w1 of areaWalls) {
        const coords1 = getWallCoordinates(w1);
        if (!coords1) continue;

        for (const w2 of otherWalls) {
          const coords2 = getWallCoordinates(w2);
          if (!coords2) continue;

          const intersection = getLineIntersection(
            coords1.x1,
            coords1.y1,
            coords1.x2,
            coords1.y2,
            coords2.x1,
            coords2.y1,
            coords2.x2,
            coords2.y2,
          );

          if (intersection) {
            hasIntersection = true;
            break;
          }
        }
        if (hasIntersection) break;
      }

      if (hasIntersection) {
        mergeableIds.push(otherArea.id);
      }
    }

    return mergeableIds;
  };

  const mergeAreas = (areaId1: string, areaId2: string) => {
    if (!layoutStore.currentLayout) return;

    const area1 = layoutStore.currentLayout.areas.find((a) => a.id === areaId1);
    const area2 = layoutStore.currentLayout.areas.find((a) => a.id === areaId2);

    if (!area1 || !area2) {
      console.warn("Cannot merge: one or both areas not found");
      return;
    }

    console.log("[MERGE] Merging areas:", areaId1, "and", areaId2);

    // Step 1: Find all intersection points between walls of the two areas
    const area1Walls = layoutStore.currentLayout.walls.filter(
      (w) => area1.nodeIds.includes(w.startNodeId) && area1.nodeIds.includes(w.endNodeId),
    );
    const area2Walls = layoutStore.currentLayout.walls.filter(
      (w) => area2.nodeIds.includes(w.startNodeId) && area2.nodeIds.includes(w.endNodeId),
    );

    const intersections: Array<{
      wall1Id: string;
      wall2Id: string;
      x: number;
      y: number;
    }> = [];

    for (const w1 of area1Walls) {
      const coords1 = getWallCoordinates(w1);
      if (!coords1) continue;

      for (const w2 of area2Walls) {
        const coords2 = getWallCoordinates(w2);
        if (!coords2) continue;

        const intersection = getLineIntersection(
          coords1.x1,
          coords1.y1,
          coords1.x2,
          coords1.y2,
          coords2.x1,
          coords2.y1,
          coords2.x2,
          coords2.y2,
        );

        if (intersection) {
          intersections.push({
            wall1Id: w1.id,
            wall2Id: w2.id,
            x: Math.round(intersection.x / 10) * 10,
            y: Math.round(intersection.y / 10) * 10,
          });
        }
      }
    }

    console.log("[MERGE] Found intersections:", intersections.length);

    // Step 2: Split walls at intersection points
    for (const inter of intersections) {
      // Check if a node already exists at this position
      const existingNode = findNearbyNode(inter.x, inter.y, 5);

      if (!existingNode) {
        // Split wall1 at intersection point
        const wall1 = layoutStore.currentLayout.walls.find((w) => w.id === inter.wall1Id);
        if (wall1) {
          splitWall(wall1.id, inter.x, inter.y);
        }

        // Split wall2 at intersection point
        const wall2 = layoutStore.currentLayout.walls.find((w) => w.id === inter.wall2Id);
        if (wall2) {
          splitWall(wall2.id, inter.x, inter.y);
        }
      }
    }

    console.log("[MERGE] Split walls at intersections");

    // Step 3: Map duplicate nodes (nodes at same position)
    const POSITION_TOLERANCE = 5;
    const area1Nodes = area1.nodeIds
      .map((id) => {
        const node = layoutStore.currentLayout!.nodes.find((n) => n.id === id);
        return node ? { id, x: node.x, y: node.y } : null;
      })
      .filter((n): n is { id: string; x: number; y: number } => n !== null);

    const area2Nodes = area2.nodeIds
      .map((id) => {
        const node = layoutStore.currentLayout!.nodes.find((n) => n.id === id);
        return node ? { id, x: node.x, y: node.y } : null;
      })
      .filter((n): n is { id: string; x: number; y: number } => n !== null);

    const nodeMapping = new Map<string, string>();

    for (const node2 of area2Nodes) {
      for (const node1 of area1Nodes) {
        const dx = Math.abs(node1.x - node2.x);
        const dy = Math.abs(node1.y - node2.y);

        if (dx <= POSITION_TOLERANCE && dy <= POSITION_TOLERANCE) {
          nodeMapping.set(node2.id, node1.id);
          break;
        }
      }
    }

    console.log("[MERGE] Node mapping:", nodeMapping.size, "nodes");

    // Step 4: Update walls to use consolidated nodes
    layoutStore.currentLayout.walls.forEach((wall) => {
      if (nodeMapping.has(wall.startNodeId)) {
        wall.startNodeId = nodeMapping.get(wall.startNodeId)!;
      }
      if (nodeMapping.has(wall.endNodeId)) {
        wall.endNodeId = nodeMapping.get(wall.endNodeId)!;
      }
    });

    // Step 5: Remove degenerate and duplicate walls
    const wallsToRemove = layoutStore.currentLayout.walls.filter(
      (w) => w.startNodeId === w.endNodeId,
    );

    const seenWalls = new Set<string>();
    const duplicateWalls = layoutStore.currentLayout.walls.filter((w) => {
      const key = [w.startNodeId, w.endNodeId].sort().join("-");
      if (seenWalls.has(key)) {
        return true;
      }
      seenWalls.add(key);
      return false;
    });

    const wallIdsToRemove = new Set([...wallsToRemove, ...duplicateWalls].map((w) => w.id));
    layoutStore.currentLayout.walls = layoutStore.currentLayout.walls.filter(
      (w) => !wallIdsToRemove.has(w.id),
    );

    console.log("[MERGE] Removed degenerate/duplicate walls:", wallIdsToRemove.size);

    // Step 6: Remove orphaned nodes
    const nodesToRemove = Array.from(nodeMapping.keys());
    layoutStore.currentLayout.nodes = layoutStore.currentLayout.nodes.filter(
      (n) => !nodesToRemove.includes(n.id),
    );

    console.log("[MERGE] Removed orphaned nodes:", nodesToRemove.length);

    // Step 7: Remove old areas and recalculate
    layoutStore.currentLayout.areas = layoutStore.currentLayout.areas.filter(
      (a) => a.id !== areaId1 && a.id !== areaId2,
    );

    layoutStore.recalculateAreas();
    layoutStore.commit();

    console.log("[MERGE] Merge complete!");
    selectionStore.selectArea(null);
  };

  // ... (keep remaining helpers) ...
  const findNearbyNode = (x: number, y: number, threshold = 20): WallNode | null => {
    if (!layoutStore.currentLayout) return null;
    for (const node of layoutStore.currentLayout.nodes) {
      const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
      if (dist < threshold) return node;
    }
    return null;
  };

  const addAreaFromTemplate = (templateId: string, x: number, y: number, size = 300) => {
    if (!layoutStore.currentLayout) return;
    if (!layoutStore.currentLayout) return;
    const template = areaTemplates.find((t) => t.id === templateId);
    if (!template) return;
    const { nodes: newNodes, walls: newWalls } = template.generate(x, y, size);
    layoutStore.currentLayout.nodes.push(...newNodes);
    layoutStore.currentLayout.walls.push(...newWalls);
    layoutStore.recalculateAreas();
    layoutStore.commit();
    const newArea = layoutStore.currentLayout.areas.find((a) =>
      newNodes.some((n: { id: string }) => a.nodeIds.includes(n.id)),
    );
    if (newArea) {
      selectionStore.selectArea(newArea.id);
    }
  };

  const splitWall = (wallId: string, x: number, y: number) => {
    if (!layoutStore.currentLayout) return null;
    const wallIdx = layoutStore.currentLayout.walls.findIndex((w) => w.id === wallId);
    if (wallIdx === -1) return null;
    const oldWall = layoutStore.currentLayout.walls[wallIdx]!;

    // Create node without triggering recalculateAreas
    const newNodeId = generateId();
    const node: WallNode = { id: newNodeId, x, y };
    layoutStore.currentLayout.nodes.push(node);

    // Create two new walls without triggering recalculateAreas
    const wall1: WallSegment = {
      id: generateId(),
      startNodeId: oldWall.startNodeId,
      endNodeId: newNodeId,
      thickness: oldWall.thickness,
      type: oldWall.type,
      height: oldWall.height,
    };
    const wall2: WallSegment = {
      id: generateId(),
      startNodeId: newNodeId,
      endNodeId: oldWall.endNodeId,
      thickness: oldWall.thickness,
      type: oldWall.type,
      height: oldWall.height,
    };

    layoutStore.currentLayout.walls.push(wall1, wall2);

    // Remove the original wall
    layoutStore.currentLayout.walls = layoutStore.currentLayout.walls.filter(
      (w) => w.id !== wallId,
    );

    // Call recalculateAreas ONCE at the end
    layoutStore.recalculateAreas();
    layoutStore.commit();

    return newNodeId;
  };

  const findClosestWallPoint = (x: number, y: number, threshold = 20) => {
    // ... (keep existing) ...
    if (!layoutStore.currentLayout) return null;
    let closestDist = threshold;
    let result = null;
    for (const wall of layoutStore.currentLayout.walls) {
      const coords = getWallCoordinates(wall);
      if (!coords) continue;
      const { x1, y1, x2, y2 } = coords;
      const A = x - x1;
      const B = y - y1;
      const C = x2 - x1;
      const D = y2 - y1;
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;
      if (lenSq !== 0) param = dot / lenSq;
      let xx, yy;
      if (param < 0) {
        xx = x1;
        yy = y1;
      } else if (param > 1) {
        xx = x2;
        yy = y2;
      } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
      }
      const dx = x - xx;
      const dy = y - yy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        result = { wallId: wall.id, x: xx, y: yy };
      }
    }
    return result;
  };

  const confirmPendingCorner = () => {
    if (!toolsStore.pendingCornerPos) return;
    const { wallId, x, y } = toolsStore.pendingCornerPos;
    const nodeId = splitWall(wallId, x, y);
    if (nodeId) {
      selectionStore.selectArea(null);
      selectionStore.selectNode(nodeId);
    }
    toolsStore.clearPendingCorner();
  };

  const insertDoorWindow = (
    wallId: string,
    type: "door" | "window",
    width: number,
    doorSwing?: "left" | "right" | "sliding",
    doorType?: "entrance" | "exit" | "standard",
  ) => {
    if (!layoutStore.currentLayout) return;

    const wall = layoutStore.currentLayout.walls.find((w) => w.id === wallId);
    if (!wall) return;

    const coords = getWallCoordinates(wall);
    if (!coords) return;

    const { x1, y1, x2, y2 } = coords;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const wallLength = Math.sqrt(dx * dx + dy * dy);

    if (wallLength < width + 20) return; // Wall too short

    // Direction unit vector
    const ux = dx / wallLength;
    const uy = dy / wallLength;

    // Midpoint of wall
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    // Split points along wall direction
    const halfWidth = width / 2;
    const minMargin = 10;

    // Distance from start to split point C
    let distC = wallLength / 2 - halfWidth;
    let distD = wallLength / 2 + halfWidth;

    // Clamp so door/window fits within wall
    distC = Math.max(minMargin, distC);
    distD = Math.min(wallLength - minMargin, distD);

    // Create two new nodes at split points
    const nodeC: WallNode = {
      id: generateId(),
      x: Math.round((x1 + ux * distC) / 10) * 10,
      y: Math.round((y1 + uy * distC) / 10) * 10,
    };
    const nodeD: WallNode = {
      id: generateId(),
      x: Math.round((x1 + ux * distD) / 10) * 10,
      y: Math.round((y1 + uy * distD) / 10) * 10,
    };

    layoutStore.currentLayout.nodes.push(nodeC, nodeD);

    // Save original wall properties
    const thickness = wall.thickness;
    const height = wall.height;
    const startNodeId = wall.startNodeId;
    const endNodeId = wall.endNodeId;

    // Delete original wall (without cleanup — nodes still in use)
    layoutStore.currentLayout.walls = layoutStore.currentLayout.walls.filter(
      (w) => w.id !== wallId,
    );

    // Create three new walls: A→C (wall), C→D (door/window), D→B (wall)
    const wallAC: WallSegment = {
      id: generateId(),
      startNodeId: startNodeId,
      endNodeId: nodeC.id,
      thickness,
      type: "wall",
      height,
    };

    const wallCD: WallSegment = {
      id: generateId(),
      startNodeId: nodeC.id,
      endNodeId: nodeD.id,
      thickness,
      type,
      width,
      height,
      doorSwing: type === "door" ? doorSwing || "left" : undefined,
      doorType: type === "door" ? doorType || "standard" : undefined,
    };

    const wallDB: WallSegment = {
      id: generateId(),
      startNodeId: nodeD.id,
      endNodeId: endNodeId,
      thickness,
      type: "wall",
      height,
    };

    layoutStore.currentLayout.walls.push(wallAC, wallCD, wallDB);
    layoutStore.recalculateAreas();
    layoutStore.commit();

    // Select the new door/window segment
    selectionStore.selectWall(wallCD.id);
  };

  const toggleAreaDragLock = (areaId: string) => {
    if (!layoutStore.currentLayout) return;
    const area = layoutStore.currentLayout.areas.find((a) => a.id === areaId);
    if (area) {
      layoutStore.updateArea(areaId, {
        lockedDimension: !area.lockedDimension,
      });
    }
  };

  const toggleAreaSizeLock = (areaId: string) => {
    if (!layoutStore.currentLayout) return;
    const area = layoutStore.currentLayout.areas.find((a) => a.id === areaId);
    if (area) {
      layoutStore.updateArea(areaId, { lockedSize: !area.lockedSize });
    }
  };

  const calculateAreaSurface = (areaId: string): number => {
    if (!layoutStore.currentLayout) return 0;
    const area = layoutStore.currentLayout.areas.find((a) => a.id === areaId);
    if (!area) return 0;

    const nodes = area.nodeIds
      .map((id) => layoutStore.currentLayout?.nodes.find((n) => n.id === id))
      .filter((n): n is WallNode => n !== undefined);

    if (nodes.length < 3) return 0;

    // Shoelace formula for polygon area
    let sum = 0;
    for (let i = 0; i < nodes.length; i++) {
      const current = nodes[i]!;
      const next = nodes[(i + 1) % nodes.length]!;
      sum += current.x * next.y - next.x * current.y;
    }

    // Convert to m² (coordinates are in cm)
    return Math.abs(sum / 2 / 10000);
  };

  return {
    findClosestWallPoint,
    getNodePosition,
    getWallCoordinates,
    addNode,
    updateNode,
    deleteNode,
    addWall,
    updateWall,
    deleteWall,
    findNearbyNode,
    addAreaFromTemplate,
    splitWall,
    deleteArea,
    findMergeableAreas,
    mergeAreas,
    confirmPendingCorner,
    insertDoorWindow,
    toggleAreaDragLock,
    toggleAreaSizeLock,
    calculateAreaSurface,
  };
});
