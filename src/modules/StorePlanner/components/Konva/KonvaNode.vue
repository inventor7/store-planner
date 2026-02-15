<script setup lang="ts">
import { computed, ref, inject, type Ref } from "vue";
import type { WallNode } from "@/modules/StorePlanner/types/editor";
import { useEditorSelection } from "@/modules/StorePlanner/stores/useEditorSelection";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { useEditorConstruction } from "@/modules/StorePlanner/stores/useEditorConstruction";
import { storeToRefs } from "pinia";
import type { KonvaEventObject } from "konva/lib/Node.js";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";

const props = defineProps<{
  node: WallNode;
}>();

const selectionStore = useEditorSelection();
const toolsStore = useEditorTools();
const layoutStore = useEditorLayout();
const constructionStore = useEditorConstruction();

const { selectedNodeId, selectedAreaId } = storeToRefs(selectionStore);
const { currentLayout } = storeToRefs(layoutStore);
const { editorMode, zoom, isDrawingWall, drawingStartNodeId } = storeToRefs(toolsStore);
const isDraggingElement = inject<Ref<boolean>>("isDraggingElement");

const isSelected = computed(() => selectedNodeId.value === props.node.id);

const isAreaSelected = computed(() => {
  // Check if any area containing this node is selected
  if (!currentLayout.value || !selectedAreaId.value) return false;
  const selectedArea = currentLayout.value.areas?.find((a) => a.id === selectedAreaId.value);
  return selectedArea ? selectedArea.nodeIds.includes(props.node.id) : false;
});

const isNodeSizeLocked = computed(() => {
  if (!currentLayout.value?.areas) return false;
  // Check if this node belongs to any size-locked area
  return currentLayout.value.areas.some(
    (area) => area.lockedSize && area.nodeIds.includes(props.node.id),
  );
});

const isGeometryHidden = computed(() => {
  if (!currentLayout.value?.areas) return false;

  // Only hide geometry for specific dimension-locked scenarios (not for drag lock)
  // Currently not used for any lock - nodes always visible
  return false;
});

// Visual Configuration
const circleConfig = computed(() => {
  if (isSelected.value) {
    return {
      radius: 12,
      fill: "#facc15",
      stroke: "#eab308",
      strokeWidth: 2,
      shadowColor: "black",
      shadowBlur: 4,
      shadowOpacity: 0.3,
      perfectDrawEnabled: false,
      opacity: 1,
    };
  }

  // Highlight if part of selected area
  if (isAreaSelected.value) {
    return {
      radius: 8,
      fill: "white",
      stroke: "#22c55e", // Green to match area selection
      strokeWidth: 2,
      shadowColor: "black",
      shadowBlur: 2,
      shadowOpacity: 0.2,
      perfectDrawEnabled: false,
      opacity: 1,
    };
  }

  // In survey mode, show nodes with smooth corners for visibility, using wall color
  if (editorMode.value === "survey") {
    return {
      radius: 8, // Smaller but still visible
      fill: "#e8e0d5", // Same color as wall joints
      stroke: "#b8b0a5", // Same color as wall joints
      strokeWidth: 1,
      opacity: 0.8, // Mostly opaque
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
    };
  }

  // In design mode, keep the original blended state
  // Blended state: Match wall joint color and remove stroke
  return {
    radius: 10,
    fill: "transparent", // Let the Wall Joint show through
    stroke: "transparent",
    strokeWidth: 0,
    opacity: 0, // Fully invisible unless selected
    perfectDrawEnabled: false,
    shadowForStrokeEnabled: false,
  };
});

// Track if this specific node is being dragged
const isDragging = ref(false);

// Throttle drag updates for better performance
let dragUpdateTimeout: number | null = null;

const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
  e.cancelBubble = true;

  if (dragUpdateTimeout) return; // Skip if already scheduled

  dragUpdateTimeout = window.setTimeout(() => {
    const { x, y } = e.target.position();
    const snappedX = Math.round(x / 10) * 10;
    const snappedY = Math.round(y / 10) * 10;

    if (snappedX !== props.node.x || snappedY !== props.node.y) {
      constructionStore.updateNode(props.node.id, { x: snappedX, y: snappedY }, false);
      e.target.position({ x: snappedX, y: snappedY });
    }

    dragUpdateTimeout = null;
  }, 16); // ~60fps
};

const handleDragStart = (e: KonvaEventObject<DragEvent>) => {
  e.cancelBubble = true;
  isDragging.value = true;
  if (isDraggingElement) isDraggingElement.value = true;
};

const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
  e.cancelBubble = true;
  isDragging.value = false;
  if (isDraggingElement) isDraggingElement.value = false;

  // Clear any pending timeout
  if (dragUpdateTimeout) {
    clearTimeout(dragUpdateTimeout);
    dragUpdateTimeout = null;
  }

  // Final sync with commit to history (only once per drag)
  const { x, y } = e.target.position();
  const snappedX = Math.round(x / 10) * 10;
  const snappedY = Math.round(y / 10) * 10;
  constructionStore.updateNode(props.node.id, { x: snappedX, y: snappedY }, true);
};

const handlePointerDown = (e: KonvaEventObject<MouseEvent>) => {
  e.cancelBubble = true;

  // Check if we're in drawing wall mode
  if (isDrawingWall.value && drawingStartNodeId.value) {
    // Don't allow creating a wall to the same node
    if (drawingStartNodeId.value === props.node.id) {
      toolsStore.showSnackbar("Cannot create a wall to the same node", "error");
      return;
    }

    // Create wall between the start node and this node
    constructionStore.addWall(drawingStartNodeId.value, props.node.id, "wall");

    // Cancel drawing mode
    toolsStore.cancelDrawingWall();

    // Select the newly created node
    selectionStore.selectNode(props.node.id);
    return;
  }

  // Normal selection
  selectionStore.selectNode(props.node.id);
};
</script>

<template>
  <v-group v-if="!isGeometryHidden">
    <!-- Wall Joint -->
    <v-circle
      :config="{
        x: node.x,
        y: node.y,
        radius: 10,
        fill: '#e8e0d5',
        stroke: '#b8b0a5',
        strokeWidth: 1,
        listening: false,
        perfectDrawEnabled: false,
      }"
    />

    <!-- Joystick Design (when node is selected, area is selected, or node is being dragged, but NOT when size is locked) -->
    <v-group
      v-if="
        (isSelected || isAreaSelected || isDragging) && editorMode === 'design' && !isNodeSizeLocked
      "
      :config="{
        x: node.x,
        y: node.y,
        scaleX: 1 / zoom,
        scaleY: 1 / zoom,
        listening: true,
        draggable: true,
      }"
      @dragstart="handleDragStart"
      @dragmove="handleDragMove"
      @dragend="handleDragEnd"
    >
      <!-- Invisible larger hit area for easier dragging -->
      <v-circle
        :config="{
          x: 0,
          y: 0,
          radius: 25,
          fill: 'transparent',
          perfectDrawEnabled: false,
        }"
      />

      <!-- Center Circle -->
      <v-circle
        :config="{
          x: 0,
          y: 0,
          radius: 8,
          fill: '#22c55e',
          stroke: '#16a34a',
          strokeWidth: 2,
          perfectDrawEnabled: false,
          listening: false,
        }"
      />

      <!-- Arrow Up -->
      <v-line
        :config="{
          points: [0, -8, 0, -20, -4, -16, 0, -20, 4, -16],
          stroke: '#22c55e',
          strokeWidth: 2,
          lineCap: 'round',
          lineJoin: 'round',
          perfectDrawEnabled: false,
          listening: false,
        }"
      />

      <!-- Arrow Down -->
      <v-line
        :config="{
          points: [0, 8, 0, 20, -4, 16, 0, 20, 4, 16],
          stroke: '#22c55e',
          strokeWidth: 2,
          lineCap: 'round',
          lineJoin: 'round',
          perfectDrawEnabled: false,
          listening: false,
        }"
      />

      <!-- Arrow Left -->
      <v-line
        :config="{
          points: [-8, 0, -20, 0, -16, -4, -20, 0, -16, 4],
          stroke: '#22c55e',
          strokeWidth: 2,
          lineCap: 'round',
          lineJoin: 'round',
          perfectDrawEnabled: false,
          listening: false,
        }"
      />

      <!-- Arrow Right -->
      <v-line
        :config="{
          points: [8, 0, 20, 0, 16, -4, 20, 0, 16, 4],
          stroke: '#22c55e',
          strokeWidth: 2,
          lineCap: 'round',
          lineJoin: 'round',
          perfectDrawEnabled: false,
          listening: false,
        }"
      />
    </v-group>

    <!-- Interactive Node -->
    <v-circle
      :config="{
        id: node.id,
        name: 'node object',
        x: node.x,
        y: node.y,
        draggable: (isSelected || isAreaSelected) && editorMode === 'design' && !isNodeSizeLocked,
        ...circleConfig,
        hitStrokeWidth: 10,
      }"
      @dragstart="handleDragStart"
      @dragmove="handleDragMove"
      @dragend="handleDragEnd"
      @mousedown="handlePointerDown"
      @touchstart="handlePointerDown"
    />
  </v-group>
</template>
