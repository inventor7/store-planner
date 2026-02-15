<template>
  <Sheet :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <SheetContent side="bottom" class="p-0 border-none bg-transparent shadow-none">
      <div
        class="bg-background rounded-t-xl flex flex-col shadow-2xl border-t"
        :style="{
          height,
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        }"
      >
        <!-- Drag handle -->
        <div
          class="flex justify-center items-center py-4 cursor-grab active:cursor-grabbing"
          style="touch-action: none"
          @pointerdown="onDragStart"
        >
          <div class="bg-muted-foreground/30 rounded-full w-10 h-1.5" />
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto px-4 pb-8">
          <slot />
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    height?: string;
    minDragDistance?: number;
  }>(),
  {
    height: "85vh",
    minDragDistance: 100,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const startY = ref(0);
const dragOffset = ref(0);
const isDragging = ref(false);

watch(
  () => props.modelValue,
  (val) => {
    if (val) dragOffset.value = 0;
  },
);

const onDragStart = (e: PointerEvent) => {
  startY.value = e.clientY;
  isDragging.value = true;

  const target = e.currentTarget as HTMLElement;
  target.setPointerCapture(e.pointerId);
  target.addEventListener("pointermove", onDragMove);
  target.addEventListener("pointerup", onDragEnd);
  target.addEventListener("pointercancel", onDragEnd);
};

const onDragMove = (e: PointerEvent) => {
  if (!isDragging.value) return;

  const delta = e.clientY - startY.value;
  if (delta > 0) dragOffset.value = delta;
};

const onDragEnd = (e: PointerEvent) => {
  isDragging.value = false;

  const target = e.currentTarget as HTMLElement;
  target.removeEventListener("pointermove", onDragMove);
  target.removeEventListener("pointerup", onDragEnd);
  target.removeEventListener("pointercancel", onDragEnd);
  target.releasePointerCapture(e.pointerId);

  if (dragOffset.value > props.minDragDistance) {
    emit("update:modelValue", false);
    setTimeout(() => (dragOffset.value = 0), 300);
  } else {
    dragOffset.value = 0;
  }
};
</script>
<style scoped>
.bg-background {
  background-color: #fff;
}
</style>
