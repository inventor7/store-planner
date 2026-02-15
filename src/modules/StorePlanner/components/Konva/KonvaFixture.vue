<script setup lang="ts">
import {
  computed,
  ref,
  shallowRef,
  inject,
  type Ref,
  nextTick,
  onMounted,
  onUnmounted,
  watch,
} from "vue";
import type { PlacedFixture } from "@/modules/StorePlanner/types/editor";
import { useEditorSelection } from "@/modules/StorePlanner/stores/useEditorSelection";
import { useEditorFixtures } from "@/modules/StorePlanner/stores/useEditorFixtures";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { useKonvaSnapping } from "@/modules/StorePlanner/composables/useKonvaSnapping";
// import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { getFixtureVisuals } from "./KonvaFixtureVisuals";
import type { KonvaEventObject } from "konva/lib/Node.js";

// const { t } = useI18n();
const primaryColor = "#3b82f6";

const props = defineProps<{
  fixture: PlacedFixture;
  zoom?: number;
}>();

const emit = defineEmits(["dimension-change"]);

const selectionStore = useEditorSelection();
const fixtureStore = useEditorFixtures();
const toolsStore = useEditorTools();
const layoutStore = useEditorLayout();

const { selectedFixtureId } = storeToRefs(selectionStore);
const { activeTool, editorMode } = storeToRefs(toolsStore);
const { currentLayout } = storeToRefs(layoutStore);

const { handleDragMoveSnap, prepareDragSnapping, clearGuides } = useKonvaSnapping();

// PERFORMANCE: Track zoom to pause animations during zoom
const currentZoom = computed(() => props.zoom || toolsStore.zoom);
const isZooming = ref(false);

// Check if this fixture is placed/tracked
const isPlaced = computed(() => {
  if (!currentLayout.value?.placements || !props.fixture.id) {
    return false;
  }
  return currentLayout.value.placements.some((p) => p.fixtureId === props.fixture.id);
});

// Animation for the placed border
const dashOffset = ref(0);
let animationInterval: number | null = null;
let zoomDebounceTimeout: number | null = null;

// PERFORMANCE: Pause animation during zoom to reduce render overhead
watch(currentZoom, () => {
  isZooming.value = true;
  if (zoomDebounceTimeout) clearTimeout(zoomDebounceTimeout);

  // Stop animation during zoom
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }

  // Resume after 200ms of no zoom changes
  zoomDebounceTimeout = window.setTimeout(() => {
    isZooming.value = false;
    if (isPlaced.value && !animationInterval) {
      startAnimation();
    }
  }, 200);
});

// Start animation when component mounts
onMounted(() => {
  if (isPlaced.value && !isZooming.value) {
    startAnimation();
  }
});

// Watch for changes in isPlaced to start/stop animation
watch(isPlaced, (newVal) => {
  if (newVal && !isZooming.value) {
    startAnimation();
  } else {
    stopAnimation();
  }
});

const startAnimation = () => {
  stopAnimation(); // Clear any existing interval
  // PERFORMANCE: Reduced from 100ms to 150ms (less frequent updates)
  animationInterval = window.setInterval(() => {
    dashOffset.value = (dashOffset.value + 1) % 16; // Cycle through dash pattern
  }, 150); // Update every 150ms instead of 100ms
};

const stopAnimation = () => {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
};

// Clean up interval when component unmounts
onUnmounted(() => {
  stopAnimation();
  if (zoomDebounceTimeout) {
    clearTimeout(zoomDebounceTimeout);
    zoomDebounceTimeout = null;
  }
});

const groupRef = shallowRef<any>(null); // Konva node - no need for deep reactivity
const isDraggingElement = inject<Ref<boolean>>("isDraggingElement");
// FIX: Inject the transformer updater from KonvaCanvas
const forceUpdateTransformer = inject<() => void>("forceUpdateTransformer");

const template = computed(() => fixtureStore.getTemplate(props.fixture.templateId));
const isSelected = computed(() => selectedFixtureId.value === props.fixture.id);

// Image handling for image-based fixtures
const imageElement = ref<HTMLImageElement | null>(null);
const isImageLoaded = ref(false);
const isImageBased = computed(() => !!template.value?.imageUrl);

// Load image when template changes
watch(
  () => template.value?.imageUrl,
  (imageUrl) => {
    if (!imageUrl) {
      imageElement.value = null;
      isImageLoaded.value = false;
      return;
    }

    // Create and load image
    const img = new Image();
    img.crossOrigin = "anonymous"; // Enable CORS if needed
    img.onload = () => {
      imageElement.value = img;
      isImageLoaded.value = true;
    };
    img.onerror = () => {
      console.error(`Failed to load fixture image: ${imageUrl}`);
      imageElement.value = null;
      isImageLoaded.value = false;
    };
    img.src = imageUrl;
  },
  { immediate: true },
);

// Visuals calculation (fallback for non-image fixtures)
const visuals = computed(() => {
  if (!template.value) return null;
  // For image-based fixtures, return a simple placeholder config
  if (isImageBased.value) {
    return {
      mainRect: {
        width: props.fixture.width,
        height: props.fixture.height,
        fill: template.value.color || "#e2e8f0",
        stroke: "#334155",
        strokeWidth: 1,
        cornerRadius: 2,
      },
      details: [],
    };
  }
  return getFixtureVisuals(
    template.value,
    props.fixture.width,
    props.fixture.height,
    props.fixture.customColor,
  );
});

// Current active dimensions (for labels)
const currentWidth = computed(() =>
  isResizing.value ? liveDims.value.width : props.fixture.width,
);
const currentHeight = computed(() =>
  isResizing.value ? liveDims.value.height : props.fixture.height,
);

const showDimensions = computed(() => isSelected.value || isResizing.value);

// Helper for label rotation to keep text upright and parallel
const getLabelRotation = (baseOffset: number) => {
  const normRot = (((props.fixture.rotation + baseOffset) % 360) + 360) % 360;
  // If the total rotation would make text upside down (90° to 270°), flip it 180°
  if (normRot > 90 && normRot <= 270) return 180;
  return 0;
};

// --- LOCAL STATE FOR INTERACTIONS ---
const isResizing = ref(false);
const liveDims = shallowRef({ width: 0, height: 0 }); // Replaced on each update - use shallowRef

// --- TRANSFORM LOGIC ---
const handleTransformStart = () => {
  // Check if this is a wall-attached fixture (door/window)
  const template = fixtureStore.getTemplate(props.fixture.templateId);

  // For wall-attached fixtures, prevent any transformation
  if (template?.isWallAttached) {
    return;
  }

  isResizing.value = true;
  // Initialize live dims
  liveDims.value = { width: props.fixture.width, height: props.fixture.height };
};

const handleTransform = (e: KonvaEventObject<any>) => {
  const node = e.target;
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();

  // Check if this is a wall-attached fixture (door/window)
  const template = fixtureStore.getTemplate(props.fixture.templateId);

  // For wall-attached fixtures, prevent any transformation
  if (template?.isWallAttached) {
    // Reset any changes made during transform
    node.scaleX(1);
    node.scaleY(1);
    node.rotation(props.fixture.rotation);
    return;
  }

  // Calculate what the size WOULD be if we stopped now
  // We use this for the live label
  let newWidth = Math.round(node.width() * scaleX);
  let newHeight = Math.round(node.height() * scaleY);

  liveDims.value = {
    width: newWidth,
    height: newHeight,
  };

  // Emit the dimension change so the properties bar can update
  emit("dimension-change", { width: newWidth, height: newHeight });
};

const handleTransformEnd = (e: KonvaEventObject<any>) => {
  isResizing.value = false;
  const node = e.target; // This is the inner group with the ID

  // Check if this is a wall-attached fixture (door/window)
  const template = fixtureStore.getTemplate(props.fixture.templateId);

  // For wall-attached fixtures, prevent any transformation
  if (template?.isWallAttached) {
    node.scaleX(1);
    node.scaleY(1);
    node.rotation(0); // Relative rotation is 0
    node.x(0);
    node.y(0);
    node.width(props.fixture.width);
    node.height(props.fixture.height);
    return;
  }

  // 1. Calc absolute scale and rotation change
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();
  const relativeRotation = node.rotation();

  // 2. Calc New Dimensions
  const newWidth = Math.max(20, Math.round(node.width() * scaleX));
  const newHeight = Math.max(20, Math.round(node.height() * scaleY));

  // 3. Calc Global Position (Parent X/Y + Rotated Child X/Y)
  // This is slightly complex because the parent is also rotated.
  // Actually, Konva's Transformer handles global -> local mapping.
  // The easiest way is to get absolute position.
  const absPos = node.getAbsolutePosition();
  const stage = node.getStage();
  const transform = stage?.getAbsoluteTransform().copy().invert();
  const worldPos = transform ? transform.point(absPos) : absPos;

  // 4. Reset child to identity for redraw
  node.scaleX(1);
  node.scaleY(1);
  node.rotation(0);
  node.x(0);
  node.y(0);
  node.width(newWidth);
  node.height(newHeight);

  // 5. Update Store
  fixtureStore.updateFixture(props.fixture.id, {
    x: Math.round(worldPos.x),
    y: Math.round(worldPos.y),
    width: newWidth,
    height: newHeight,
    rotation: Math.round(props.fixture.rotation + relativeRotation),
  });
  layoutStore.commit();

  // 6. Sync Transformer
  if (forceUpdateTransformer) nextTick(forceUpdateTransformer);
};

const handleDragStart = (e: KonvaEventObject<DragEvent>) => {
  e.cancelBubble = true;
  if (props.fixture.locked) {
    e.target.stopDrag();
    return;
  }

  // SELECT-FIRST LOGIC IS HANDLED IN :config (draggable prop)
  // If we are here, it means we were allowed to drag

  const stage = e.target.getStage();
  if (stage) prepareDragSnapping(stage, e.target);

  if (isDraggingElement) isDraggingElement.value = true;
};

const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
  if (props.fixture.locked) return;

  // Check if this is a wall-attached fixture (door/window)
  const template = fixtureStore.getTemplate(props.fixture.templateId);
  if (template?.isWallAttached) {
    // For wall-attached fixtures, constrain movement to along the wall
    // and prevent any resizing during drag
    e.target.width(props.fixture.width);
    e.target.height(props.fixture.height);
    e.target.scaleX(1);
    e.target.scaleY(1);

    constrainFixtureToWall(e);
  } else {
    handleDragMoveSnap(e);
  }
};

const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
  e.cancelBubble = true;
  if (isDraggingElement) isDraggingElement.value = false;
  clearGuides();

  const { x, y } = e.target.position();

  // Check if this is a wall-attached fixture (door/window)
  const template = fixtureStore.getTemplate(props.fixture.templateId);

  let finalX = Math.round(x);
  let finalY = Math.round(y);

  // For wall-attached fixtures, ensure they stay on the wall
  if (template?.isWallAttached) {
    // Find the wall this fixture should be attached to
    const wall = findWallForFixture({ ...props.fixture, x: finalX, y: finalY });
    if (wall) {
      // Calculate the wall vector
      const startNode = currentLayout.value?.nodes.find((n) => n.id === wall.startNodeId);
      const endNode = currentLayout.value?.nodes.find((n) => n.id === wall.endNodeId);

      if (startNode && endNode) {
        // Calculate the wall vector
        const wallVector = {
          x: endNode.x - startNode.x,
          y: endNode.y - startNode.y,
        };

        // Calculate the vector from the wall start to the current position
        const posVector = {
          x: finalX - startNode.x,
          y: finalY - startNode.y,
        };

        // Project the position onto the wall line
        const wallLengthSquared = wallVector.x * wallVector.x + wallVector.y * wallVector.y;
        if (wallLengthSquared !== 0) {
          const projectionFactor =
            (posVector.x * wallVector.x + posVector.y * wallVector.y) / wallLengthSquared;

          // Clamp the projection factor to keep the fixture on the wall segment
          const clampedFactor = Math.max(0, Math.min(1, projectionFactor));

          // Calculate the constrained position
          finalX = Math.round(startNode.x + wallVector.x * clampedFactor);
          finalY = Math.round(startNode.y + wallVector.y * clampedFactor);
        }
      }
    }
  }

  fixtureStore.updateFixture(props.fixture.id, {
    x: finalX,
    y: finalY,
  });
  layoutStore.commit();

  // Also update transformer after drag in case snapping changed things
  if (forceUpdateTransformer) forceUpdateTransformer();
};

const handleClick = (e: KonvaEventObject<MouseEvent>) => {
  e.cancelBubble = true;
  // Only allow selection in design mode
  if (editorMode.value === "design") {
    // This logic is key for "Select First":
    // If it's not selected, we select it.
    // The :config.draggable property will reactively update to true.
    selectionStore.selectFixture(props.fixture.id);
  }
};

// Constrain fixture movement to along the wall
const constrainFixtureToWall = (e: KonvaEventObject<DragEvent>) => {
  const stage = e.target.getStage();
  if (!stage) return;

  // Get the current mouse position in stage coordinates
  const pos = stage.getPointerPosition();
  if (!pos) return;

  // Get the wall that this fixture is attached to
  const wall = findWallForFixture(props.fixture);
  if (!wall) {
    // If no wall is found, fall back to normal snapping
    handleDragMoveSnap(e);
    return;
  }

  // Calculate the wall's angle
  const startNode = currentLayout.value?.nodes.find((n) => n.id === wall.startNodeId);
  const endNode = currentLayout.value?.nodes.find((n) => n.id === wall.endNodeId);

  if (!startNode || !endNode) {
    // If we can't find the wall nodes, fall back to normal snapping
    handleDragMoveSnap(e);
    return;
  }

  // Calculate the wall vector
  const wallVector = {
    x: endNode.x - startNode.x,
    y: endNode.y - startNode.y,
  };

  // Calculate the vector from the wall start to the mouse position
  const mouseVector = {
    x: pos.x - startNode.x,
    y: pos.y - startNode.y,
  };

  // Project the mouse position onto the wall line
  const wallLengthSquared = wallVector.x * wallVector.x + wallVector.y * wallVector.y;
  if (wallLengthSquared === 0) {
    // If the wall has zero length, fall back to normal snapping
    handleDragMoveSnap(e);
    return;
  }

  const projectionFactor =
    (mouseVector.x * wallVector.x + mouseVector.y * wallVector.y) / wallLengthSquared;

  // Clamp the projection factor to keep the fixture on the wall segment
  const clampedFactor = Math.max(0, Math.min(1, projectionFactor));

  // Calculate the constrained position
  const constrainedX = startNode.x + wallVector.x * clampedFactor;
  const constrainedY = startNode.y + wallVector.y * clampedFactor;

  // Update the fixture position
  e.target.x(constrainedX);
  e.target.y(constrainedY);
};

// Find the wall that a fixture is attached to
const findWallForFixture = (fixture: PlacedFixture) => {
  if (!currentLayout.value) return null;

  // Find the wall closest to this fixture
  let closestWall = null;
  let minDistance = Infinity;

  for (const wall of currentLayout.value.walls) {
    // Get the wall's start and end nodes
    const startNode = currentLayout.value.nodes.find((n) => n.id === wall.startNodeId);
    const endNode = currentLayout.value.nodes.find((n) => n.id === wall.endNodeId);

    if (!startNode || !endNode) continue;

    // Calculate the distance from the fixture to the wall line
    const distance = distanceToLine(
      fixture.x,
      fixture.y,
      startNode.x,
      startNode.y,
      endNode.x,
      endNode.y,
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestWall = wall;
    }
  }

  return closestWall;
};

// Calculate the distance from a point to a line segment
const distanceToLine = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  if (lenSq === 0) return Math.sqrt(A * A + B * B); // Points are coincident

  let param = dot / lenSq;

  // Limit param to line segment
  param = Math.max(0, Math.min(1, param));

  const xx = x1 + param * C;
  const yy = y1 + param * D;

  const dx = px - xx;
  const dy = py - yy;

  return Math.sqrt(dx * dx + dy * dy);
};
</script>

<template>
  <v-group
    v-if="visuals"
    :config="{
      x: fixture.x,
      y: fixture.y,
      rotation: fixture.rotation,
      draggable:
        isSelected && !fixture.locked && activeTool === 'select' && editorMode === 'design',
    }"
    @dragstart="handleDragStart"
    @dragmove="handleDragMove"
    @dragend="handleDragEnd"
    @click="handleClick"
    @tap="handleClick"
  >
    <!--
      SELECTION TARGET: We put the ID here so the Transformer only wraps the visuals,
      effectively excluding the outside labels from the selection box.
    -->
    <v-group
      ref="groupRef"
      :config="{
        id: fixture.id,
        name: 'object',
        width: fixture.width,
        height: fixture.height,
      }"
      @transformstart="handleTransformStart"
      @transform="handleTransform"
      @transformend="handleTransformEnd"
    >
      <!-- Image Layer (rendered on top if available) -->
      <v-image
        v-if="isImageBased && isImageLoaded && imageElement"
        :config="{
          image: imageElement,
          x: 0,
          y: 0,
          width: fixture.width,
          height: fixture.height,
          listening: false,
          perfectDrawEnabled: false,
          shadowForStrokeEnabled: false,
        }"
      />

      <!-- Base Shape (always rendered - shows placeholder for image fixtures while loading) -->
      <v-rect
        :config="{
          ...visuals.mainRect,
          x: 0,
          y: 0,
          shadowForStrokeEnabled: false,
          perfectDrawEnabled: false,
          opacity: isImageBased && isImageLoaded ? 0 : 1,
          stroke: isSelected && !isResizing ? primaryColor : visuals.mainRect.stroke,
          strokeWidth: isSelected && !isResizing ? 2 : visuals.mainRect.strokeWidth,
        }"
      />

      <!-- Details (only for shape-based fixtures) -->
      <template v-if="!isImageBased" v-for="(detail, i) in visuals.details" :key="i">
        <component
          :is="`v-${detail.type.toLowerCase()}`"
          :config="{
            ...detail.config,
            listening: false,
            perfectDrawEnabled: true,
            shadowForStrokeEnabled: false,
          }"
        />
      </template>

      <!-- Text Label (Hide during resize for clarity) -->
      <v-text
        v-if="(fixture.label || template?.name) && !isResizing"
        :config="{
          x: 4,
          y: 4,
          width: fixture.width - 8,
          text: fixture.label || template?.name,
          fill: '#ffffff',
          fontSize: 10,
          listening: false,
          perfectDrawEnabled: false,
        }"
      />

      <!-- Green dashed border when fixture is placed/tracked -->
      <v-rect
        v-if="isPlaced"
        :config="{
          x: -3,
          y: -3,
          width: fixture.width + 6,
          height: fixture.height + 6,
          stroke: '#22c55e',
          strokeWidth: 4,
          dash: [12, 8],
          dashOffset: dashOffset,
          listening: false,
          perfectDrawEnabled: false,
          name: 'placed-border',
        }"
      />
    </v-group>

    <!-- DIMENSION LABELS (Outside the selection group) -->
    <v-group v-if="showDimensions" key="fixture-labels" :config="{ listening: false }">
      <!-- Width Label (Top) -->
      <v-group
        :config="{
          x: currentWidth / 2,
          y: -22 / currentZoom,
          scaleX: 1 / currentZoom,
          scaleY: 1 / currentZoom,
          rotation: getLabelRotation(0),
        }"
      >
        <v-rect
          :config="{
            x: -30,
            y: -10,
            width: 60,
            height: 20,
            fill: '#1e293b',
            opacity: 0.9,
            cornerRadius: 4,
          }"
        />
        <v-text
          :config="{
            x: -30,
            y: -6,
            width: 60,
            text: `${(currentWidth / 100).toFixed(2)} m`,
            align: 'center',
            fontSize: 12,
            fontStyle: 'bold',
            fill: 'white',
          }"
        />
      </v-group>

      <!-- Height Label (Left) -->
      <v-group
        :config="{
          x: -22 / currentZoom,
          y: currentHeight / 2,
          scaleX: 1 / currentZoom,
          scaleY: 1 / currentZoom,
          rotation: getLabelRotation(90) + 90,
        }"
      >
        <v-rect
          :config="{
            x: -30,
            y: -10,
            width: 60,
            height: 20,
            fill: '#1e293b',
            opacity: 0.9,
            cornerRadius: 4,
          }"
        />
        <v-text
          :config="{
            x: -30,
            y: -6,
            width: 60,
            text: `${(currentHeight / 100).toFixed(2)} m`,
            align: 'center',
            fontSize: 12,
            fontStyle: 'bold',
            fill: 'white',
          }"
        />
      </v-group>
    </v-group>
  </v-group>
</template>
