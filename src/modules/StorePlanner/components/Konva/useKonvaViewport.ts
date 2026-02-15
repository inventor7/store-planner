import { ref, watch, type Ref } from "vue";
import type { KonvaEventObject } from "konva/lib/Node.js";
import type { Stage } from "konva/lib/Stage.js";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { storeToRefs } from "pinia";

export function useKonvaViewport(stageRef: Ref<any | null>) {
  const toolsStore = useEditorTools();
  const { zoom, panOffset } = storeToRefs(toolsStore);

  // Local state for smooth interactions (synced with store on end)
  const scale = ref(1);
  const position = ref({ x: 0, y: 0 });
  const isInteracting = ref(false);
  const isDraggingElement = ref(false); // New flag to block viewport updates during element drag

  // PERFORMANCE: Add epsilon for floating-point comparison to avoid micro-updates
  const EPSILON = 0.001;
  const floatEquals = (a: number, b: number) => Math.abs(a - b) < EPSILON;

  // Sync from store explicitly (e.g. on mount or external layout load)
  // We prefer local state driving the stage during interactions to avoid store reactivity overhead
  watch(
    () => [zoom.value, panOffset.value],
    (newVal, oldVal) => {
      const [newZoom, newPan] = newVal;
      const [oldZoom, oldPan] = oldVal || [1, { x: 0, y: 0 }];

      // PERFORMANCE: Use epsilon tolerance for float comparisons
      const zoomChanged = !floatEquals(newZoom as number, oldZoom as number);
      const panChanged =
        !floatEquals((newPan as any).x, (oldPan as any)?.x) ||
        !floatEquals((newPan as any).y, (oldPan as any)?.y);

      if (zoomChanged || panChanged) {
        // Block update if user is interacting with stage OR dragging an element (node/fixture)
        if (!isInteracting.value && !isDraggingElement.value) {
          scale.value = newZoom as number;
          position.value = { ...(newPan as { x: number; y: number }) };
        }
      }
    },
    { immediate: true },
  );

  // PERFORMANCE: Throttle store updates using RAF to prevent excessive reactivity
  let zoomRAF: number | null = null;
  let pendingZoom: number | null = null;
  let pendingPan: { x: number; y: number } | null = null;

  const syncZoomToStore = () => {
    if (pendingZoom !== null && pendingPan !== null) {
      toolsStore.setZoom(pendingZoom);
      toolsStore.setPanOffset(pendingPan);
      pendingZoom = null;
      pendingPan = null;
    }
    zoomRAF = null;
  };

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.value?.getStage() as Stage;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    // 10% zoom step
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * 1.1 : oldScale * 0.9;

    // Clamp zoom
    const clampedScale = Math.max(0.1, Math.min(10, newScale));

    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };

    // Update local state immediately for smooth visual feedback
    scale.value = clampedScale;
    position.value = newPos;

    // PERFORMANCE: Throttle store updates to max 60fps using RAF
    // This prevents excessive Pinia reactivity during rapid zoom
    pendingZoom = clampedScale;
    pendingPan = newPos;

    if (zoomRAF === null) {
      zoomRAF = requestAnimationFrame(syncZoomToStore);
    }
  };

  const handleDragStart = (e: KonvaEventObject<DragEvent>) => {
    // Only trigger for stage drag (not for fixture/wall dragging)
    if (e.target !== e.currentTarget) return;
    isInteracting.value = true;
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    // Only trigger for stage drag (not for fixture/wall dragging)
    if (e.target !== e.currentTarget) return;
    isInteracting.value = false;
    const stage = e.target as Stage;

    // Update local state to match final stage position
    position.value = { x: stage.x(), y: stage.y() };

    // Sync to store
    toolsStore.setPanOffset(position.value);
  };

  return {
    scale,
    position,
    isDraggingElement, // Export this so components can set it
    handleWheel,
    handleDragStart,
    handleDragEnd,
  };
}
