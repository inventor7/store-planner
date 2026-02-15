<script setup lang="ts">
import { ref, computed } from "vue";

interface Props {
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
}

const props = withDefaults(defineProps<Props>(), {
  min: -20,
  max: 20,
  step: 1,
});
const emit = defineEmits(["update:modelValue", "change"]);

const isDragging = ref(false);
const startY = ref(0);
const startValue = ref(0);
const pixelsPerUnit = 10;
const minVal = computed(() => props.min);
const maxVal = computed(() => props.max);

const handlePointerDown = (e: PointerEvent) => {
  isDragging.value = true;
  startY.value = e.clientY;
  startValue.value = props.modelValue;
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  document.body.style.cursor = "ns-resize";
};

const handlePointerMove = (e: PointerEvent) => {
  if (!isDragging.value) return;

  const deltaY = e.clientY - startY.value;
  const deltaValue = deltaY / pixelsPerUnit; // Reversed: drag down = increase

  let newValue = startValue.value + deltaValue;
  newValue = Math.max(minVal.value, Math.min(maxVal.value, newValue));

  const finalValue = Math.round(newValue / props.step) * props.step;

  if (finalValue !== props.modelValue) {
    emit("update:modelValue", finalValue);
    if ("vibrate" in navigator) navigator.vibrate(5);
  }
};

const handlePointerUp = () => {
  if (isDragging.value) {
    isDragging.value = false;
    document.body.style.cursor = "";
    emit("change", props.modelValue);
  }
};

const visibleTicks = computed(() => {
  const current = props.modelValue;
  const ticks = [];
  const tickStep = Math.max(1, Math.floor((maxVal.value - minVal.value) / 40));

  for (let i = minVal.value; i <= maxVal.value; i += tickStep) {
    const diff = i - current;
    const offset = -diff * pixelsPerUnit;

    if (Math.abs(offset) < 150) {
      ticks.push({
        value: i,
        offset,
      });
    }
  }
  return ticks;
});
</script>

<template>
  <div
    class="temp-ruler-container relative h-[192px] w-12 overflow-hidden select-none touch-none cursor-ns-resize bg-surface/10"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerUp"
  >
    <!-- Fade overlays -->
    <div
      class="absolute inset-0 z-10 pointer-events-none bg-gradient-to-b from-surface via-transparent to-surface"
    ></div>

    <!-- Center indicator line -->
    <div
      class="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex items-center justify-center z-20 pointer-events-none"
    >
      <div
        class="w-full h-[2px] bg-foreground/60 shadow-[0_0_10px_rgba(var(--foreground),0.3)]"
      ></div>
    </div>

    <!-- Ruler track -->
    <div class="absolute top-1/2 inset-x-0 h-0 flex justify-center">
      <div
        v-for="tick in visibleTicks"
        :key="tick.value"
        class="absolute w-full flex items-center justify-center transition-transform duration-75 ease-linear"
        :style="{ transform: `translateY(${tick.offset}px)` }"
      >
        <div
          class="rounded-full"
          :class="[
            tick.value % 5 === 0
              ? 'w-6 h-[2px] bg-foreground/60 shadow-[0_0_5px_rgba(var(--foreground),0.2)]'
              : 'w-3 h-[2px] bg-foreground/30',
          ]"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Scoped styles removed in favor of Tailwind classes */
</style>
