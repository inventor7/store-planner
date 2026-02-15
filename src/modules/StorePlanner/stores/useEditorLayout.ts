import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { AreaDetectionService } from "@/modules/StorePlanner/services/AreaDetectionService";
import { generateId, createDefaultLayout } from "@/modules/StorePlanner/utils/editorUtils";
import { useEditorSelection } from "./useEditorSelection";
import { useStoreSchemaDetails } from "@/modules/StorePlanner/composables/useStoreSchemaDetails";
import { useUpdateStoreSchema } from "@/modules/StorePlanner/composables/useUpdateStoreSchema";
import type {
  StoreLayout,
  StoreFloor,
  FloorArea,
  WallNode,
  WallSegment,
  PlacedFixture,
} from "@/modules/StorePlanner/types/editor";

// Per-floor history entry type
interface FloorHistoryEntry {
  nodes: WallNode[];
  walls: WallSegment[];
  fixtures: PlacedFixture[];
  areas: FloorArea[];
}

// Per-floor history state
interface FloorHistory {
  past: FloorHistoryEntry[];
  present: FloorHistoryEntry;
  future: FloorHistoryEntry[];
}

export const useEditorLayout = defineStore(
  "editor-layout",
  () => {
    const currentLayout = ref<StoreLayout | null>(null);
    const savedLayouts = ref<StoreLayout[]>([]);
    const customTemplates = ref<any[]>([]);
    const favoriteTemplateIds = ref<string[]>([]);
    const currentSchemaId = ref<string | null>(null);

    // API Composables
    const { data: schemaData, refetch: refetchSchema } = useStoreSchemaDetails(currentSchemaId);
    const { mutateAsync: updateSchema } = useUpdateStoreSchema();
    const selectionStore = useEditorSelection();

    // Watch schema data and sync to local layout
    watch(
      () => schemaData.value,
      (newData) => {
        if (newData && newData.json_description) {
          try {
            const layout =
              typeof newData.json_description === "string"
                ? JSON.parse(newData.json_description)
                : newData.json_description;
            currentLayout.value = layout;
          } catch (error) {
            console.error("Failed to parse schema JSON:", error);
          }
        }
      },
      { immediate: true },
    );

    // Per-floor history system
    const floorHistories = ref<Map<string, FloorHistory>>(new Map());
    const HISTORY_CAPACITY = 50;

    // Get current floor's history state (or initialize if doesn't exist)
    const getCurrentFloorHistory = (): FloorHistory | null => {
      if (!currentLayout.value?.currentFloorId) return null;

      const floorId = currentLayout.value.currentFloorId;
      if (!floorHistories.value.has(floorId)) {
        // Initialize history for this floor
        const initialEntry: FloorHistoryEntry = {
          nodes: [...(currentLayout.value.nodes || [])],
          walls: [...(currentLayout.value.walls || [])],
          fixtures: [...(currentLayout.value.fixtures || [])],
          areas: [...(currentLayout.value.areas || [])],
        };
        floorHistories.value.set(floorId, {
          past: [],
          present: initialEntry,
          future: [],
        });
      }

      return floorHistories.value.get(floorId) || null;
    };

    // Commit current floor state to history
    const commit = () => {
      const history = getCurrentFloorHistory();
      if (!history || !currentLayout.value) return;

      // Create a snapshot of the current floor state
      const snapshot: FloorHistoryEntry = {
        nodes: JSON.parse(JSON.stringify(currentLayout.value.nodes)),
        walls: JSON.parse(JSON.stringify(currentLayout.value.walls)),
        fixtures: JSON.parse(JSON.stringify(currentLayout.value.fixtures)),
        areas: JSON.parse(JSON.stringify(currentLayout.value.areas)),
      };

      // Add current present to past
      history.past.push(history.present);

      // Limit history capacity
      if (history.past.length > HISTORY_CAPACITY) {
        history.past.shift();
      }

      // Set new present and clear future
      history.present = snapshot;
      history.future = [];
    };

    // Undo to previous state
    const undo = () => {
      const history = getCurrentFloorHistory();
      if (!history || !currentLayout.value || history.past.length === 0) return;

      // Move current present to future
      history.future.unshift(history.present);

      // Pop from past and apply
      const previousState = history.past.pop()!;
      history.present = previousState;

      // Apply to current layout
      currentLayout.value.nodes = JSON.parse(JSON.stringify(previousState.nodes));
      currentLayout.value.walls = JSON.parse(JSON.stringify(previousState.walls));
      currentLayout.value.fixtures = JSON.parse(JSON.stringify(previousState.fixtures));
      currentLayout.value.areas = JSON.parse(JSON.stringify(previousState.areas));

      // Also update the current floor object
      const floor = currentLayout.value.floors.find(
        (f) => f.id === currentLayout.value?.currentFloorId,
      );
      if (floor) {
        floor.nodes = [...currentLayout.value.nodes];
        floor.walls = [...currentLayout.value.walls];
        floor.fixtures = [...currentLayout.value.fixtures];
        floor.areas = [...currentLayout.value.areas];
      }

      selectionStore.clearSelection();
    };

    // Redo to next state
    const redo = () => {
      const history = getCurrentFloorHistory();
      if (!history || !currentLayout.value || history.future.length === 0) return;

      // Move current present to past
      history.past.push(history.present);

      // Shift from future and apply
      const nextState = history.future.shift()!;
      history.present = nextState;

      // Apply to current layout
      currentLayout.value.nodes = JSON.parse(JSON.stringify(nextState.nodes));
      currentLayout.value.walls = JSON.parse(JSON.stringify(nextState.walls));
      currentLayout.value.fixtures = JSON.parse(JSON.stringify(nextState.fixtures));
      currentLayout.value.areas = JSON.parse(JSON.stringify(nextState.areas));

      // Also update the current floor object
      const floor = currentLayout.value.floors.find(
        (f) => f.id === currentLayout.value?.currentFloorId,
      );
      if (floor) {
        floor.nodes = [...currentLayout.value.nodes];
        floor.walls = [...currentLayout.value.walls];
        floor.fixtures = [...currentLayout.value.fixtures];
        floor.areas = [...currentLayout.value.areas];
      }

      selectionStore.clearSelection();
    };

    // Check if can undo
    const canUndo = computed(() => {
      const history = getCurrentFloorHistory();
      return history ? history.past.length > 0 : false;
    });

    // Check if can redo
    const canRedo = computed(() => {
      const history = getCurrentFloorHistory();
      return history ? history.future.length > 0 : false;
    });

    const currentFloor = computed(() => {
      if (!currentLayout.value) return null;
      return currentLayout.value.floors.find((f) => f.id === currentLayout.value?.currentFloorId);
    });

    const totalSurfaceArea = computed(() => {
      if (!currentLayout.value) return 0;
      return currentLayout.value.floors.reduce(
        (acc, floor) => acc + (floor.width || 0) * (floor.height || 0),
        0,
      );
    });

    // --- Computed Properties for Graph/Floor Logic ---

    const floorPolygon = computed((): { x: number; y: number }[] | null => {
      if (!currentLayout.value) return null;

      // Build Adjacency Graph
      const adjacency: Record<string, string[]> = {};
      const nodes = currentLayout.value.nodes;
      const walls = currentLayout.value.walls;

      nodes.forEach((n) => {
        adjacency[n.id] = [];
      });

      walls.forEach((w) => {
        if (w.type === "wall" || w.type === "window" || w.type === "door") {
          if (!adjacency[w.startNodeId]) adjacency[w.startNodeId] = [];
          if (!adjacency[w.endNodeId]) adjacency[w.endNodeId] = [];
          adjacency[w.startNodeId]!.push(w.endNodeId);
          adjacency[w.endNodeId]!.push(w.startNodeId);
        }
      });

      // Iteratively prune nodes with degree < 2 (dead ends)
      let changed = true;
      const activeNodes = new Set(Object.keys(adjacency));

      while (changed) {
        changed = false;
        const toRemove: string[] = [];
        for (const nodeId of activeNodes) {
          const neighbors = (adjacency[nodeId] || []).filter((nid) => activeNodes.has(nid));
          if (neighbors.length < 2) {
            toRemove.push(nodeId);
          }
        }
        if (toRemove.length > 0) {
          toRemove.forEach((n) => activeNodes.delete(n));
          changed = true;
        }
      }

      if (activeNodes.size < 3) return null;

      const startNodeId = activeNodes.values().next().value;
      if (!startNodeId) return null;

      const polygon: { x: number; y: number }[] = [];
      const visitedInPath = new Set<string>();
      let curr = startNodeId;

      while (true) {
        visitedInPath.add(curr);
        const node = nodes.find((n) => n.id === curr);
        if (node) polygon.push({ x: node.x, y: node.y });

        const neighbors = adjacency?.[curr]?.filter((n) => activeNodes.has(n));
        const next = neighbors?.find((n) => !visitedInPath.has(n));

        if (!next) {
          if (neighbors?.includes(startNodeId as string) && polygon.length >= 3) {
            break;
          }
          break;
        }
        curr = next;
      }

      return polygon.length >= 3 ? polygon : null;
    });

    const isFloorClosed = computed(() => {
      return !!floorPolygon.value;
    });

    const visibleNodeIds = computed(() => {
      const ids: string[] = [];
      if (selectionStore.selectedNodeId) ids.push(selectionStore.selectedNodeId);
      if (selectionStore.selectedAreaId && currentLayout.value) {
        const area = currentLayout.value.areas.find((a) => a.id === selectionStore.selectedAreaId);
        if (area) ids.push(...area.nodeIds);
      }
      return ids;
    });

    // --- Actions ---

    const createNewLayout = async (
      name: string,
      width: number,
      height: number,
      partnerId?: string,
      firstFloorName: string = "Floor 1",
    ) => {
      const layout = createDefaultLayout(name, width, height, partnerId, firstFloorName);
      currentLayout.value = layout;
      savedLayouts.value.push(layout);

      // Initialize history for the first floor
      if (layout.currentFloorId) {
        floorHistories.value.clear();
        const initialEntry: FloorHistoryEntry = {
          nodes: [...(layout.nodes || [])],
          walls: [...(layout.walls || [])],
          fixtures: [...(layout.fixtures || [])],
          areas: [...(layout.areas || [])],
        };
        floorHistories.value.set(layout.currentFloorId, {
          past: [],
          present: initialEntry,
          future: [],
        });
      }

      selectionStore.clearSelection();

      if (partnerId) {
        //no createion here
      }
    };

    const fetchPartnerLayouts = async (partnerId: string) => {
      // For now, this is a no-op since we're using API-based loading
      // Layouts will be loaded individually by schemaId
      console.log("fetchPartnerLayouts is deprecated with API integration");
    };

    const loadLayout = async (schemaId: string) => {
      currentSchemaId.value = schemaId;
      await refetchSchema();

      // Initialize history for the current floor
      if (currentLayout.value?.currentFloorId) {
        floorHistories.value.clear();
        const initialEntry: FloorHistoryEntry = {
          nodes: [...(currentLayout.value.nodes || [])],
          walls: [...(currentLayout.value.walls || [])],
          fixtures: [...(currentLayout.value.fixtures || [])],
          areas: [...(currentLayout.value.areas || [])],
        };
        floorHistories.value.set(currentLayout.value.currentFloorId, {
          past: [],
          present: initialEntry,
          future: [],
        });
      }

      selectionStore.clearSelection();
    };

    // Load layout from API without auto-save enabled
    const loadLayoutFromApi = async (schemaId: string) => {
      currentSchemaId.value = schemaId;
      await refetchSchema();

      // Initialize history for the current floor
      if (currentLayout.value?.currentFloorId) {
        floorHistories.value.clear();
        const initialEntry: FloorHistoryEntry = {
          nodes: [...(currentLayout.value.nodes || [])],
          walls: [...(currentLayout.value.walls || [])],
          fixtures: [...(currentLayout.value.fixtures || [])],
          areas: [...(currentLayout.value.areas || [])],
        };
        floorHistories.value.set(currentLayout.value.currentFloorId, {
          past: [],
          present: initialEntry,
          future: [],
        });
      }

      selectionStore.clearSelection();
    };

    // Save only to localStorage (not API)
    const saveToLocalStorage = () => {
      if (!currentLayout.value) return;

      const updated = {
        ...currentLayout.value,
        updatedAt: new Date().toISOString(),
      };
      currentLayout.value = updated;
      savedLayouts.value = savedLayouts.value.map((l) => (l.id === updated.id ? updated : l));

      // Persist state will handle localStorage automatically
      console.log("[LocalStorage] Layout saved, changes pending");
    };

    const saveCurrentLayout = async () => {
      if (!currentLayout.value || !currentSchemaId.value) return;

      const updated = {
        ...currentLayout.value,
        updatedAt: new Date().toISOString(),
      };
      currentLayout.value = updated;
      savedLayouts.value = savedLayouts.value.map((l) => (l.id === updated.id ? updated : l));
    };

    const deleteLayout = async (id: string) => {
      savedLayouts.value = savedLayouts.value.filter((l) => l.id !== id);
      if (currentLayout.value?.id === id) {
        currentLayout.value = null;
        currentSchemaId.value = null;
      }
      // Note: Actual deletion on the server would need a DELETE endpoint
    };

    const updateLayoutDimensions = async (
      id: string,
      name: string,
      width: number,
      height: number,
    ) => {
      const layout = savedLayouts.value.find((l) => l.id === id);
      if (layout) {
        layout.name = name;
        layout.width = width;
        layout.height = height;
      }
      if (currentLayout.value?.id === id) {
        currentLayout.value.name = name;
        currentLayout.value.width = width;
        currentLayout.value.height = height;
        commit();
        saveToLocalStorage();
      }
    };

    const switchFloor = (floorId: string) => {
      if (!currentLayout.value) return;

      // 1. Save current live state to the current floor object
      const currentFloorObj = currentLayout.value.floors.find(
        (f) => f.id === currentLayout.value?.currentFloorId,
      );
      if (currentFloorObj) {
        currentFloorObj.nodes = [...currentLayout.value.nodes];
        currentFloorObj.walls = [...currentLayout.value.walls];
        currentFloorObj.fixtures = [...currentLayout.value.fixtures];
        currentFloorObj.areas = [...currentLayout.value.areas];
      }

      // 2. Select the next floor
      const nextFloor = currentLayout.value.floors.find((f) => f.id === floorId);
      if (nextFloor) {
        currentLayout.value.currentFloorId = floorId;

        // 3. Initialize history for this floor if it doesn't exist
        if (!floorHistories.value.has(floorId)) {
          const initialEntry: FloorHistoryEntry = {
            nodes: [...nextFloor.nodes],
            walls: [...nextFloor.walls],
            fixtures: [...nextFloor.fixtures],
            areas: [...nextFloor.areas],
          };
          floorHistories.value.set(floorId, {
            past: [],
            present: initialEntry,
            future: [],
          });
        }

        // 4. Load state from next floor to the live buffers
        currentLayout.value.nodes = [...nextFloor.nodes];
        currentLayout.value.walls = [...nextFloor.walls];
        currentLayout.value.fixtures = [...nextFloor.fixtures];
        currentLayout.value.areas = [...nextFloor.areas];
        selectionStore.clearSelection();
      }
    };

    const addFloor = async (name: string, level: number, width?: number, height?: number) => {
      if (!currentLayout.value) return;
      if (currentLayout.value.floors.some((f) => f.level === level)) {
        console.warn(`Floor level ${level} already exists`);
        return;
      }

      const floorId = generateId();

      const newFloor: StoreFloor = {
        id: floorId,
        name,
        level,
        floorType: "default",
        width: width || currentLayout.value.width,
        height: height || currentLayout.value.height,
        nodes: [],
        walls: [],
        fixtures: [],
        areas: [],
      };
      currentLayout.value.floors.push(newFloor);

      // Switch to the new floor (this will initialize its history)
      switchFloor(floorId);

      // Save to localStorage only (manual API save via "Save All" button)
      saveToLocalStorage();
    };

    const deleteFloor = async (floorId: string) => {
      if (!currentLayout.value) return;
      const floorToDelete = currentLayout.value.floors.find((f) => f.id === floorId);
      if (!floorToDelete) return;

      const fixtureIds = floorToDelete.fixtures.map((f) => f.id);
      if (currentLayout.value.placements) {
        currentLayout.value.placements = currentLayout.value.placements.filter(
          (p) => !fixtureIds.includes(p.fixtureId),
        );
      }

      // Remove history for this floor
      floorHistories.value.delete(floorId);

      if (currentLayout.value.currentFloorId === floorId) {
        const otherFloor = currentLayout.value.floors.find((f) => f.id !== floorId);
        if (otherFloor) {
          switchFloor(otherFloor.id);
        } else {
          currentLayout.value.nodes = [];
          currentLayout.value.walls = [];
          currentLayout.value.fixtures = [];
          currentLayout.value.currentFloorId = "";
        }
      }

      currentLayout.value.floors = currentLayout.value.floors.filter((f) => f.id !== floorId);

      if (currentLayout.value.floors.length === 0) {
        const layoutId = currentLayout.value.id;
        await deleteLayout(layoutId);
      } else {
        // Save to localStorage only
        saveToLocalStorage();
      }
    };

    const updateCurrentFloor = async (updates: Partial<StoreFloor>) => {
      if (!currentLayout.value || !currentFloor.value) return;
      Object.assign(currentFloor.value, updates);
      if (updates.width !== undefined) currentLayout.value.width = updates.width;
      if (updates.height !== undefined) currentLayout.value.height = updates.height;
      commit();
      saveToLocalStorage();
    };

    const recalculateAreas = () => {
      if (!currentLayout.value) return;
      const nodes = currentLayout.value.nodes;
      const walls = currentLayout.value.walls;
      const previousAreas = currentLayout.value.areas || [];
      const newNodeCycles = AreaDetectionService.detectAreas(nodes, walls);

      // Map detected cycles to areas, preserving existing IDs and properties
      const newAreas = newNodeCycles.map((nodeIds, index) => {
        const nodeSet = new Set(nodeIds);
        const match = previousAreas.find(
          (pa) => pa.nodeIds.length === nodeIds.length && pa.nodeIds.every((id) => nodeSet.has(id)),
        );
        return {
          id: match?.id || generateId(),
          name: match?.name || `Area ${index + 1}`,
          nodeIds: nodeIds,
          floorTypeId: match?.floorTypeId || currentLayout.value?.floorType || "default",
          visible: true,
          lockedSize: (match as any)?.lockedSize || (match as any)?.locked || false,
          lockedDimension: (match as any)?.lockedDimension || false,
        };
      });

      // PRESERVE broken areas (areas whose cycles are incomplete but still have nodes)
      // This prevents floor textures from disappearing when walls are deleted
      const newAreaNodeSets = newAreas.map((a) => new Set(a.nodeIds));
      const preservedBrokenAreas = previousAreas
        .filter((prevArea) => {
          // Check if any of this area's nodes still exist
          const hasValidNodes = prevArea.nodeIds.some((nid) => nodes.some((n) => n.id === nid));
          if (!hasValidNodes) return false;

          // Check if this area is already represented in newAreas (exact match)
          const exactMatch = newAreaNodeSets.some((newNodeSet) => {
            return (
              prevArea.nodeIds.length === newNodeSet.size &&
              prevArea.nodeIds.every((id) => newNodeSet.has(id))
            );
          });
          if (exactMatch) return false;

          // NEW: Check if this area is a SUBSET of a new area (meaning it was expanded)
          // This prevents duplicate areas when walls are split
          const isSubsetOfNewArea = newAreaNodeSets.some((newNodeSet) => {
            // If all prevArea nodes are in the new area, and new area has MORE nodes,
            // then prevArea was expanded into the new area
            return (
              prevArea.nodeIds.length < newNodeSet.size &&
              prevArea.nodeIds.every((id) => newNodeSet.has(id))
            );
          });
          if (isSubsetOfNewArea) return false;

          // and is not a subset of any new area
          return true;
        })
        .map((prevArea) => ({
          ...prevArea,
          lockedSize: (prevArea as any).lockedSize || (prevArea as any).locked || false,
          lockedDimension: (prevArea as any).lockedDimension || false,
        })); // Ensure locked properties exist

      currentLayout.value.areas = [...newAreas, ...preservedBrokenAreas];
    };

    const updateArea = (id: string, updates: Partial<FloorArea>) => {
      if (!currentLayout.value) return;
      const area = currentLayout.value.areas.find((a) => a.id === id);
      if (area) {
        Object.assign(area, updates);
        commit();
      }
    };

    const resetCurrentFloor = async () => {
      if (!currentLayout.value || !currentFloor.value) return;
      currentLayout.value.nodes = [];
      currentLayout.value.walls = [];
      currentLayout.value.fixtures = [];
      currentFloor.value.nodes = [];
      currentFloor.value.walls = [];
      currentFloor.value.fixtures = [];
      commit();
      saveToLocalStorage();
    };

    const setFloorType = (floorId: string, type: string) => {
      if (!currentLayout.value) return;
      const floor = currentLayout.value.floors.find((f) => f.id === floorId);
      if (floor) {
        floor.floorType = type;
        commit();
      }
    };

    const updateFloor = async (floorId: string, updates: Partial<StoreFloor>) => {
      if (!currentLayout.value) return;
      const floor = currentLayout.value.floors.find((f) => f.id === floorId);
      if (floor) {
        Object.assign(floor, updates);
        // If this is the current floor, update the current floor reference too
        if (currentLayout.value.currentFloorId === floorId) {
          const currentFloorRef = currentLayout.value.floors.find((f) => f.id === floorId);
          if (currentFloorRef) {
            // Update any layout-level properties if needed
            if (updates.width !== undefined) currentLayout.value.width = updates.width;
            if (updates.height !== undefined) currentLayout.value.height = updates.height;
          }
        }
        commit();
        saveToLocalStorage();
      }
    };

    return {
      currentLayout,
      savedLayouts,
      customTemplates,
      favoriteTemplateIds,
      currentFloor,
      totalSurfaceArea,
      floorPolygon,
      isFloorClosed,
      visibleNodeIds,
      currentSchemaId,

      commit,
      undo,
      redo,
      canUndo,
      canRedo,

      createNewLayout,
      fetchPartnerLayouts,
      loadLayout,
      loadLayoutFromApi,
      saveCurrentLayout,
      saveToLocalStorage,
      deleteLayout,
      updateLayoutDimensions,
      switchFloor,
      addFloor,
      deleteFloor,
      updateCurrentFloor,
      recalculateAreas,
      updateArea,
      resetCurrentFloor,
      setFloorType,
      updateFloor,
    };
  },
  {
    persist: {
      pick: [
        "currentLayout",
        "savedLayouts",
        "customTemplates",
        "favoriteTemplateIds",
        "currentSchemaId",
      ],
    },
  },
);
