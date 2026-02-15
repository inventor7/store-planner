<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, provide } from "vue";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { useEditorSelection } from "@/modules/StorePlanner/stores/useEditorSelection";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { useEditorConstruction } from "@/modules/StorePlanner/stores/useEditorConstruction";
import { storeToRefs } from "pinia";
// import { useI18n } from "vue-i18n";
import { useKonvaViewport } from "./useKonvaViewport";
import KonvaWall from "./KonvaWall.vue";
import KonvaFixture from "./KonvaFixture.vue";
import KonvaNode from "./KonvaNode.vue";
import KonvaArea from "./KonvaArea.vue";
import type { KonvaEventObject } from "konva/lib/Node.js";
import type Konva from "konva";

const emit = defineEmits(["fixture-dimension-change", "canvas-clicked"]);

const layoutStore = useEditorLayout();
const selectionStore = useEditorSelection();
const toolsStore = useEditorTools();
const constructionStore = useEditorConstruction();

const { currentLayout, currentFloor } = storeToRefs(layoutStore);
const { selectedFixtureId, selectedWallId, selectedNodeId } = storeToRefs(selectionStore);
const { editorMode, snappingGuides } = storeToRefs(toolsStore);
const { isDrawingWall, drawingStartNodeId } = storeToRefs(toolsStore);

const stageRef = ref<{ getStage: () => Konva.Stage } | null>(null);
const contentLayerRef = ref<any>(null);

// Dimensions - No padding, floor fills complete surface
const width = computed(() => currentFloor.value?.width || currentLayout.value?.width || 0);
const height = computed(() => currentFloor.value?.height || currentLayout.value?.height || 0);

// Viewport logic
const { scale, position, isDraggingElement, handleWheel, handleDragStart, handleDragEnd } =
  useKonvaViewport(stageRef);

provide("isDraggingElement", isDraggingElement);

// Register snapshot function with the tools store
const registerSnapshotFunction = () => {
  toolsStore.takeSnapshot = async () => {
    if (!stageRef.value) return null;

    const stage = stageRef.value.getStage();
    if (!stage) return null;

    // Store original transform
    const originalScale = stage.scaleX();
    const originalX = stage.x();
    const originalY = stage.y();

    try {
      // Reset stage transform to get clean export
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });

      // Calculate bounds of all content
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      // Check all nodes
      if (currentLayout.value?.nodes) {
        currentLayout.value.nodes.forEach((node) => {
          minX = Math.min(minX, node.x);
          minY = Math.min(minY, node.y);
          maxX = Math.max(maxX, node.x);
          maxY = Math.max(maxY, node.y);
        });
      }

      // Check all fixtures
      if (currentLayout.value?.fixtures) {
        currentLayout.value.fixtures.forEach((fixture) => {
          const fx = fixture.x || 0;
          const fy = fixture.y || 0;
          const fw = fixture.width || 100;
          const fh = fixture.height || 100;

          // Use Top-Left anchor logic
          minX = Math.min(minX, fx);
          minY = Math.min(minY, fy);
          maxX = Math.max(maxX, fx + fw);
          maxY = Math.max(maxY, fy + fh);
        });
      }

      // If no content found, use layout dimensions
      if (!isFinite(minX) || !isFinite(minY)) {
        const layoutWidth = currentFloor.value?.width || currentLayout.value?.width || 1000;
        const layoutHeight = currentFloor.value?.height || currentLayout.value?.height || 1000;
        minX = 0;
        minY = 0;
        maxX = layoutWidth;
        maxY = layoutHeight;
      }

      // Calculate content dimensions
      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;

      // Add generous padding
      const padding = 100;
      const exportX = minX - padding;
      const exportY = minY - padding;
      const exportWidth = contentWidth + padding * 2;
      const exportHeight = contentHeight + padding * 2;

      // Export with calculated bounds
      const dataUrl = stage.toDataURL({
        x: exportX,
        y: exportY,
        width: exportWidth,
        height: exportHeight,
        pixelRatio: 2,
      });

      return dataUrl;
    } finally {
      // Restore original transform
      stage.scale({ x: originalScale, y: originalScale });
      stage.position({ x: originalX, y: originalY });
    }
  };
};

// --- TRANSFORMER LOGIC (PERFORMANCE FIX) ---
const transformerRef = ref<any>(null);

// We update the transformer manually to avoid Vue reactivity overhead on the canvas loop
// ONLY for fixtures - areas don't use transformer
const updateTransformer = () => {
  const tr = transformerRef.value?.getNode();
  if (!tr) return;

  // Only handle fixtures, NOT areas
  const selectedId = selectedFixtureId.value;

  // If nothing selected, clear nodes and return
  if (!selectedId) {
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
    return;
  }

  // Find the Konva Node
  const stage = stageRef.value?.getStage();
  const selectedNode = stage?.findOne(`#${selectedId}`);

  if (selectedNode) {
    // Only attach if not already attached to avoid flicker
    if (tr.nodes()[0] !== selectedNode) {
      tr.nodes([selectedNode]);
    }
    // CRITICAL: Force update the transformer's bounding box calculation
    // This fixes the "Snap Back" issue
    tr.forceUpdate();
    tr.getLayer()?.batchDraw();
  } else {
    tr.nodes([]);
  }
};

// Provide this function to children (KonvaFixture) so they can call it after resize
provide("forceUpdateTransformer", updateTransformer);

// Watch for selection changes to attach/detach transformer (fixtures only)
watch(selectedFixtureId, () => {
  nextTick(updateTransformer);
});

// Walls/Fixtures/etc refs
const walls = computed(() => currentLayout.value?.walls || []);
const fixtures = computed(() => currentLayout.value?.fixtures || []);
const nodes = computed(() => currentLayout.value?.nodes || []);
const areas = computed(() => currentLayout.value?.areas || []);
const isStructureMode = computed(
  () => editorMode.value === "design" || !!selectedWallId.value || !!selectedNodeId.value,
);

const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
  // Check if we're in wall drawing mode
  if (isDrawingWall.value && drawingStartNodeId.value) {
    // If we clicked on a node, try to connect the wall
    // Check both e.target and e.target.parent for node detection
    const isNodeTarget = e.target.attrs?.name === "node" && e.target.attrs?.id;
    const isNodeParent = e.target.parent?.attrs?.name === "node" && e.target.parent?.attrs?.id;

    if (isNodeTarget || isNodeParent) {
      const targetNodeId = isNodeTarget ? e.target.attrs.id : e.target.parent?.attrs.id;

      // Don't connect to the same node
      if (targetNodeId === drawingStartNodeId.value) {
        toolsStore.cancelDrawingWall();
        return;
      }

      // Add the wall between the two nodes
      constructionStore.addWall(drawingStartNodeId.value, targetNodeId, "wall");
      layoutStore.commit();

      // Exit drawing mode
      toolsStore.cancelDrawingWall();
      return;
    } else {
      // If clicked elsewhere, cancel drawing
      toolsStore.cancelDrawingWall();
      return;
    }
  }

  // If clicked on empty stage (not a shape), deselect
  if (e.target === e.target.getStage()) {
    selectionStore.deselectAll();
    // Also reset the active tool to select when clicking on empty space
    toolsStore.setActiveTool("select");
    // Clear any pending corner preview
    toolsStore.clearPendingCorner();

    // Emit an event to hide floor tabs when clicking on canvas
    emit("canvas-clicked");
  }
};

const gridPatternImage = ref<HTMLImageElement | null>(null);
// ... (Keep existing grid pattern logic) ...
const createGridPattern = () => {
  const canvas = document.createElement("canvas");
  const size = 50;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 0.5;
  for (let i = 10; i < size; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, size, size);
  const img = new Image();
  img.src = canvas.toDataURL();
  img.onload = () => {
    gridPatternImage.value = img;
  };
};

// Touch interaction state for pinch and zoom
const lastCenter = ref();
const lastDist = ref(0);
const dragStopped = ref(false);

// Calculate distance between two points
const getDistance = (p1: any, p2: any) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

// Calculate center point between two points
const getCenter = (p1: any, p2: any) => {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
};

// Handle touch move for pinch and zoom
const handleTouchMove = (e: any) => {
  e.evt.preventDefault();

  const touch1 = e.evt.touches[0];
  const touch2 = e.evt.touches[1];
  const stage = stageRef.value?.getStage();

  // we need to restore dragging, if it was cancelled by multi-touch
  if (touch1 && !touch2 && !stage?.isDragging() && dragStopped.value) {
    stage?.startDrag();
    dragStopped.value = false;
  }

  if (touch1 && touch2) {
    // if the stage was under Konva's drag&drop
    // we need to stop it, and implement our own pan logic with two pointers
    if (stage?.isDragging()) {
      stage?.stopDrag();
      dragStopped.value = true;
    }

    const rect = stage?.container().getBoundingClientRect();

    const p1 = {
      x: touch1.clientX - (rect?.left || 0),
      y: touch1.clientY - (rect?.top || 0),
    };
    const p2 = {
      x: touch2.clientX - (rect?.left || 0),
      y: touch2.clientY - (rect?.top || 0),
    };

    if (!lastCenter.value) {
      lastCenter.value = getCenter(p1, p2);
      return;
    }
    const newCenter = getCenter(p1, p2);

    const dist = getDistance(p1, p2);

    if (!lastDist.value) {
      lastDist.value = dist;
      return;
    }

    // local coordinates of center point
    const pointTo = {
      x: (newCenter.x - position.value.x) / scale.value,
      y: (newCenter.y - position.value.y) / scale.value,
    };

    const newScale = scale.value * (dist / lastDist.value);

    // Clamp zoom
    const clampedScale = Math.max(0.01, Math.min(10, newScale));

    // calculate new position of the stage
    const dx = newCenter.x - lastCenter.value.x;
    const dy = newCenter.y - lastCenter.value.y;

    const newPosition = {
      x: newCenter.x - pointTo.x * clampedScale + dx,
      y: newCenter.y - pointTo.y * clampedScale + dy,
    };

    // Update local state and stage immediately for smoothness
    scale.value = clampedScale;
    position.value = newPosition;

    // Sync to store
    toolsStore.setZoom(clampedScale);
    toolsStore.setPanOffset(newPosition);

    lastDist.value = dist;
    lastCenter.value = newCenter;
  }
};

// Reset touch state on touch end
const handleTouchEnd = () => {
  lastDist.value = 0;
  lastCenter.value = null;
  dragStopped.value = false;
};

// Window resize handling
const containerWidth = ref(window.innerWidth - 64);
const containerHeight = ref(window.innerHeight);
const updateSize = () => {
  containerWidth.value = window.innerWidth - 64;
  containerHeight.value = window.innerHeight;
};

// --- CUSTOM TRANSFORMER DRAWING LOGIC ---
// 1. Custom Anchor Drawer
// NOTE: anchorFunc is deprecated, we should use anchorStyleFunc instead
// But keeping this for reference in case we need custom drawing later
const anchorStyleFunc = (anchor: any) => {
  const name = anchor.name();
  console.log("[KonvaCanvas] Anchor style for:", name); // Use name to avoid unused err

  // Make all anchors circular and styled
  anchor.cornerRadius(50);
  anchor.fill("#ffffff");
  anchor.stroke("#3b82f6");
  anchor.strokeWidth(2);

  // Customize rotation handle
  if (name === "rotater") {
    anchor.fill("#3b82f6");
    anchor.stroke("#ffffff");
  }
};

// PERFORMANCE: Throttle guide redraw to max 60fps (16ms) instead of immediate
let guideDrawRAF: number | null = null;
watch(
  snappingGuides,
  () => {
    // Cancel pending draw if already scheduled
    if (guideDrawRAF !== null) return;

    // Schedule draw for next frame (~60fps max)
    guideDrawRAF = requestAnimationFrame(() => {
      const layer = contentLayerRef.value?.getNode();
      if (layer) {
        layer.batchDraw();
      }
      guideDrawRAF = null;
    });
  },
  { deep: true },
);

provide("forceUpdateTransformer", updateTransformer);

// --- RULER MEASUREMENTS ---
const rulerSize = 40; // Height/width of ruler bars in canvas units
const rulerTickInterval = 100; // Every 100px = 1 meter

// Actual floor dimensions (what user entered)
const floorBounds = computed(() => {
  const floorW = currentFloor.value?.width || currentLayout.value?.width || 1000;
  const floorH = currentFloor.value?.height || currentLayout.value?.height || 800;

  return {
    x: 0,
    y: 0,
    width: floorW,
    height: floorH,
  };
});

// Generate ruler ticks for horizontal ruler (top/bottom)
const horizontalTicks = computed(() => {
  const ticks = [];
  const layoutWidth = width.value;

  for (let x = 0; x <= layoutWidth; x += rulerTickInterval) {
    ticks.push({
      position: x,
      label: `${(x / 100).toFixed(0)} m`,
    });
  }

  return ticks;
});

// Generate ruler ticks for vertical ruler (left/right)
const verticalTicks = computed(() => {
  const ticks = [];
  const layoutHeight = height.value;

  for (let y = 0; y <= layoutHeight; y += rulerTickInterval) {
    ticks.push({
      position: y,
      label: `${(y / 100).toFixed(0)} m`,
    });
  }

  return ticks;
});

onMounted(() => {
  createGridPattern();
  registerSnapshotFunction();
  window.addEventListener("resize", updateSize);
});

onUnmounted(() => {
  window.removeEventListener("resize", updateSize);
  // PERFORMANCE: Clean up RAF on unmount
  if (guideDrawRAF !== null) {
    cancelAnimationFrame(guideDrawRAF);
    guideDrawRAF = null;
  }
});
</script>

<template>
  <div class="konva-wrapper">
    <v-stage
      ref="stageRef"
      :config="{
        width: containerWidth,
        height: containerHeight,
        draggable: !isDraggingElement,
        x: position.x,
        y: position.y,
        scaleX: scale,
        scaleY: scale,
      }"
      @wheel="handleWheel"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @click="handleStageClick"
      @tap="handleStageClick"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      :draggable="editorMode !== 'survey'"
    >
      <!-- LAYER 1: Background (Static) -->
      <v-layer key="layer-bg" :config="{ listening: false }">
        <v-rect
          v-if="gridPatternImage"
          :config="{
            x: 0,
            y: 0,
            width: width,
            height: height,
            fillPatternImage: gridPatternImage,
            fillPatternRepeat: 'repeat',
          }"
        />

        <!-- Floor boundary removed - floor now fills complete surface -->
      </v-layer>

      <!-- LAYER 2: Content (Fixtures, Walls) -->
      <v-layer key="layer-content" ref="contentLayerRef">
        <KonvaArea v-for="area in areas" :key="area.id" :area="area" />
        <KonvaWall v-for="wall in walls" :key="wall.id" :wall="wall" :zoom="scale" />

        <!-- Fixtures -->
        <KonvaFixture
          v-for="fixture in fixtures"
          :key="fixture.id"
          :fixture="fixture"
          :zoom="scale"
          @dimension-change="
            (dims) => emit('fixture-dimension-change', { id: fixture.id, ...dims })
          "
        />

        <template v-if="isStructureMode">
          <KonvaNode v-for="node in nodes" :key="node.id" :node="node" />
        </template>

        <!-- Snapping Guides -->
        <!-- PERFORMANCE: perfectDrawEnabled false for guides -->
        <v-line
          v-for="(guide, i) in snappingGuides"
          :key="'guide-' + i"
          :config="{
            points:
              guide.orientation === 'H'
                ? [-10000, guide.lineGuide, 10000, guide.lineGuide]
                : [guide.lineGuide, -10000, guide.lineGuide, 10000],
            stroke: '#ef4444',
            strokeWidth: 2,
            dash: [6, 8],
            listening: false,
            perfectDrawEnabled: false,
          }"
        />
      </v-layer>

      <!-- LAYER 3: Transformer with Custom Styles -->
      <!-- CRITICAL: Use visible instead of v-if to prevent DOM desync crash during mode toggle -->
      <v-layer key="layer-transformer" :config="{ visible: editorMode === 'design' }">
        <v-transformer
          ref="transformerRef"
          :config="{
            enabledAnchors: ['top-center', 'middle-right', 'bottom-center', 'middle-left'],

            rotateEnabled: true,
            rotationSnaps: [0, 90, 180, 270],
            rotateAnchorOffset: 7 / scale + 50,
            rotateAnchorCursor: 'grab',

            //dynamic padding according to zoom value , zommed in = smaller padding zommed out = bigger padding
            padding: 1 / scale,

            anchorSize: 16,

            borderStroke: '#3b82f6',
            borderStrokeWidth: 2,
            borderDash: [4, 4],

            perfectDrawEnabled: false,
            keepRatio: false,

            boundBoxFunc: (oldBox: any, newBox: any) => {
              // Guard against NaN values
              const isValidBox = (box: any) => {
                return (
                  box &&
                  typeof box.x === 'number' &&
                  isFinite(box.x) &&
                  typeof box.y === 'number' &&
                  isFinite(box.y) &&
                  typeof box.width === 'number' &&
                  isFinite(box.width) &&
                  typeof box.height === 'number' &&
                  isFinite(box.height) &&
                  box.width > 0 &&
                  box.height > 0
                );
              };

              // If newBox is invalid, return oldBox
              if (!isValidBox(newBox)) {
                return isValidBox(oldBox)
                  ? oldBox
                  : { x: 0, y: 0, width: 100, height: 100, rotation: 0 };
              }

              // If new box is too small, return old box
              if (newBox.width < 20 || newBox.height < 20) {
                return isValidBox(oldBox) ? oldBox : newBox;
              }

              return newBox;
            },
          }"
        />
      </v-layer>

      <!-- LAYER 4: Measurement Rulers (On layout borders) -->
      <!-- PERFORMANCE: Rulers cached separately to avoid re-render on every zoom -->
      <v-layer key="layer-rulers" :config="{ listening: false, perfectDrawEnabled: false }">
        <!-- Top Ruler Background -->
        <v-rect
          :config="{
            x: 0,
            y: -rulerSize,
            width: width,
            height: rulerSize,
            fill: '#fefefe',
            stroke: '#94a3b8',
            strokeWidth: 1,
          }"
        />

        <!-- Top Ruler Ticks and Labels -->
        <template v-for="tick in horizontalTicks" :key="'top-' + tick.position">
          <!-- Major tick line (taller) -->
          <v-line
            :config="{
              points: [tick.position, -10, tick.position, 0],
              stroke: '#94a3b8',
              strokeWidth: 2,
            }"
          />
          <!-- Label perfectly centered on the tick -->
          <v-text
            :config="{
              x: tick.position - 40,
              y: -rulerSize + 10,
              width: 80,
              text: tick.label,
              fontSize: 14,
              fontStyle: 'bold',
              fill: '#94a3b8',
              align: 'center',
            }"
          />
        </template>

        <!-- Bottom Ruler Background -->
        <v-rect
          :config="{
            x: 0,
            y: height,
            width: width,
            height: rulerSize,
            fill: '#fefefe',
            stroke: '#94a3b8',
            strokeWidth: 1,
          }"
        />

        <!-- Bottom Ruler Ticks and Labels -->
        <template v-for="tick in horizontalTicks" :key="'bottom-' + tick.position">
          <!-- Major tick line (taller) -->
          <v-line
            :config="{
              points: [tick.position, height, tick.position, height + 10],
              stroke: '#94a3b8',
              strokeWidth: 2,
            }"
          />
          <!-- Label perfectly centered on the tick -->
          <v-text
            :config="{
              x: tick.position - 40,
              y: height + 15,
              width: 80,
              text: tick.label,
              fontSize: 14,
              fontStyle: 'bold',
              fill: '#94a3b8',
              align: 'center',
            }"
          />
        </template>

        <!-- Left Ruler Background -->
        <v-rect
          :config="{
            x: -rulerSize,
            y: 0,
            width: rulerSize,
            height: height,
            fill: '#fefefe',
            stroke: '#94a3b8',
            strokeWidth: 1,
          }"
        />

        <!-- Left Ruler Ticks and Labels -->
        <template v-for="tick in verticalTicks" :key="'left-' + tick.position">
          <!-- Major tick line (wider) -->
          <v-line
            :config="{
              points: [-10, tick.position, 0, tick.position],
              stroke: '#94a3b8',
              strokeWidth: 2,
            }"
          />
          <!-- Label perfectly centered on the tick -->
          <v-text
            :config="{
              x: -rulerSize + 5,
              y: tick.position - 7,
              width: rulerSize - 10,
              text: tick.label,
              fontSize: 14,
              fontStyle: 'bold',
              fill: '#94a3b8',
              align: 'center',
            }"
          />
        </template>

        <!-- Right Ruler Background -->
        <v-rect
          :config="{
            x: width,
            y: 0,
            width: rulerSize,
            height: height,
            fill: '#fefefe',
            stroke: '#94a3b8',
            strokeWidth: 1,
          }"
        />

        <!-- Right Ruler Ticks and Labels -->
        <template v-for="tick in verticalTicks" :key="'right-' + tick.position">
          <!-- Major tick line (wider) -->
          <v-line
            :config="{
              points: [width, tick.position, width + 10, tick.position],
              stroke: '#94a3b8',
              strokeWidth: 2,
            }"
          />
          <!-- Label perfectly centered on the tick -->
          <v-text
            :config="{
              x: width + 9,
              y: tick.position - 7,
              width: rulerSize - 10,
              text: tick.label,
              fontSize: 14,
              fontStyle: 'bold',
              fill: '#94a3b8',
              align: 'center',
            }"
          />
        </template>

        <!-- Floor Dimension Labels (Rendered outside floor edges) -->
        <!-- Top edge dimension -->
        <v-text
          :config="{
            x: floorBounds.width / 2,
            y: -70,
            text: `${(floorBounds.width / 100).toFixed(1)}m`,
            fontSize: 22,
            fontStyle: 'bold',
            fill: '#475569',
            align: 'center',
            offsetX: 25,
          }"
        />
        <!-- Bottom edge dimension -->
        <v-text
          :config="{
            x: floorBounds.width / 2,
            y: floorBounds.height + 50,
            text: `${(floorBounds.width / 100).toFixed(1)}m`,
            fontSize: 22,
            fontStyle: 'bold',
            fill: '#475569',
            align: 'center',
            offsetX: 25,
          }"
        />
        <!-- Left edge dimension -->
        <v-text
          :config="{
            x: -60,
            y: floorBounds.height / 2,
            text: `${(floorBounds.height / 100).toFixed(1)}m`,
            fontSize: 22,
            fontStyle: 'bold',
            fill: '#475569',
            align: 'right',
            offsetY: 9,
            rotation: -90,
          }"
        />
        <!-- Right edge dimension -->
        <v-text
          :config="{
            x: floorBounds.width + 60,
            y: floorBounds.height / 2 - 44,
            text: `${(floorBounds.height / 100).toFixed(1)}m`,
            fontSize: 22,
            fontStyle: 'bold',
            fill: '#475569',
            align: 'left',
            offsetY: 9,
            rotation: 90,
          }"
        />

        <!-- Corner Squares (cover the corners where rulers meet) -->
        <v-rect
          :config="{
            x: -rulerSize,
            y: -rulerSize,
            width: rulerSize,
            height: rulerSize,
            fill: '#e2e8f0',
            stroke: '#cbd5e1',
            strokeWidth: 2,
          }"
        />
        <v-rect
          :config="{
            x: width,
            y: -rulerSize,
            width: rulerSize,
            height: rulerSize,
            fill: '#e2e8f0',
            stroke: '#cbd5e1',
            strokeWidth: 2,
          }"
        />
        <v-rect
          :config="{
            x: -rulerSize,
            y: height,
            width: rulerSize,
            height: rulerSize,
            fill: '#e2e8f0',
            stroke: '#cbd5e1',
            strokeWidth: 2,
          }"
        />
        <v-rect
          :config="{
            x: width,
            y: height,
            width: rulerSize,
            height: rulerSize,
            fill: '#e2e8f0',
            stroke: '#cbd5e1',
            strokeWidth: 2,
          }"
        />
      </v-layer>
    </v-stage>
  </div>
</template>

<style scoped>
.konva-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #cbd5e1;
}
</style>
