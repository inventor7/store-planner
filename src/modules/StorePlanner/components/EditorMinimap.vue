<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { useEditorConstruction } from "@/modules/StorePlanner/stores/useEditorConstruction";
import { storeToRefs } from "pinia";

const layoutStore = useEditorLayout();
const toolsStore = useEditorTools();
const constructionStore = useEditorConstruction();

// Destructure reactive properties with storeToRefs
const { currentLayout, currentFloor } = storeToRefs(layoutStore);
const { zoom, panOffset } = storeToRefs(toolsStore);
const minimapRef = ref<SVGSVGElement | null>(null);

const padding = 12;
const minimapSize = 180; // Bigger size as requested

const canvasWidth = computed(
  () =>
    currentFloor.value?.width || currentLayout.value?.width || 1000,
);
const canvasHeight = computed(
  () =>
    currentFloor.value?.height ||
    currentLayout.value?.height ||
    1000,
);

const viewBoxPadding = 200; // Match EditorCanvas.vue

// The full extent of the world we show in the minimap
const worldWidth = computed(() => canvasWidth.value + viewBoxPadding * 2);
const worldHeight = computed(() => canvasHeight.value + viewBoxPadding * 2);

// Scale to fit the minimap size while maintaining aspect ratio
const scale = computed(() => {
  const maxDim = Math.max(worldWidth.value, worldHeight.value);
  return (minimapSize - padding * 2) / maxDim;
});

const minimapWidth = computed(
  () => worldWidth.value * scale.value + padding * 2,
);
const minimapHeight = computed(
  () => worldHeight.value * scale.value + padding * 2,
);

const walls = computed(() => currentLayout.value?.walls || []);
const fixtures = computed(() => currentLayout.value?.fixtures || []);

// Viewport logic
const viewportRect = computed(() => {
  // Use window sizes. Toolbar is 64px.
  const viewW = window.innerWidth - 64;
  const viewH = window.innerHeight;

  // World visible width/height
  const w = (viewW / zoom.value) * scale.value;
  const h = (viewH / zoom.value) * scale.value;

  // Center of the screen in world coordinates
  // Given: sx = (wx + 200) * zoom + panX
  // wx = (sx - panX) / zoom - 200

  const centerX =
    (viewW / 2 - panOffset.value.x) / zoom.value - viewBoxPadding;
  const centerY =
    (viewH / 2 - panOffset.value.y) / zoom.value - viewBoxPadding;

  // Map coordinates
  // mx = (wx + 200) * scale + padding

  return {
    x: (centerX + viewBoxPadding) * scale.value + padding - w / 2,
    y: (centerY + viewBoxPadding) * scale.value + padding - h / 2,
    width: w,
    height: h,
  };
});

const navigateTo = (e: MouseEvent | PointerEvent) => {
  if (!minimapRef.value) return;

  const rect = minimapRef.value.getBoundingClientRect();
  const x = e.clientX - rect.left - padding;
  const y = e.clientY - rect.top - padding;

  // mx = (wx + 200) * scale + padding
  // wx = (mx - padding) / scale - 200

  const worldX = x / scale.value - viewBoxPadding;
  const worldY = y / scale.value - viewBoxPadding;

  const viewW = window.innerWidth - 64;
  const viewH = window.innerHeight;

  // Set panOffset so that worldX, worldY is at the center of the screen
  // panX = screenX - (wx + 200) * zoom

  toolsStore.setPanOffset({
    x: viewW / 2 - (worldX + viewBoxPadding) * zoom.value,
    y: viewH / 2 - (worldY + viewBoxPadding) * zoom.value,
  });
};

const isInteracting = ref(false);

const handlePointerDown = (e: PointerEvent) => {
  isInteracting.value = true;
  navigateTo(e);
};

const handlePointerMove = (e: PointerEvent) => {
  if (isInteracting.value) {
    navigateTo(e);
  }
};

const handlePointerUp = () => {
  isInteracting.value = false;
};

onMounted(() => {
  window.addEventListener("pointerup", handlePointerUp);
});

onUnmounted(() => {
  window.removeEventListener("pointerup", handlePointerUp);
});
</script>

<template>
  <div
    class="minimap-container glass-morphism"
    :style="{ width: minimapWidth + 'px', height: minimapHeight + 'px' }"
  >
    <svg
      ref="minimapRef"
      :viewBox="`0 0 ${minimapWidth} ${minimapHeight}`"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      class="minimap-svg"
    >
      <!-- Background / Floor Boundary -->
      <rect
        :x="viewBoxPadding * scale + padding"
        :y="viewBoxPadding * scale + padding"
        :width="canvasWidth * scale"
        :height="canvasHeight * scale"
        fill="rgba(255, 255, 255, 0.03)"
        stroke="rgba(255, 255, 255, 0.15)"
        stroke-width="1"
        rx="2"
      />

      <!-- Walls -->
      <g v-for="wall in walls" :key="wall.id">
        <line
          v-if="constructionStore.getWallCoordinates(wall)"
          :x1="
            (constructionStore.getWallCoordinates(wall)!.x1 + viewBoxPadding) *
              scale +
            padding
          "
          :y1="
            (constructionStore.getWallCoordinates(wall)!.y1 + viewBoxPadding) *
              scale +
            padding
          "
          :x2="
            (constructionStore.getWallCoordinates(wall)!.x2 + viewBoxPadding) *
              scale +
            padding
          "
          :y2="
            (constructionStore.getWallCoordinates(wall)!.y2 + viewBoxPadding) *
              scale +
            padding
          "
          stroke="rgba(255, 255, 255, 0.4)"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </g>

      <!-- Fixtures (Tiny dots for context) -->
      <rect
        v-for="fixture in fixtures"
        :key="fixture.id"
        :x="(fixture.x + viewBoxPadding) * scale + padding"
        :y="(fixture.y + viewBoxPadding) * scale + padding"
        :width="fixture.width * scale"
        :height="fixture.height * scale"
        :transform="`rotate(${fixture.rotation || 0}, ${(fixture.x + viewBoxPadding) * scale + padding + (fixture.width * scale) / 2}, ${(fixture.y + viewBoxPadding) * scale + padding + (fixture.height * scale) / 2})`"
        fill="rgba(59, 130, 246, 0.3)"
        rx="0.5"
      />

      <!-- Viewport Indicator -->
      <rect
        :x="viewportRect.x"
        :y="viewportRect.y"
        :width="viewportRect.width"
        :height="viewportRect.height"
        fill="rgba(59, 130, 246, 0.1)"
        stroke="#3b82f6"
        stroke-width="2"
        pointer-events="none"
        rx="2"
      />
    </svg>

    <div class="minimap-label">Live Map</div>
  </div>
</template>

<style scoped>
.minimap-container {
  position: absolute;
  bottom: 24px;
  left: 88px; /* Beside left toolbar (64px + 24px gap) */
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  overflow: hidden;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
  z-index: 100;
  user-select: none;
  transition: transform 0.2s ease;
}

.minimap-container:hover {
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
}

.glass-morphism {
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.minimap-svg {
  width: 100%;
  height: 100%;
  cursor: crosshair;
  display: block;
}

.minimap-label {
  position: absolute;
  top: 8px;
  right: 10px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  pointer-events: none;
}
</style>
