<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from "vue";
import CreateFloorSheet from "../components/CreateFloorSheet.vue";

import KonvaCanvas from "../components/Konva/KonvaCanvas.vue";
import LeftToolbar from "../components/LeftToolbar.vue";
import SelectionToolbar from "../components/SelectionToolbar.vue";
import RightToolbar from "../components/RightToolbar.vue";
import ItemLibrary from "../components/ItemLibrary.vue";
import ProductEditor from "../components/ProductEditor.vue";
import FaceViewSimulator from "../components/FaceViewSimulator.vue";
import OrientationOverlay from "../components/OrientationOverlay.vue";
import MagicScanDialog from "../components/MagicScanDialog.vue";
import EditFloorSheet from "../components/EditFloorSheet.vue";
import SelectionPropertiesBar from "../components/SelectionPropertiesBar.vue";
import FloorTabs from "../components/FloorTabs.vue";
import SurveyDialog from "../components/SurveyDialog.vue";

import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { useEditorSelection } from "@/modules/StorePlanner/stores/useEditorSelection";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { useEditorProducts } from "@/modules/StorePlanner/stores/useEditorProducts";
import { useRouter, useRoute, onBeforeRouteLeave } from "vue-router";
import { useEditorFixtures } from "@/modules/StorePlanner/stores/useEditorFixtures";
import { useEditorConstruction } from "@/modules/StorePlanner/stores/useEditorConstruction";
import { storeToRefs } from "pinia";
import { useDocumentVisibility } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { setAccessToken } from "@/shared/services/http";
import { toast } from "vue-sonner";

const { t } = useI18n();

interface Props {
  partnerId?: string;
  visitId?: string;
}

const router = useRouter();
const route = useRoute();

const props = defineProps<Props>();

const schemaId = computed(() => route.query.schemaId as string | null);
const floorId = computed(() => route.query.floorId as string | null);
const accessToken = computed(
  () => (route.query["accessToken"] as string) || (route.query.accessToken as string) || null,
);
const isReadonly = computed(() => {
  const r = route.query.readonly || route.query.readOnly;
  return r === "true" || r === "1";
});

watch(
  accessToken,
  (token) => {
    if (token) {
      setAccessToken(token);
    }
  },
  { immediate: true },
);

// Initialize and destructure from individual stores for proper reactivity
const layoutStore = useEditorLayout();
const selectionStore = useEditorSelection();
const toolsStore = useEditorTools();
const fixtureStore = useEditorFixtures();
const constructionStore = useEditorConstruction();
// const surveysStore = useEditorSurveys();
const productsStore = useEditorProducts();

// Destructure from individual stores
const { currentLayout, savedLayouts, canUndo, canRedo } = storeToRefs(layoutStore);
const { selectedFixtureId, selectedWallId, selectedNodeId, selectedAreaId } =
  storeToRefs(selectionStore);
const {
  showFloorTabs,
  isMagicScanOpen,
  isViewModeOpen,
  showFloorSheet,
  showEditFloorSheet,
  // globalSnackbar,
} = storeToRefs(toolsStore);
// const { currentVisitId } = storeToRefs(surveysStore);
const { isProductEditorOpen } = storeToRefs(productsStore);

const isLoading = ref(true);

// const currentFloor = computed(() => {
//   if (!currentLayout.value) return null;
//   return currentLayout.value.floors.find((f) => f.id === currentLayout.value?.currentFloorId);
// });

const showExitConfirm = ref(false);
const resolveLeave = ref<((val: boolean) => void) | null>(null);
const isLibraryDragging = ref(false);

onBeforeRouteLeave(async (to, from, next) => {
  if (!currentLayout.value) {
    next();
    return;
  }

  // Only save to localStorage, not to API
  // The user will save manually via "Save All" button
  layoutStore.saveToLocalStorage();

  // Don't show confirmation if going back to floors view (root)
  if (to.path === "/" || to.name === "store-overview") {
    next();
    return;
  }

  showExitConfirm.value = true;
  const confirmed = await new Promise<boolean>((resolve) => {
    resolveLeave.value = resolve;
  });

  if (confirmed) {
    next();
  } else {
    next(false);
  }
});

const hasSelection = computed(
  () =>
    !!selectedFixtureId.value ||
    !!selectedWallId.value ||
    !!selectedNodeId.value ||
    !!selectedAreaId.value,
);

// Refs
const floorTabsRef = ref();

const handleExit = () => {
  router.back();
};

const handleCanvasClicked = () => {
  toolsStore.hideFloorTabs();
};

const handleKeyDown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    if (e.shiftKey) {
      if (canRedo.value) layoutStore.redo();
    } else {
      if (canUndo.value) layoutStore.undo();
    }
    e.preventDefault();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
    if (canRedo.value) layoutStore.redo();
    e.preventDefault();
  } else if (e.key === "Delete" || e.key === "Backspace") {
    // Check if we're not in an input field
    const activeElement = document.activeElement;
    const isInput =
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      (activeElement instanceof HTMLElement && activeElement.isContentEditable);

    if (!isInput && hasSelection.value) {
      if (selectedFixtureId.value) {
        fixtureStore.deleteFixture(selectedFixtureId.value);
      } else if (selectedWallId.value) {
        constructionStore.deleteWall(selectedWallId.value);
      } else if (selectedNodeId.value) {
        constructionStore.deleteNode(selectedNodeId.value);
      } else if (selectedAreaId.value) {
        constructionStore.deleteArea(selectedAreaId.value);
      }
      e.preventDefault();
    }
  }
};

const initializeEditor = async () => {
  isLoading.value = true;
  console.log("StoreEditor initializing", {
    partnerId: props.partnerId,
    schemaId: schemaId.value,
    floorId: floorId.value,
  });

  // Set readonly mode
  toolsStore.setReadonly(isReadonly.value);

  // If we have a schemaId from query params, use data already loaded in store
  if (schemaId.value) {
    // Data should already be loaded from StoreSetup, just switch to the floor
    if (currentLayout.value) {
      // Switch to specific floor if provided
      if (floorId.value) {
        const floor = currentLayout.value.floors.find((f) => f.id === floorId.value);
        if (floor) {
          layoutStore.switchFloor(floorId.value);
        } else {
          console.warn(`Floor ${floorId.value} not found, using current floor`);
        }
      }
    } else {
      // If layout is not in store (direct navigation), load from API
      try {
        await layoutStore.loadLayoutFromApi(schemaId.value);

        // Switch to specific floor if provided
        if (floorId.value && currentLayout.value) {
          const floor = currentLayout.value.floors.find((f) => f.id === floorId.value);
          if (floor) {
            layoutStore.switchFloor(floorId.value);
          }
        }
      } catch (error) {
        console.error("Failed to load schema:", error);
        toast.error("Failed to load floor plan", {
          description: "Please check your connection and try again",
        });
      }
    }
  } else if (props.partnerId) {
    // Fallback to old behavior for backward compatibility (Efficy app)
    await layoutStore.fetchPartnerLayouts(props.partnerId);

    if (!currentLayout.value) {
      const saved = savedLayouts.value.find((l) => l.partnerId === props.partnerId);
      if (saved) {
        console.log("Loading saved layout", saved.id);
        await layoutStore.loadLayout(saved.id);
      } else {
        console.log("No layout found for partner", props.partnerId);
      }
    }
  }

  isLoading.value = false;
};

const createDefaultLayout = async () => {
  if (!props.partnerId) return;
  isLoading.value = true;
  await layoutStore.createNewLayout("New Store", 1000, 800, props.partnerId);
  isLoading.value = false;

  // Auto-fit and center the new layout
  await nextTick();
  setTimeout(async () => {
    await toolsStore.resetView();
  }, 100);
};

onMounted(async () => {
  await initializeEditor();

  // Auto-fit and center the view after layout is loaded
  await nextTick();
  setTimeout(async () => {
    await toolsStore.resetView();
  }, 100);

  window.addEventListener("keydown", handleKeyDown);

  // Auto-save to localStorage (not API) when app goes to background
  // This preserves work without triggering API calls
  const visibility = useDocumentVisibility();
  watch(visibility, (current, previous) => {
    if (current === "hidden" && previous === "visible" && currentLayout.value) {
      console.log("[Background] Saving to localStorage...");
      layoutStore.saveToLocalStorage();
    }
  });
});
import { watch } from "vue";

// Refresh data when component is activated (e.g., when navigating back to the tab)
import { onActivated } from "vue";
onActivated(async () => {
  if (props.partnerId) {
    await layoutStore.fetchPartnerLayouts(props.partnerId);
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  // App.removeAllListeners();
});
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center h-full">
    <IMdiLoading class="animate-spin text-primary w-10 h-10" />
  </div>

  <div
    v-else-if="!currentLayout"
    class="no-layout-state h-screen flex flex-col items-center justify-center gap-4"
  >
    <IMdiFileAlertOutline class="w-16 h-16 text-muted-foreground/40" />
    <div class="text-2xl font-bold text-muted-foreground">
      {{ t("storePlanner.editor.noLayoutFound") }}
    </div>
    <Button
      @click="
        createDefaultLayout();
        selectionStore.clearSelection();
      "
      >{{ t("storePlanner.editor.createLayout") }}</Button
    >
  </div>

  <div v-else class="editor-root">
    <OrientationOverlay />

    <div class="side-toolbars-left">
      <Transition name="slide-left" mode="out-in">
        <LeftToolbar
          v-if="!hasSelection"
          :on-exit="handleExit"
          @toggle-floor-tabs="toolsStore.toggleFloorTabs()"
        />
        <SelectionToolbar v-else />
      </Transition>
    </div>

    <div class="editor-workspace">
      <FloorTabs ref="floorTabsRef" v-if="showFloorTabs" />
      <SelectionPropertiesBar />
      <div class="canvas-container">
        <!-- Toggle for Dev -->
        <!-- Konva Canvas (Default) -->
        <KonvaCanvas
          class="full-canvas"
          @edit-floor="showEditFloorSheet = true"
          @fixture-dimension-change="
            (data) => {
              // Update the fixture dimensions in the store
              fixtureStore.updateFixture(data.id, {
                width: data.width,
                height: data.height,
              });
            }
          "
          @canvas-clicked="handleCanvasClicked"
        />
        <!-- TopBar Removed -->

        <Transition name="fade">
          <div v-if="isViewModeOpen" class="view-mode-overlay">
            <FaceViewSimulator />
            <button
              @click="toolsStore.setViewModeOpen(false)"
              class="eye-close-btn"
              :title="t('storePlanner.editor.closeFaceView')"
            >
              <IMdiEyeOff class="w-4 h-4" />
            </button>
          </div>
        </Transition>
      </div>

      <RightToolbar :on-exit="handleExit" />
    </div>

    <ItemLibrary @drag-start="isLibraryDragging = true" @drag-end="isLibraryDragging = false" />
    <ProductEditor v-if="isProductEditorOpen" />
    <SurveyDialog />
    <Sheet v-model:open="showFloorSheet">
      <SheetContent side="bottom">
        <CreateFloorSheet @close="showFloorSheet = false" />
      </SheetContent>
    </Sheet>
    <Sheet v-model:open="showEditFloorSheet">
      <SheetContent side="bottom">
        <EditFloorSheet @close="showEditFloorSheet = false" />
      </SheetContent>
    </Sheet>
    <MagicScanDialog v-if="isMagicScanOpen" @close="isMagicScanOpen = false" />

    <!-- Route Exit Confirmation Dialog -->
    <Dialog v-model:open="showExitConfirm">
      <DialogContent class="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{{ t("storePlanner.editor.exitDialog.title") }}</DialogTitle>
          <DialogDescription>
            {{ t("storePlanner.editor.exitDialog.message") }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            @click="
              showExitConfirm = false;
              resolveLeave?.(false);
            "
          >
            {{ t("storePlanner.editor.exitDialog.stay") }}
          </Button>
          <Button
            @click="
              showExitConfirm = false;
              resolveLeave?.(true);
            "
          >
            {{ t("storePlanner.editor.exitDialog.exit") }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- v-snackbar removed, use Toast sonner via script if needed, or implement Toaster in App.vue -->
  </div>
</template>

<style scoped>
.editor-root {
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.05);
  position: relative;
  display: flex;
  touch-action: none;
}

.side-toolbars-left {
  position: relative;
  height: 100%;
  display: flex;
  flex-shrink: 0;
  z-index: 50;
  height: 100%;
}

.toolbar-stack {
  display: flex;
  height: 100%;
}

.editor-workspace {
  flex: 1;
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.canvas-container {
  flex: 1;
  position: relative;
  height: 100%;
  display: flex;
}

.full-canvas {
  flex: 1;
}

.text-muted-foreground {
  color: var(--muted-foreground) !important;
}

.view-mode-overlay {
  position: absolute;
  inset: 0;
  background: rgba(var(--v-theme-surface), 0.98);
  backdrop-filter: blur(12px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.eye-close-btn {
  position: absolute;
  bottom: 20px;
  left: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  border: 2px solid rgba(var(--v-theme-on-surface), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--v-theme-on-primary));
  cursor: pointer;
  transition: all 0.2s;
  z-index: 103;
  box-shadow: 0 8px 24px rgba(var(--v-theme-primary), 0.4);
}

.eye-close-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 12px 32px rgba(var(--v-theme-primary), 0.6);
}

.layout-dims {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  font-weight: 500;
}

/* Transitions */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 0.2s ease-out;
}
.slide-left-enter-from,
.slide-left-leave-to {
  transform: translateX(-100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

:deep(.dragging-active) .library-overlay {
  pointer-events: none !important;
  opacity: 0.6;
}
</style>
