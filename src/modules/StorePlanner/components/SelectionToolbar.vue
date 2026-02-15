<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useEditorSelection } from "@/modules/StorePlanner/stores/useEditorSelection";
import { useEditorFixtures } from "@/modules/StorePlanner/stores/useEditorFixtures";
import { useEditorConstruction } from "@/modules/StorePlanner/stores/useEditorConstruction";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { useEditorPlacements } from "@/modules/StorePlanner/stores/useEditorPlacements";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";

const { t } = useI18n();

const selectionStore = useEditorSelection();
const fixtureStore = useEditorFixtures();
const constructionStore = useEditorConstruction();
const layoutStore = useEditorLayout();
const placementsStore = useEditorPlacements();
const toolsStore = useEditorTools();

const {
  selectedFixtureId,
  selectedWallId,
  selectedNodeId,
  selectedAreaId,
  selectedWallForAttachment,
} = storeToRefs(selectionStore);
const { currentLayout } = storeToRefs(layoutStore);
const { isLibraryOpen, isDrawingWall, isViewModeOpen } = storeToRefs(toolsStore);

const hasFixtureSelection = computed(() => !!selectedFixtureId.value);

const hasWallSelection = computed(() => !!selectedWallId.value);

const hasNodeSelection = computed(() => !!selectedNodeId.value);

const selectedWall = computed(() =>
  currentLayout.value?.walls?.find((w) => w.id === selectedWallId.value),
);
const fixturePlacement = computed(() => {
  if (!selectedFixtureId.value || !currentLayout.value?.placements) {
    return null;
  }
  return currentLayout.value.placements.find((p) => p.fixtureId === selectedFixtureId.value);
});

// Check if the selected item is a door or window (fixture or wall segment)
const isDoorOrWindowSelected = computed(() => {
  // Check wall segment type
  if (selectedWall.value) {
    return selectedWall.value.type === "door" || selectedWall.value.type === "window";
  }
  // Check fixture template
  if (!selectedFixtureId.value || !currentLayout.value?.fixtures) {
    return false;
  }
  const selectedFixture = currentLayout.value.fixtures.find(
    (f) => f.id === selectedFixtureId.value,
  );
  if (!selectedFixture) return false;
  const template = fixtureStore.getTemplate(selectedFixture.templateId);
  return template?.isWallAttached === true;
});

const handleOpenFloorLibrary = () => {
  toolsStore.setLibraryCategory("floors");
  isLibraryOpen.value = true;
};

const handleDuplicate = () => {
  if (selectedFixtureId.value) {
    fixtureStore.duplicateFixture(selectedFixtureId.value);
  }
};

const handleTogglePlacement = () => {
  if (!selectedFixtureId.value) return;

  if (fixturePlacement.value) {
    placementsStore.deletePlacement(fixturePlacement.value.id);
  } else {
    placementsStore.addPlacement(selectedFixtureId.value);
  }
};

const handleMoveToFront = () => {
  if (selectedFixtureId.value) {
    fixtureStore.moveFixtureToFront(selectedFixtureId.value);
  }
};

const handleMoveToBack = () => {
  if (selectedFixtureId.value) {
    fixtureStore.moveFixtureToBack(selectedFixtureId.value);
  }
};

const handleFlipAreaHorizontal = () => {
  if (!selectedAreaId.value || !currentLayout.value) return;
  const area = currentLayout.value.areas.find((a) => a.id === selectedAreaId.value);
  if (!area) return;

  // Get area center
  const areaNodes = area.nodeIds
    .map((id) => constructionStore.getNodePosition(id))
    .filter((n) => n);
  if (areaNodes.length === 0) return;

  const centerX = areaNodes.reduce((sum, n) => sum + n!.x, 0) / areaNodes.length;

  // Flip nodes horizontally around center
  area.nodeIds.forEach((nodeId) => {
    const node = constructionStore.getNodePosition(nodeId);
    if (node) {
      const newX = centerX + (centerX - node.x);
      constructionStore.updateNode(nodeId, { x: newX }, false);
    }
  });

  layoutStore.commit();
};

const handleFlipAreaVertical = () => {
  if (!selectedAreaId.value || !currentLayout.value) return;
  const area = currentLayout.value.areas.find((a) => a.id === selectedAreaId.value);
  if (!area) return;

  // Get area center
  const areaNodes = area.nodeIds
    .map((id) => constructionStore.getNodePosition(id))
    .filter((n) => n);
  if (areaNodes.length === 0) return;

  const centerY = areaNodes.reduce((sum, n) => sum + n!.y, 0) / areaNodes.length;

  // Flip nodes vertically around center
  area.nodeIds.forEach((nodeId) => {
    const node = constructionStore.getNodePosition(nodeId);
    if (node) {
      const newY = centerY + (centerY - node.y);
      constructionStore.updateNode(nodeId, { y: newY }, false);
    }
  });

  layoutStore.commit();
};

const handleAddCorner = () => {
  if (toolsStore.pendingCornerPos) {
    constructionStore.confirmPendingCorner();
  } else {
    toolsStore.showSnackbar(t("storePlanner.editor.toolbar.moveMouseCorner"), "info");
  }
};

const handleDelete = () => {
  if (selectedFixtureId.value) {
    fixtureStore.deleteFixture(selectedFixtureId.value);
  } else if (selectedWallId.value) {
    constructionStore.deleteWall(selectedWallId.value);
  } else if (selectedNodeId.value) {
    constructionStore.deleteNode(selectedNodeId.value);
  } else if (selectedAreaId.value) {
    constructionStore.deleteArea(selectedAreaId.value);
  }
};

const handleOpenDoorWindowLibrary = () => {
  toolsStore.setLibraryCategory("structures");
  if (selectedWallId.value) {
    selectedWallForAttachment.value = selectedWallId.value;
  }
  isLibraryOpen.value = true;
};

const handleStartDrawingWall = () => {
  // Set the drawing wall mode and store the starting node ID
  toolsStore.startDrawingWall(selectedNodeId.value!);
};

const handleCancelDrawingWall = () => {
  // Cancel the drawing wall mode
  toolsStore.cancelDrawingWall();
};

const handleToggleViewMode = () => {
  toolsStore.setViewModeOpen(!isViewModeOpen.value);
};

// Merge areas
const mergeableAreas = computed(() => {
  if (!selectedAreaId.value) return [];
  return constructionStore.findMergeableAreas(selectedAreaId.value);
});

const canMerge = computed(() => mergeableAreas.value.length > 0);

const handleMergeArea = () => {
  if (!selectedAreaId.value || mergeableAreas.value.length === 0) return;
  // Merge with the first mergeable area found
  constructionStore.mergeAreas(selectedAreaId.value, mergeableAreas.value[0]!);
};

const handleDuplicateArea = () => {
  if (!selectedAreaId.value || !currentLayout.value) return;
  const area = currentLayout.value.areas.find((a) => a.id === selectedAreaId.value);
  if (!area) return;

  // Get all nodes for this area
  const areaNodes = area.nodeIds
    .map((id: string) => currentLayout.value!.nodes.find((n) => n.id === id))
    .filter(Boolean);

  if (areaNodes.length === 0) return;

  // Calculate offset (move right by 100px)
  const offsetX = 100;
  const offsetY = 100;

  // Create new nodes with offset
  const nodeIdMap = new Map<string, string>();
  areaNodes.forEach((node) => {
    const newNodeId = constructionStore.addNode(node!.x + offsetX, node!.y + offsetY);
    nodeIdMap.set(node!.id, newNodeId);
  });

  // Get walls for this area
  const areaWalls = currentLayout.value.walls.filter(
    (w) => area.nodeIds.includes(w.startNodeId) && area.nodeIds.includes(w.endNodeId),
  );

  // Create new walls using the new nodes
  areaWalls.forEach((wall) => {
    const newStartNodeId = nodeIdMap.get(wall.startNodeId);
    const newEndNodeId = nodeIdMap.get(wall.endNodeId);
    if (newStartNodeId && newEndNodeId) {
      constructionStore.addWall(newStartNodeId, newEndNodeId, wall.type);
    }
  });

  // Recalculate areas to detect the new area
  layoutStore.recalculateAreas();
  layoutStore.commit();

  // Try to select the new area
  const adjacentAreas = currentLayout.value.areas.filter((a) =>
    a.nodeIds.some((nodeId) => Array.from(nodeIdMap.values()).includes(nodeId)),
  );
  if (adjacentAreas.length > 0 && adjacentAreas[0]) {
    selectionStore.selectArea(adjacentAreas[0].id);
  }
};
</script>

<template>
  <aside v-if="toolsStore.editorMode === 'design'" class="selection-toolbar shadow-lg">
    <div class="toolbar-content ga-2">
      <!-- Back / Deselect -->
      <button
        @click="selectionStore.clearSelection()"
        class="tool-btn back-btn"
        :title="t('storePlanner.editor.toolbar.back')"
      >
        <IMdiChevronLeft class="w-6 h-6 text-primary" />
        <span class="btn-label font-extrabold text-primary">{{
          t("storePlanner.editor.toolbar.back")
        }}</span>
      </button>

      <div class="divider"></div>

      <!-- Delete (Always available if something is selected) - Moved to top -->
      <button
        @click="handleDelete"
        class="tool-btn text-destructive"
        :title="t('storePlanner.editor.toolbar.delete')"
      >
        <IMdiDelete class="w-5 h-5" />
        <span class="btn-label">{{ t("storePlanner.editor.toolbar.delete") }}</span>
      </button>

      <!-- Fixture Specific Tools -->
      <template v-if="hasFixtureSelection">
        <button
          @click="handleToggleViewMode"
          class="tool-btn"
          :class="{ 'text-primary bg-primary/10': isViewModeOpen }"
          :title="t('storePlanner.editor.toolbar.view')"
        >
          <IMdiEye v-if="isViewModeOpen" class="w-5 h-5" />
          <IMdiEyeOutline v-else class="w-5 h-5" />
          <span class="btn-label">{{ t("storePlanner.editor.toolbar.view") }}</span>
        </button>

        <button
          @click="handleDuplicate"
          class="tool-btn"
          :title="t('storePlanner.editor.toolbar.duplicate')"
        >
          <IMdiContentCopy class="w-5 h-5" />
          <span class="btn-label">{{ t("storePlanner.editor.toolbar.copy") }}</span>
        </button>

        <button
          @click="handleTogglePlacement"
          class="tool-btn"
          :class="{ 'text-green-600 bg-green-500/10': !!fixturePlacement }"
          :title="t('storePlanner.editor.toolbar.placement')"
        >
          <IMdiClipboardCheck v-if="fixturePlacement" class="w-5 h-5" />
          <IMdiClipboardOutline v-else class="w-5 h-5" />
          <span class="btn-label">{{ t("storePlanner.editor.toolbar.placement") }}</span>
        </button>

        <div class="mini-divider"></div>

        <button
          @click="handleMoveToFront"
          class="tool-btn"
          :title="t('storePlanner.editor.toolbar.front')"
        >
          <IMdiArrangeBringToFront class="w-5 h-5" />
          <span class="btn-label">{{ t("storePlanner.editor.toolbar.front") }}</span>
        </button>

        <button
          @click="handleMoveToBack"
          class="tool-btn"
          :title="t('storePlanner.editor.toolbar.back')"
        >
          <IMdiArrangeSendToBack class="w-5 h-5" />
          <span class="btn-label">{{ t("storePlanner.editor.toolbar.back") }}</span>
        </button>
      </template>

      <!-- Wall/Area Specific Tools -->
      <template v-if="hasWallSelection || selectedAreaId || hasNodeSelection">
        <div class="mini-divider"></div>

        <button
          v-if="hasWallSelection && !isDoorOrWindowSelected"
          @click="handleAddCorner"
          class="tool-btn"
          :class="{
            'text-primary bg-primary/10': !!toolsStore.pendingCornerPos,
          }"
          :title="t('storePlanner.editor.toolbar.corner')"
        >
          <IMdiVectorPointPlus class="w-5 h-5" />
          <span class="btn-label">{{ t("storePlanner.editor.toolbar.corner") }}</span>
        </button>

        <!-- Draw wall button when a node is selected -->
        <button
          v-if="hasNodeSelection && !isDrawingWall"
          @click="handleStartDrawingWall"
          class="tool-btn"
          :class="{ 'text-primary bg-primary/10': isDrawingWall }"
          :title="t('storePlanner.editor.toolbar.drawWall')"
        >
          <IMdiVectorLine class="w-5 h-5" />
          <span class="btn-label">{{ t("storePlanner.editor.toolbar.drawWall") }}</span>
        </button>

        <!-- Cancel drawing button when in drawing mode -->
        <button
          v-if="isDrawingWall"
          @click="handleCancelDrawingWall"
          class="tool-btn text-destructive"
          :title="t('storePlanner.editor.toolbar.cancelDrawing')"
        >
          <IMdiCancel class="w-5 h-5" />
          <span class="btn-label">{{ t("storePlanner.editor.toolbar.cancelDrawing") }}</span>
        </button>

        <!-- Door/Window button for wall attachments -->
        <button
          v-if="hasWallSelection && selectedWall?.type === 'wall'"
          @click="handleOpenDoorWindowLibrary"
          class="tool-btn"
          :title="t('storePlanner.editor.toolbar.doorWindow')"
        >
          <IMdiDoorOpen class="w-5 h-5" />
          <span class="btn-label">{{ t("storePlanner.editor.toolbar.doorWindow") }}</span>
        </button>

        <button
          v-if="selectedAreaId"
          @click="handleOpenFloorLibrary"
          class="tool-btn"
          :title="t('storePlanner.editor.toolbar.floor')"
        >
          <IMdiTextureBox class="w-5 h-5" />
          <span class="btn-label">{{ t("storePlanner.editor.toolbar.floor") }}</span>
        </button>

        <!-- Merge Areas Button -->
        <button
          v-if="selectedAreaId"
          @click="handleMergeArea"
          class="tool-btn"
          :class="canMerge ? 'text-green-600' : ''"
          :disabled="!canMerge"
          :title="
            canMerge
              ? t('storePlanner.editor.toolbar.merge')
              : t('storePlanner.editor.toolbar.noAdjacentAreas')
          "
        >
          <IMdiVectorUnion class="w-5 h-5" />
          <span class="btn-label">{{ t("storePlanner.editor.toolbar.merge") }}</span>
        </button>

        <!-- Duplicate Area Button -->
        <button
          v-if="selectedAreaId"
          @click="handleDuplicateArea"
          class="tool-btn"
          :title="t('storePlanner.editor.toolbar.duplicate')"
        >
          <IMdiContentCopy class="w-5 h-5" />
          <span class="btn-label">{{ t("storePlanner.editor.toolbar.duplicate") }}</span>
        </button>

        <!-- Area Flip Buttons -->
        <template v-if="selectedAreaId">
          <div class="mini-divider"></div>

          <button
            @click="handleFlipAreaHorizontal"
            class="tool-btn"
            :title="t('storePlanner.editor.toolbar.flipH')"
          >
            <IMdiFlipHorizontal class="w-5 h-5" />
            <span class="btn-label">{{ t("storePlanner.editor.toolbar.flipH") }}</span>
          </button>

          <button
            @click="handleFlipAreaVertical"
            class="tool-btn"
            :title="t('storePlanner.editor.toolbar.flipV')"
          >
            <IMdiFlipVertical class="w-5 h-5" />
            <span class="btn-label">{{ t("storePlanner.editor.toolbar.flipV") }}</span>
          </button>
        </template>
      </template>
    </div>
  </aside>
</template>

<style scoped>
@reference "@/assets/index.css";
.selection-toolbar {
  @apply fixed top-0 left-0 bottom-0 h-full w-16 bg-background/95 backdrop-blur-xl border-r border-border p-1 pt-[max(var(--safe-area-inset-top),8px)] pointer-events-auto z-50 flex flex-col overflow-y-auto scrollbar-hide;
}

.toolbar-content {
  @apply flex flex-col items-center gap-2 pt-1;
}

.tool-btn {
  @apply flex flex-col items-center justify-center gap-1 w-12 h-12 rounded-xl text-muted-foreground transition-all cursor-pointer hover:bg-muted hover:text-foreground hover:-translate-y-px disabled:opacity-30 disabled:cursor-not-allowed;
}

.divider {
  @apply w-full border-t border-border mx-0.5;
}

.mini-divider {
  @apply w-6 h-px bg-border my-1;
}

.btn-label {
  @apply text-[8px] font-bold uppercase tracking-wider;
}
</style>
