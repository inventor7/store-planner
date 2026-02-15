<script setup lang="ts">
import { computed, ref, shallowRef, type Ref } from "vue";
import type { FloorArea } from "@/modules/StorePlanner/types/editor";
import { useEditorSelection } from "@/modules/StorePlanner/stores/useEditorSelection";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { storeToRefs } from "pinia";
import { getFloorTypeById } from "@/modules/StorePlanner/data/floors";
import { useEditorConstruction } from "@/modules/StorePlanner/stores/useEditorConstruction";
import type { KonvaEventObject } from "konva/lib/Node.js";
import { useFloorPatterns } from "@/modules/StorePlanner/composables/useFloorPatterns";
import { onMounted } from "vue";

const props = defineProps<{
  area: FloorArea;
}>();

const selectionStore = useEditorSelection();
const layoutStore = useEditorLayout();
const toolsStore = useEditorTools();
const constructionStore = useEditorConstruction();

const { selectedAreaId } = storeToRefs(selectionStore);
const { activeTool, editorMode } = storeToRefs(toolsStore);
const { currentLayout } = storeToRefs(layoutStore);

// --- GEOMETRY ---
const points = computed(() => {
  return props.area.nodeIds
    .map((id) => {
      const pos = constructionStore.getNodePosition(id);
      return pos ? [pos.x, pos.y] : [];
    })
    .flat();
});

const isSelected = computed(() => selectedAreaId.value === props.area.id);
const floorType = computed(() => getFloorTypeById(props.area.floorTypeId));

// --- PATTERN LOGIC ---
const { generatePattern } = useFloorPatterns();
const patternImage = ref<HTMLImageElement | null>(null);

const updatePattern = async () => {
  if (floorType.value) {
    patternImage.value = await generatePattern(floorType.value);
  }
};

watch(() => props.area.floorTypeId, updatePattern);
onMounted(updatePattern);
watch(floorType, updatePattern);

// --- APPEARANCE ---
const fillConfig = computed(() => {
  const baseColor = floorType.value?.color || "#e0e0e0";
  const hasPattern = floorType.value?.pattern && floorType.value.pattern !== "none";

  return {
    fill: hasPattern ? undefined : baseColor,
    fillPatternImage: hasPattern ? patternImage.value : undefined,
    fillPatternRepeat: "repeat",
    opacity: 0.9, // Increased opacity for premium feel
    stroke: isSelected.value ? "#22c55e" : "transparent",
    strokeWidth: 0, // Fill only, border handled by separate shape
  };
});

const groupRef = shallowRef<any>(null); // Konva node - no need for deep reactivity

// --- CACHE FOR DRAGGING ---
// We store the INITIAL positions of everything when drag starts.
let cachedNodes: { id: string; node: any; startX: number; startY: number }[] = [];
let cachedWalls: { id: string; node: any; startX: number; startY: number }[] = [];

// --- DRAG HANDLERS ---

const handleDragStart = (e: KonvaEventObject<DragEvent>) => {
  e.cancelBubble = true;
  selectionStore.selectArea(props.area.id);

  const stage = e.target.getStage();
  const layer = e.target.getLayer();
  if (!stage || !layer) return;

  // 1. Build complete set of nodes to move (including door/window intermediate nodes)
  const areaNodeSet = new Set(props.area.nodeIds);
  const allNodesToMove = new Set(props.area.nodeIds);

  // Find all walls connected to this area and add their intermediate nodes
  if (currentLayout.value) {
    currentLayout.value.walls.forEach((wall) => {
      // If either endpoint is in the area, include both nodes (catches door/window segments)
      if (areaNodeSet.has(wall.startNodeId) || areaNodeSet.has(wall.endNodeId)) {
        allNodesToMove.add(wall.startNodeId);
        allNodesToMove.add(wall.endNodeId);
      }
    });
  }

  // 2. Cache ALL NODES (including door/window intermediate nodes)
  cachedNodes = [];
  allNodesToMove.forEach((nodeId) => {
    // Find the circle shape for this node
    const nodeShape = layer.findOne(`#${nodeId}`);
    if (nodeShape) {
      cachedNodes.push({
        id: nodeId,
        node: nodeShape,
        startX: nodeShape.x(),
        startY: nodeShape.y(),
      });
    }
  });

  // 3. Cache WALLS (Edges)
  // We identify walls that are fully contained within this area (both start/end nodes are now included)
  cachedWalls = [];

  if (currentLayout.value) {
    currentLayout.value.walls.forEach((wall) => {
      if (allNodesToMove.has(wall.startNodeId) && allNodesToMove.has(wall.endNodeId)) {
        // Find the Group for the wall (using the ID we added in KonvaWall)
        const wallGroup = layer.findOne(`#group-${wall.id}`);
        if (wallGroup) {
          cachedWalls.push({
            id: wall.id,
            node: wallGroup,
            startX: wallGroup.x(),
            startY: wallGroup.y(),
          });
        }
      }
    });
  }
};

const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
  e.cancelBubble = true;

  // The Group (the floor itself) moves automatically via Konva's drag engine.
  // We get how far it moved from its origin (0,0).
  const dx = e.target.x();
  const dy = e.target.y();

  // 1. Move Nodes Imperatively (Fast)
  cachedNodes.forEach((item) => {
    item.node.setAttrs({
      x: item.startX + dx,
      y: item.startY + dy,
    });
  });

  // 2. Move Walls Imperatively (Fast)
  cachedWalls.forEach((item) => {
    item.node.setAttrs({
      x: item.startX + dx,
      y: item.startY + dy,
    });
  });

  // Force redraw only the layer to keep it smooth
  const layer = e.target.getLayer();
  if (layer) layer.batchDraw();
};

const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
  e.cancelBubble = true;

  // Calculate final delta
  const dx = e.target.x();
  const dy = e.target.y();

  // 1. Update the Store (Source of Truth)
  // We update the nodes. Walls will auto-update their geometry because they are derived from nodes.
  cachedNodes.forEach((item) => {
    constructionStore.updateNode(
      item.id,
      {
        x: Math.round(item.startX + dx),
        y: Math.round(item.startY + dy),
      },
      false, // Don't commit history yet
    );
  });

  // 2. CRITICAL FIX: Reset the Konva Group's position to (0,0).
  // The Store update will trigger a re-render. Since the nodes now have new absolute coordinates,
  // we must remove the drag offset from the group, otherwise the floor will jump double the distance.
  e.target.x(0);
  e.target.y(0);

  // 3. Reset the visual positions of dragged items to match the store immediately
  // (Prevents a frame flicker before Vue reactivity kicks in)
  cachedNodes.forEach((item) => {
    item.node.x(Math.round(item.startX + dx));
    item.node.y(Math.round(item.startY + dy));
  });

  // We assume walls will snap correctly on next render loop via props

  // 4. Commit History
  layoutStore.commit();

  // 5. Cleanup
  cachedNodes = [];
  cachedWalls = [];
};

const handleClick = (e: KonvaEventObject<MouseEvent>) => {
  e.cancelBubble = true;
  // Allow selection in design mode regardless of lock state
  if (editorMode.value === "design") {
    selectionStore.selectArea(props.area.id);
  }
};
</script>

<template>
  <v-group
    ref="groupRef"
    :config="{
      id: `area-${area.id}`,
      draggable:
        isSelected && activeTool === 'select' && editorMode === 'design' && !area.lockedDimension,
    }"
    @dragstart="handleDragStart"
    @dragmove="handleDragMove"
    @dragend="handleDragEnd"
  >
    <!--
      The Area Shape
      hitStrokeWidth: 0 ensures we only drag when clicking the FILL, not the empty space near lines
    -->
    <v-line
      v-if="points.length >= 6"
      :config="{
        points: points,
        closed: true,
        ...fillConfig,
        draggable: false,
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
        hitStrokeWidth: 0,
      }"
      @click="handleClick"
      @tap="handleClick"
    />

    <!--
      Selection Highlight Layer
      StrokeWidth 24: Wider than the standard 20px wall.
      This ensures the green glow is visible "outside" the walls.
    -->
    <v-line
      v-if="isSelected && editorMode === 'design' && points.length >= 6"
      :config="{
        id: `selection-${area.id}`,
        points: points,
        closed: true,
        stroke: '#22c55e', // Bright Green
        strokeWidth: 28, // Make it wider than walls (usually 20px)
        opacity: 0.8, // Semi-transparent glow
        listening: false, // Pass-through events
        lineJoin: 'round',
        perfectDrawEnabled: false,
      }"
    />
  </v-group>
</template>
