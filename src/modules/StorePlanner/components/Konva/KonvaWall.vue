<script setup lang="ts">
import {
  computed,
  ref,
  shallowRef,
  watch,
  nextTick,
  onMounted,
  onUnmounted,
  inject,
  type Ref,
} from "vue";
import type { WallSegment } from "@/modules/StorePlanner/types/editor";
import { useEditorSelection } from "@/modules/StorePlanner/stores/useEditorSelection";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { storeToRefs } from "pinia";
import type { KonvaEventObject } from "konva/lib/Node.js";
import { useEditorConstruction } from "@/modules/StorePlanner/stores/useEditorConstruction";
// import { useI18n } from "vue-i18n";

// const { t } = useI18n(); // Removed unused
const props = defineProps<{
  wall: WallSegment;
  zoom?: number;
}>();

const selectionStore = useEditorSelection();
const toolsStore = useEditorTools();
const layoutStore = useEditorLayout();
const editorConstructionStore = useEditorConstruction();

const { selectedWallId } = storeToRefs(selectionStore);
const { activeTool, editorMode, isWallResizing, pendingCornerPos } = storeToRefs(toolsStore);
const zoom = computed(() => props.zoom || toolsStore.zoom);
const { currentLayout } = storeToRefs(layoutStore);
const isDraggingElement = inject<Ref<boolean>>("isDraggingElement");

const cornerPreviewRadius = computed(() => {
  // Ensure preview circle fits inside the wall tube
  return Math.min(8, props.wall.thickness / 2 - 1);
});

const cornerPreviewPos = computed(() => {
  if (pendingCornerPos.value?.wallId === props.wall.id && geometry.value) {
    // Inverse rotation to get local wall coordinates
    const angleRad = (geometry.value.angle * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    const translatedX = pendingCornerPos.value.x - geometry.value.x;
    const translatedY = pendingCornerPos.value.y - geometry.value.y;

    // Inverse rotation: R(-θ) * translated
    const localX = translatedX * cosA + translatedY * sinA;
    // Force Y to 0: project onto wall centerline so circle stays inside the tube
    const localY = 0;

    // Clamp X so the circle stays within wall bounds
    const r = cornerPreviewRadius.value;
    const clampedX = Math.max(r, Math.min(geometry.value.length - r, localX));

    return { x: clampedX, y: localY };
  }
  return null;
});

const geometry = computed(() => {
  const coords = editorConstructionStore.getWallCoordinates(props.wall);
  if (!coords) return null;
  const { x1, y1, x2, y2 } = coords;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return { x: x1, y: y1, length, angle };
});

const isSelected = computed(() => selectedWallId.value === props.wall.id);

const isDoorOrWindow = computed(() => props.wall.type === "door" || props.wall.type === "window");

// Colors
const wallColor = "#e8e0d5";
const wallStroke = "#b8b0a5";
const selectedStroke = "#facc15";
const doorOpeningFill = "#fcfcfc";
const doorLeafFill = "#4a4a4a";
const windowFrameFill = "#87ceeb";
const windowFrameStroke = "#4682b4";
const emergencyTint = "rgba(196, 30, 58, 0.15)";

const textureLines = computed(() => {
  if (!geometry.value) return 0;
  return Math.floor(geometry.value.length / 30);
});

// --- DOOR/WINDOW DRAG ALONG WALL ---

// Find the outer constraint nodes for a door/window segment
const adjacentConstraint = computed(() => {
  if (!isDoorOrWindow.value || !currentLayout.value) return null;

  const walls = currentLayout.value.walls;

  // Find the wall connected to startNode (not this wall)
  const startWall = walls.find(
    (w) =>
      w.id !== props.wall.id &&
      (w.startNodeId === props.wall.startNodeId || w.endNodeId === props.wall.startNodeId),
  );
  // Find the wall connected to endNode (not this wall)
  const endWall = walls.find(
    (w) =>
      w.id !== props.wall.id &&
      (w.startNodeId === props.wall.endNodeId || w.endNodeId === props.wall.endNodeId),
  );

  if (!startWall || !endWall) return null;

  // The outer node of the start-side wall (the node that's NOT our startNode)
  const outerStartId =
    startWall.startNodeId === props.wall.startNodeId ? startWall.endNodeId : startWall.startNodeId;
  // The outer node of the end-side wall
  const outerEndId =
    endWall.startNodeId === props.wall.endNodeId ? endWall.endNodeId : endWall.startNodeId;

  const outerStart = editorConstructionStore.getNodePosition(outerStartId);
  const outerEnd = editorConstructionStore.getNodePosition(outerEndId);

  if (!outerStart || !outerEnd) return null;

  return { outerStart, outerEnd, outerStartId, outerEndId };
});

// Drag state for door/window sliding — uses POINTER position to avoid double movement
let dwDragStartAngleRad = 0;
let dwOrigStartNode: { x: number; y: number } | null = null;
let dwOrigEndNode: { x: number; y: number } | null = null;
let dwOuterStart: { x: number; y: number } | null = null;
let dwOuterEnd: { x: number; y: number } | null = null;
let dwDragStartWorld: { x: number; y: number } | null = null;
const isDoorWindowDragging = ref(false);

const getWorldPointer = (e: KonvaEventObject<DragEvent>): { x: number; y: number } | null => {
  const stage = e.target.getStage();
  if (!stage) return null;
  const ptr = stage.getPointerPosition();
  if (!ptr) return null;
  const transform = stage.getAbsoluteTransform().copy().invert();
  return transform.point(ptr);
};

const handleDoorWindowDragStart = (e: KonvaEventObject<DragEvent>) => {
  e.cancelBubble = true;
  if (isDraggingElement) isDraggingElement.value = true;
  isDoorWindowDragging.value = true;

  const coords = editorConstructionStore.getWallCoordinates(props.wall);
  if (coords) {
    dwOrigStartNode = { x: coords.x1, y: coords.y1 };
    dwOrigEndNode = { x: coords.x2, y: coords.y2 };
  }
  if (geometry.value) {
    dwDragStartAngleRad = (geometry.value.angle * Math.PI) / 180;
  }
  if (adjacentConstraint.value) {
    dwOuterStart = { ...adjacentConstraint.value.outerStart };
    dwOuterEnd = { ...adjacentConstraint.value.outerEnd };
  }
  dwDragStartWorld = getWorldPointer(e);

  clearCacheNode();
};

const handleDoorWindowDragMove = (e: KonvaEventObject<DragEvent>) => {
  e.cancelBubble = true;
  if (!dwOrigStartNode || !dwOrigEndNode || !dwDragStartWorld) return;

  // Reset rect to prevent Konva from visually moving it (avoids double movement)
  e.target.x(0);
  e.target.y(-props.wall.thickness / 2);

  // Compute delta from pointer in world coords (stable, ignores group repositioning)
  const currentWorld = getWorldPointer(e);
  if (!currentWorld) return;

  const gdx = currentWorld.x - dwDragStartWorld.x;
  const gdy = currentWorld.y - dwDragStartWorld.y;

  // Project global delta onto wall axis
  const cosA = Math.cos(dwDragStartAngleRad);
  const sinA = Math.sin(dwDragStartAngleRad);
  const axialDelta = gdx * cosA + gdy * sinA;
  const snappedDelta = Math.round(axialDelta / 10) * 10;

  let newStartX = dwOrigStartNode.x + snappedDelta * cosA;
  let newStartY = dwOrigStartNode.y + snappedDelta * sinA;
  let newEndX = dwOrigEndNode.x + snappedDelta * cosA;
  let newEndY = dwOrigEndNode.y + snappedDelta * sinA;

  // Clamp within outer nodes
  if (dwOuterStart && dwOuterEnd) {
    const margin = 10;

    const distStartFromOuter =
      (newStartX - dwOuterStart.x) * cosA + (newStartY - dwOuterStart.y) * sinA;

    if (distStartFromOuter < margin) {
      const correction = margin - distStartFromOuter;
      newStartX += correction * cosA;
      newStartY += correction * sinA;
      newEndX += correction * cosA;
      newEndY += correction * sinA;
    }

    const distEndToOuter = (dwOuterEnd.x - newEndX) * cosA + (dwOuterEnd.y - newEndY) * sinA;

    if (distEndToOuter < margin) {
      const correction = margin - distEndToOuter;
      newStartX -= correction * cosA;
      newStartY -= correction * sinA;
      newEndX -= correction * cosA;
      newEndY -= correction * sinA;
    }
  }

  editorConstructionStore.updateNode(
    props.wall.startNodeId,
    {
      x: Math.round(newStartX / 10) * 10,
      y: Math.round(newStartY / 10) * 10,
    },
    false,
  );
  editorConstructionStore.updateNode(
    props.wall.endNodeId,
    {
      x: Math.round(newEndX / 10) * 10,
      y: Math.round(newEndY / 10) * 10,
    },
    false,
  );
};

const handleDoorWindowDragEnd = (e: KonvaEventObject<DragEvent>) => {
  e.cancelBubble = true;
  if (isDraggingElement) isDraggingElement.value = false;
  isDoorWindowDragging.value = false;

  e.target.x(0);
  e.target.y(-props.wall.thickness / 2);

  layoutStore.commit();

  dwOrigStartNode = null;
  dwOrigEndNode = null;
  dwOuterStart = null;
  dwOuterEnd = null;
  dwDragStartWorld = null;
  dwDragStartAngleRad = 0;
};

const handleClick = (e: KonvaEventObject<MouseEvent>) => {
  e.cancelBubble = true;

  // Only allow selection in design mode
  if (editorMode.value === "design") {
    // 1. Select the wall
    selectionStore.selectWall(props.wall.id);

    // 2. Corner preview only for regular walls (not door/window)
    if (activeTool.value === "select" && !isDoorOrWindow.value) {
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const transform = stage.getAbsoluteTransform().copy().invert();
      const pos = transform.point(pointer);

      if (!geometry.value) return;

      const angleRad = (geometry.value.angle * Math.PI) / 180;
      const cosA = Math.cos(angleRad);
      const sinA = Math.sin(angleRad);

      const translatedX = pos.x - geometry.value.x;
      const translatedY = pos.y - geometry.value.y;

      const localX = translatedX * cosA + translatedY * sinA;

      const minMargin = 25;
      const t = Math.max(
        minMargin / geometry.value.length,
        Math.min(1 - minMargin / geometry.value.length, localX / geometry.value.length),
      );
      const projLocalX = t * geometry.value.length;

      const globalX = geometry.value.x + projLocalX * cosA;
      const globalY = geometry.value.y + projLocalX * sinA;

      const snappedPos = {
        x: Math.round(globalX / 10) * 10,
        y: Math.round(globalY / 10) * 10,
      };

      toolsStore.setPendingCorner(props.wall.id, snappedPos.x, snappedPos.y);
    }
  }
};

const measurementSide = computed(() => {
  if (!geometry.value || !currentLayout.value) return 1;

  const area = currentLayout.value.areas?.find(
    (a) => a.nodeIds.includes(props.wall.startNodeId) && a.nodeIds.includes(props.wall.endNodeId),
  );

  if (!area) return 1;

  let cx = 0,
    cy = 0;
  area.nodeIds.forEach((id) => {
    const p = editorConstructionStore.getNodePosition(id);
    if (p) {
      cx += p.x;
      cy += p.y;
    }
  });
  cx /= area.nodeIds.length;
  cy /= area.nodeIds.length;

  const coords = editorConstructionStore.getWallCoordinates(props.wall);
  if (!coords) return 1;
  const mx = (coords.x1 + coords.x2) / 2;
  const my = (coords.y1 + coords.y2) / 2;

  const vcx = cx - mx;
  const vcy = cy - my;

  const wx = coords.x2 - coords.x1;
  const wy = coords.y2 - coords.y1;

  const nx = -wy;
  const ny = wx;

  const dot = nx * vcx + ny * vcy;

  return dot > 0 ? -1 : 1;
});

const measurementLineConfig = computed(() => ({
  name: "measurement-line", // Add name for imperative selection
  points: [
    5,
    measurementSide.value * (props.wall.thickness / 2 + 15),
    (geometry.value?.length || 0) - 5,
    measurementSide.value * (props.wall.thickness / 2 + 15),
  ],
  stroke: "#64748b",
  strokeWidth: 0.5,
  dash: [2, 2],
  listening: false,
  perfectDrawEnabled: false,
}));

const measurementTextConfig = computed(() => ({
  name: "measurement-text", // Add name for imperative selection
  x: (geometry.value?.length || 0) / 2,
  y: measurementSide.value * (props.wall.thickness / 2 + 25),
  text: `${((geometry.value?.length || 0) / 100).toFixed(2)} m`,
  fontSize: 12,
  fill: "#64748b",
  fontStyle: "500",
  width: 100,
  align: "center",
  offsetX: 50,
  scaleX: 1 / zoom.value,
  scaleY: 1 / zoom.value,
  rotation: -(geometry.value?.angle || 0),
  listening: false,
  perfectDrawEnabled: false,
}));

// --- RESIZE HANDLE ---

const isPartOfSelectedArea = computed(() => {
  if (!selectionStore.selectedAreaId || !currentLayout.value) return false;
  const area = currentLayout.value.areas?.find((a) => a.id === selectionStore.selectedAreaId);
  if (!area) return false;
  return (
    area.nodeIds.includes(props.wall.startNodeId) && area.nodeIds.includes(props.wall.endNodeId)
  );
});

const shouldShowResizeHandle = computed(() => {
  if (editorMode.value !== "design") return false;
  // CHANGED: Don't hide during resize - keep handle visible while dragging
  // if (isWallResizing.value) return false;
  if (props.wall.type !== "wall") return false;

  if (isPartOfSelectedArea.value && currentLayout.value) {
    const area = currentLayout.value.areas?.find((a) => a.id === selectionStore.selectedAreaId);
    if (area?.lockedSize) return false;
  }

  return isSelected.value || isPartOfSelectedArea.value;
});

const resizeHandleConfig = computed(() => {
  if (!geometry.value) return null;
  return {
    x: geometry.value.length / 2,
    y: 0,
  };
});

// === MANUAL RESIZE WITH PURE POINTER TRACKING (NO KONVA DRAG) ===
let resizeStartWorld: { x: number; y: number } | null = null;
let resizeOriginalNodes: {
  start: { x: number; y: number };
  end: { x: number; y: number };
} | null = null;
let resizeAngleRad = 0;
let adjacentWallsAngles: {
  startWallAngle: number | null;
  endWallAngle: number | null;
} | null = null;

// Find angles of adjacent walls to determine converging/diverging direction
const getAdjacentWallsAngles = () => {
  if (!currentLayout.value) return { startWallAngle: null, endWallAngle: null };

  const walls = currentLayout.value.walls;

  // Find wall connected to startNode (not this wall)
  const startWall = walls.find(
    (w) =>
      w.id !== props.wall.id &&
      (w.startNodeId === props.wall.startNodeId || w.endNodeId === props.wall.startNodeId),
  );

  // Find wall connected to endNode (not this wall)
  const endWall = walls.find(
    (w) =>
      w.id !== props.wall.id &&
      (w.startNodeId === props.wall.endNodeId || w.endNodeId === props.wall.endNodeId),
  );

  let startWallAngle: number | null = null;
  let endWallAngle: number | null = null;

  if (startWall) {
    const startCoords = editorConstructionStore.getWallCoordinates(startWall);
    if (startCoords) {
      const dx = startCoords.x2 - startCoords.x1;
      const dy = startCoords.y2 - startCoords.y1;
      startWallAngle = Math.atan2(dy, dx);
    }
  }

  if (endWall) {
    const endCoords = editorConstructionStore.getWallCoordinates(endWall);
    if (endCoords) {
      const dx = endCoords.x2 - endCoords.x1;
      const dy = endCoords.y2 - endCoords.y1;
      endWallAngle = Math.atan2(dy, dx);
    }
  }

  return { startWallAngle, endWallAngle };
};

const handleResizePointerDown = (e: KonvaEventObject<PointerEvent>) => {
  e.cancelBubble = true;
  e.evt.preventDefault();

  if (isDraggingElement) isDraggingElement.value = true;
  toolsStore.setWallResizing(true);

  const stage = e.target.getStage();
  if (!stage) return;

  const pointer = stage.getPointerPosition();
  if (!pointer) return;

  // Convert to world coordinates
  const transform = stage.getAbsoluteTransform().copy().invert();
  resizeStartWorld = transform.point(pointer);

  // Cache original node positions
  const coords = editorConstructionStore.getWallCoordinates(props.wall);
  if (coords) {
    resizeOriginalNodes = {
      start: { x: coords.x1, y: coords.y1 },
      end: { x: coords.x2, y: coords.y2 },
    };
  }

  const geom = geometry.value;
  if (geom) {
    resizeAngleRad = (geom.angle * Math.PI) / 180;
  }

  // Get adjacent wall angles to determine convergence/divergence
  adjacentWallsAngles = getAdjacentWallsAngles();

  clearCacheNode();

  // Attach global listeners for move and up
  window.addEventListener("pointermove", handleResizePointerMove);
  window.addEventListener("pointerup", handleResizePointerUp);
};

// PERFORMANCE: Throttle resize using requestAnimationFrame
let resizeRAF: number | null = null;
let lastResizeEvent: PointerEvent | null = null;

const handleResizePointerMove = (evt: PointerEvent) => {
  // Store the event for RAF processing
  lastResizeEvent = evt;

  // If RAF already scheduled, don't schedule another
  if (resizeRAF !== null) return;

  // Schedule update for next frame (~60fps instead of 100+fps)
  resizeRAF = requestAnimationFrame(() => {
    resizeRAF = null;
    if (!lastResizeEvent) return;

    performResize(lastResizeEvent);
    lastResizeEvent = null;
  });
};

const performResize = (evt: PointerEvent) => {
  if (!resizeStartWorld || !resizeOriginalNodes || !adjacentWallsAngles) return;

  const stage = groupRef.value?.getNode()?.getStage();
  if (!stage) return;

  // Get current pointer position in world coords
  const containerRect = stage.container().getBoundingClientRect();
  const pointerScreen = {
    x: evt.clientX - containerRect.left,
    y: evt.clientY - containerRect.top,
  };

  const transform = stage.getAbsoluteTransform().copy().invert();
  const currentWorld = transform.point(pointerScreen);

  // Calculate world delta
  const gdx = currentWorld.x - resizeStartWorld.x;
  const gdy = currentWorld.y - resizeStartWorld.y;

  // Project onto wall's perpendicular (normal) direction
  const nx = -Math.sin(resizeAngleRad);
  const ny = Math.cos(resizeAngleRad);
  const perpendicularDelta = gdx * nx + gdy * ny;
  const snappedDelta = Math.round(perpendicularDelta / 10) * 10;

  // SIMPLIFIED: Just use the perpendicular delta directly
  // The complex convergence logic was causing unpredictable behavior
  const finalDelta = snappedDelta;
  const offsetX = finalDelta * nx;
  const offsetY = finalDelta * ny;

  // Calculate new positions (snapped to grid)
  const newStartX = Math.round((resizeOriginalNodes.start.x + offsetX) / 10) * 10;
  const newStartY = Math.round((resizeOriginalNodes.start.y + offsetY) / 10) * 10;
  const newEndX = Math.round((resizeOriginalNodes.end.x + offsetX) / 10) * 10;
  const newEndY = Math.round((resizeOriginalNodes.end.y + offsetY) / 10) * 10;

  // PERFORMANCE: Skip collision detection during resize for smoother performance
  // Collision prevention happens naturally through grid snapping and user control
  // If needed, validate on drag end instead

  // PERFORMANCE: Direct imperative mutation for smooth drag
  // Update both nodes AND the wall group itself for live visual feedback
  const layer = groupRef.value?.getNode()?.getLayer();
  const wallGroup = groupRef.value?.getNode();
  if (!layer || !wallGroup) return;

  // Find and update node circles directly
  const startNodeCircle = layer.findOne(`#${props.wall.startNodeId}`);
  const endNodeCircle = layer.findOne(`#${props.wall.endNodeId}`);

  if (startNodeCircle) {
    startNodeCircle.setAttrs({ x: newStartX, y: newStartY });
  }
  if (endNodeCircle) {
    endNodeCircle.setAttrs({ x: newEndX, y: newEndY });
  }

  // Also update the wall group's position and rotation to match the new node positions
  const dx = newEndX - newStartX;
  const dy = newEndY - newStartY;
  const newLength = Math.sqrt(dx * dx + dy * dy);
  const newAngle = (Math.atan2(dy, dx) * 180) / Math.PI;

  wallGroup.setAttrs({
    x: newStartX,
    y: newStartY,
    rotation: newAngle,
  });

  // Update the main wall rect width
  const wallRect = wallGroup.findOne(".wall-main-rect");
  if (wallRect) {
    wallRect.width(newLength);
  }

  // Update resize handle position
  const resizeHandle = wallGroup.findOne(".resize-handle-group");
  if (resizeHandle) {
    resizeHandle.x(newLength / 2);
  }

  // Calculate measurement side locally (same logic as measurementSide computed)
  // Determine which side of the wall to show measurements on
  const stage2 = wallGroup.getStage();
  if (stage2) {
    const stageRect = stage2.container().getBoundingClientRect();
    const cx = stageRect.width / 2;
    const cy = stageRect.height / 2;

    const mx = (newStartX + newEndX) / 2;
    const my = (newStartY + newEndY) / 2;

    const vcx = cx - mx;
    const vcy = cy - my;

    const wx = newEndX - newStartX;
    const wy = newEndY - newStartY;

    const nx2 = -wy;
    const ny2 = wx;

    const dot = nx2 * vcx + ny2 * vcy;
    const localMeasurementSide = dot > 0 ? -1 : 1;

    // Update measurement line points
    const measurementLine = wallGroup.findOne(".measurement-line");
    if (measurementLine) {
      measurementLine.points([
        5,
        localMeasurementSide * (props.wall.thickness / 2 + 15),
        newLength - 5,
        localMeasurementSide * (props.wall.thickness / 2 + 15),
      ]);
    }

    // Update measurement text
    const measurementText = wallGroup.findOne(".measurement-text");
    if (measurementText) {
      measurementText.setAttrs({
        x: newLength / 2,
        y: localMeasurementSide * (props.wall.thickness / 2 + 25),
        text: `${(newLength / 100).toFixed(2)} m`,
        rotation: -newAngle,
      });
    }
  }

  // Batch draw for performance
  layer.batchDraw();
};

const handleResizePointerUp = () => {
  if (isDraggingElement) isDraggingElement.value = false;
  toolsStore.setWallResizing(false);

  // Cancel any pending RAF
  if (resizeRAF !== null) {
    cancelAnimationFrame(resizeRAF);
    resizeRAF = null;
  }
  lastResizeEvent = null;

  // Now commit the final node positions to the store
  // Read the actual visual positions from the circles
  const layer = groupRef.value?.getNode()?.getLayer();
  if (layer) {
    const startNodeCircle = layer.findOne(`#${props.wall.startNodeId}`);
    const endNodeCircle = layer.findOne(`#${props.wall.endNodeId}`);

    if (startNodeCircle) {
      editorConstructionStore.updateNode(
        props.wall.startNodeId,
        {
          x: Math.round(startNodeCircle.x()),
          y: Math.round(startNodeCircle.y()),
        },
        false,
      );
    }
    if (endNodeCircle) {
      editorConstructionStore.updateNode(
        props.wall.endNodeId,
        { x: Math.round(endNodeCircle.x()), y: Math.round(endNodeCircle.y()) },
        false,
      );
    }
  }

  // Commit changes to history
  layoutStore.commit();

  // Cleanup
  resizeStartWorld = null;
  resizeOriginalNodes = null;
  resizeAngleRad = 0;
  adjacentWallsAngles = null;

  // Remove global listeners
  window.removeEventListener("pointermove", handleResizePointerMove);
  window.removeEventListener("pointerup", handleResizePointerUp);

  // Force a single redraw after resize completes
  nextTick(() => {
    cacheNode();
  });
};
// Optimized caching
const groupRef = shallowRef<any>(null); // Konva node - no need for deep reactivity
const isCached = ref(false);
let recacheTimeout: number | null = null;

const cacheNode = () => {
  // Never cache door/window walls — arcs extend beyond cache bounds and they need drag
  if (isDoorOrWindow.value) return;
  // Never cache while a drag is active — caching freezes the bitmap
  if (isWallResizing.value || isDoorWindowDragging.value) return;
  if (groupRef.value && !isCached.value) {
    const node = groupRef.value.getNode();
    if (node) {
      node.cache({
        offset: 10,
        pixelRatio: 1.5,
      });
      isCached.value = true;
    }
  }
};

const clearCacheNode = () => {
  if (groupRef.value && isCached.value) {
    const node = groupRef.value.getNode();
    if (node) {
      node.clearCache();
      isCached.value = false;
    }
  }
};

// Watch GEOMETRY (derived from node positions) instead of props.wall.
// This ensures cache invalidates when connected nodes move (e.g. during drag).
// Re-caching is debounced so during rapid drags walls render live (uncached),
// and only re-cache after 150ms of stability.
const isZooming = ref(false);
let zoomTimeout: number | null = null;

watch(zoom, () => {
  isZooming.value = true;
  clearCacheNode();
  if (zoomTimeout) clearTimeout(zoomTimeout);
  zoomTimeout = window.setTimeout(() => {
    isZooming.value = false;
    cacheNode();
    zoomTimeout = null;
  }, 200);
});

watch(
  [
    geometry, // Already computed, creates new object on change
    isSelected,
    isPartOfSelectedArea,
    isWallResizing,
    isDoorWindowDragging,
    isZooming,
  ],
  () => {
    // PERFORMANCE: Don't invalidate cache during ANY wall resize or zoom
    if (isWallResizing.value || isDoorWindowDragging.value || isZooming.value) {
      return; // Skip cache updates entirely during interactions
    }

    clearCacheNode();
    if (recacheTimeout) clearTimeout(recacheTimeout);
    recacheTimeout = window.setTimeout(() => {
      cacheNode();
      recacheTimeout = null;
    }, 150);
  },
  // No deep: true needed - computed refs trigger on shallow comparison
);

// PERFORMANCE: Removed duplicate zoom watcher - cache doesn't need to invalidate on zoom
// Konva automatically handles scaling of cached nodes, so re-caching on zoom is wasteful
// The geometry watcher above already handles all necessary cache invalidations

onMounted(() => {
  requestAnimationFrame(() => {
    nextTick(cacheNode);
  });
});

onUnmounted(() => {
  if (recacheTimeout) {
    clearTimeout(recacheTimeout);
    recacheTimeout = null;
  }
});
</script>

<template>
  <v-group
    v-if="geometry"
    ref="groupRef"
    :config="{
      id: `group-${wall.id}`,
      x: geometry.x,
      y: geometry.y,
      rotation: geometry.angle,
    }"
    @click="handleClick"
    @tap="handleClick"
  >
    <!-- Wall Type -->
    <template v-if="wall.type === 'wall'">
      <v-rect
        :config="{
          name: 'wall-main-rect',
          x: 0,
          y: -wall.thickness / 2,
          width: geometry.length,
          height: wall.thickness,
          fill: wallColor,
          stroke: isSelected ? selectedStroke : wallStroke,
          strokeWidth: isSelected ? 3 : 1,
          dash: isSelected ? [5, 3] : undefined,
          hitStrokeWidth: 10,
          perfectDrawEnabled: false,
          shadowForStrokeEnabled: false,
        }"
      />
      <!-- Texture Lines -->
      <v-line
        v-for="i in textureLines"
        :key="i"
        :config="{
          points: [i * 30, -wall.thickness / 2, i * 30, wall.thickness / 2],
          stroke: '#d0c8bd',
          strokeWidth: 1,
          listening: false,
          perfectDrawEnabled: false,
        }"
      />
    </template>

    <!-- Door Type -->
    <template v-else-if="wall.type === 'door'">
      <!-- Draggable hit area (invisible, full segment) -->
      <v-rect
        :config="{
          x: 0,
          y: -wall.thickness / 2,
          width: geometry.length,
          height: wall.thickness,
          fill: 'transparent',
          hitStrokeWidth: 15,
          draggable: true,
          perfectDrawEnabled: false,
        }"
        @dragstart="handleDoorWindowDragStart"
        @dragmove="handleDoorWindowDragMove"
        @dragend="handleDoorWindowDragEnd"
      />

      <!-- Door opening background -->
      <v-rect
        :config="{
          x: 0,
          y: -wall.thickness / 2,
          width: geometry.length,
          height: wall.thickness,
          fill: wall.doorType === 'exit' ? emergencyTint : doorOpeningFill,
          stroke: isSelected ? selectedStroke : wallStroke,
          strokeWidth: isSelected ? 3 : 1,
          dash: isSelected ? [5, 3] : undefined,
          listening: false,
          perfectDrawEnabled: false,
          shadowForStrokeEnabled: false,
        }"
      />

      <!-- Sliding door: two overlapping panels with arrows -->
      <template v-if="wall.doorSwing === 'sliding'">
        <!-- Left panel -->
        <v-rect
          :config="{
            x: 2,
            y: -wall.thickness / 2 + 2,
            width: geometry.length * 0.52,
            height: wall.thickness - 4,
            fill: doorLeafFill,
            opacity: 0.6,
            cornerRadius: 1,
            listening: false,
            perfectDrawEnabled: false,
          }"
        />
        <!-- Right panel -->
        <v-rect
          :config="{
            x: geometry.length * 0.48 - 2,
            y: -wall.thickness / 2 + 2,
            width: geometry.length * 0.52,
            height: wall.thickness - 4,
            fill: doorLeafFill,
            opacity: 0.4,
            cornerRadius: 1,
            listening: false,
            perfectDrawEnabled: false,
          }"
        />
        <!-- Left arrow (slides left) -->
        <v-line
          :config="{
            points: [geometry.length * 0.3, 0, geometry.length * 0.15, 0],
            stroke: '#fff',
            strokeWidth: 2,
            lineCap: 'round',
            listening: false,
            perfectDrawEnabled: false,
          }"
        />
        <v-line
          :config="{
            points: [
              geometry.length * 0.2,
              -3,
              geometry.length * 0.15,
              0,
              geometry.length * 0.2,
              3,
            ],
            stroke: '#fff',
            strokeWidth: 1.5,
            lineCap: 'round',
            lineJoin: 'round',
            listening: false,
            perfectDrawEnabled: false,
          }"
        />
        <!-- Right arrow (slides right) -->
        <v-line
          :config="{
            points: [geometry.length * 0.7, 0, geometry.length * 0.85, 0],
            stroke: '#fff',
            strokeWidth: 2,
            lineCap: 'round',
            listening: false,
            perfectDrawEnabled: false,
          }"
        />
        <v-line
          :config="{
            points: [
              geometry.length * 0.8,
              -3,
              geometry.length * 0.85,
              0,
              geometry.length * 0.8,
              3,
            ],
            stroke: '#fff',
            strokeWidth: 1.5,
            lineCap: 'round',
            lineJoin: 'round',
            listening: false,
            perfectDrawEnabled: false,
          }"
        />
      </template>

      <!-- Standard/emergency door: leaf line + sweep arc (architectural style) -->
      <template v-else>
        <!-- Door leaf line (from hinge to open position — shown at 90° open) -->
        <v-line
          :config="{
            points: [
              wall.doorSwing === 'right' ? geometry.length : 0,
              wall.flipped ? -wall.thickness / 2 : wall.thickness / 2,
              wall.doorSwing === 'right' ? geometry.length : 0,
              wall.flipped
                ? -wall.thickness / 2 - geometry.length
                : wall.thickness / 2 + geometry.length,
            ],
            stroke: wall.doorType === 'exit' ? '#C41E3A' : doorLeafFill,
            strokeWidth: 3,
            lineCap: 'round',
            listening: false,
            perfectDrawEnabled: false,
          }"
        />
        <!-- Sweep arc (quarter circle pie) -->
        <v-arc
          :config="{
            x: wall.doorSwing === 'right' ? geometry.length : 0,
            y: wall.flipped ? -wall.thickness / 2 : wall.thickness / 2,
            innerRadius: 0,
            outerRadius: geometry.length,
            angle: 90,
            rotation:
              wall.doorSwing === 'right' ? (wall.flipped ? 180 : 90) : wall.flipped ? -90 : 0,
            fill:
              wall.doorType === 'exit' ? 'rgba(196, 30, 58, 0.06)' : 'rgba(100, 100, 100, 0.05)',
            stroke: wall.doorType === 'exit' ? '#C41E3A' : '#aaa',
            strokeWidth: 1,
            dash: [4, 3],
            opacity: 0.7,
            listening: false,
            perfectDrawEnabled: false,
          }"
        />
        <!-- Hinge indicator dot -->
        <v-circle
          :config="{
            x: wall.doorSwing === 'right' ? geometry.length : 0,
            y: wall.flipped ? -wall.thickness / 2 : wall.thickness / 2,
            radius: 3,
            fill: wall.doorType === 'exit' ? '#C41E3A' : doorLeafFill,
            listening: false,
            perfectDrawEnabled: false,
          }"
        />
      </template>
    </template>

    <!-- Window Type -->
    <template v-else-if="wall.type === 'window'">
      <!-- Draggable hit area (invisible, full segment) -->
      <v-rect
        :config="{
          x: 0,
          y: -wall.thickness / 2,
          width: geometry.length,
          height: wall.thickness,
          fill: 'transparent',
          hitStrokeWidth: 15,
          draggable: true,
          perfectDrawEnabled: false,
        }"
        @dragstart="handleDoorWindowDragStart"
        @dragmove="handleDoorWindowDragMove"
        @dragend="handleDoorWindowDragEnd"
      />

      <!-- Window fill -->
      <v-rect
        :config="{
          x: 0,
          y: -wall.thickness / 2,
          width: geometry.length,
          height: wall.thickness,
          fill: windowFrameFill,
          stroke: isSelected ? selectedStroke : windowFrameStroke,
          strokeWidth: isSelected ? 3 : 2,
          dash: isSelected ? [5, 3] : undefined,
          listening: false,
          perfectDrawEnabled: false,
          shadowForStrokeEnabled: false,
        }"
      />
      <!-- Horizontal center crossbar -->
      <v-line
        :config="{
          points: [2, 0, geometry.length - 2, 0],
          stroke: windowFrameStroke,
          strokeWidth: 1.5,
          lineCap: 'round',
          listening: false,
          perfectDrawEnabled: false,
        }"
      />
      <!-- Vertical center crossbar -->
      <v-line
        :config="{
          points: [
            geometry.length / 2,
            -wall.thickness / 2 + 2,
            geometry.length / 2,
            wall.thickness / 2 - 2,
          ],
          stroke: windowFrameStroke,
          strokeWidth: 1,
          listening: false,
          perfectDrawEnabled: false,
        }"
      />
      <!-- Inner frame left pane -->
      <v-rect
        :config="{
          x: 2,
          y: -wall.thickness / 2 + 2,
          width: geometry.length / 2 - 3,
          height: wall.thickness - 4,
          fill: 'transparent',
          stroke: windowFrameStroke,
          strokeWidth: 0.5,
          opacity: 0.5,
          listening: false,
          perfectDrawEnabled: false,
        }"
      />
      <!-- Inner frame right pane -->
      <v-rect
        :config="{
          x: geometry.length / 2 + 1,
          y: -wall.thickness / 2 + 2,
          width: geometry.length / 2 - 3,
          height: wall.thickness - 4,
          fill: 'transparent',
          stroke: windowFrameStroke,
          strokeWidth: 0.5,
          opacity: 0.5,
          listening: false,
          perfectDrawEnabled: false,
        }"
      />
    </template>

    <!-- Measurements -->
    <v-group :config="{ listening: false }">
      <v-line :config="measurementLineConfig" />
      <v-text :config="measurementTextConfig" />
    </v-group>

    <!-- Corner Preview: Blue circle with white border and + icon -->
    <v-group
      v-if="cornerPreviewPos"
      :config="{
        x: cornerPreviewPos.x,
        y: cornerPreviewPos.y,
        scaleX: 1 / zoom,
        scaleY: 1 / zoom,
        listening: false,
      }"
    >
      <!-- Circle background -->
      <v-circle
        :config="{
          radius: 10,
          fill: '#3b82f6',
          stroke: '#ffffff',
          strokeWidth: 2,
          shadowColor: 'rgba(0,0,0,0.25)',
          shadowBlur: 4,
          shadowOffsetY: 1,
          perfectDrawEnabled: false,
        }"
      />
      <!-- Plus icon: horizontal line -->
      <v-line
        :config="{
          points: [-4, 0, 4, 0],
          stroke: '#ffffff',
          strokeWidth: 2,
          lineCap: 'round',
          perfectDrawEnabled: false,
        }"
      />
      <!-- Plus icon: vertical line -->
      <v-line
        :config="{
          points: [0, -4, 0, 4],
          stroke: '#ffffff',
          strokeWidth: 2,
          lineCap: 'round',
          perfectDrawEnabled: false,
        }"
      />
    </v-group>

    <!-- Wall Resize Handle: Pill shape with bidirectional arrow -->
    <v-group
      v-if="shouldShowResizeHandle && resizeHandleConfig"
      :config="{
        name: 'resize-handle-group',
        x: resizeHandleConfig.x,
        y: resizeHandleConfig.y,
        scaleX: 1 / zoom,
        scaleY: 1 / zoom,
      }"
      @pointerdown="handleResizePointerDown"
    >
      <!-- Pill background -->
      <v-rect
        :config="{
          x: -8,
          y: -18,
          width: 16,
          height: 36,
          fill: '#ffffff',
          stroke: '#94a3b8',
          strokeWidth: 1,
          cornerRadius: 8,
          shadowColor: 'rgba(0,0,0,0.15)',
          shadowBlur: 4,
          shadowOffsetY: 1,
          perfectDrawEnabled: false,
        }"
      />
      <!-- Top arrowhead -->
      <v-line
        :config="{
          points: [-4, -8, 0, -13, 4, -8],
          stroke: '#3b82f6',
          strokeWidth: 2,
          lineCap: 'round',
          lineJoin: 'round',
          listening: false,
          perfectDrawEnabled: false,
        }"
      />
      <!-- Bottom arrowhead -->
      <v-line
        :config="{
          points: [-4, 8, 0, 13, 4, 8],
          stroke: '#3b82f6',
          strokeWidth: 2,
          lineCap: 'round',
          lineJoin: 'round',
          listening: false,
          perfectDrawEnabled: false,
        }"
      />
      <!-- Center grip line -->
      <v-line
        :config="{
          points: [0, -4, 0, 4],
          stroke: '#94a3b8',
          strokeWidth: 1.5,
          lineCap: 'round',
          listening: false,
          perfectDrawEnabled: false,
        }"
      />
      <!-- Invisible hit area for touch targeting (48px tall) -->
      <v-rect
        :config="{
          x: -24,
          y: -24,
          width: 48,
          height: 48,
          fill: 'transparent',
          hitStrokeWidth: 0,
          perfectDrawEnabled: false,
        }"
      />
    </v-group>
  </v-group>
</template>
