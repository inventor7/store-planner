<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useEditorSelection } from "@/modules/StorePlanner/stores/useEditorSelection";
import { useEditorProducts } from "@/modules/StorePlanner/stores/useEditorProducts";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { useEditorFixtures } from "@/modules/StorePlanner/stores/useEditorFixtures";
import { useEditorConstruction } from "@/modules/StorePlanner/stores/useEditorConstruction";
import {
  ITEM_COLLECTIONS,
  getCollectionById,
} from "@/modules/StorePlanner/data/fixtureCollections";
import type { PlacedFixture } from "@/modules/StorePlanner/types/editor";
import { useSurveyCamera } from "@/modules/StorePlanner/composables/useSurveyCamera";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const editorSelectionStore = useEditorSelection();
const editorProductStore = useEditorProducts();
const editorLayoutStore = useEditorLayout();
const editorToolsStore = useEditorTools();
const editorFixturesStore = useEditorFixtures();
const editorConstructionStore = useEditorConstruction();

const { selectedWallId, selectedFixtureId, selectedAreaId, selectedNodeId } =
  storeToRefs(editorSelectionStore);
const { selectedShelfLevelId } = storeToRefs(editorProductStore);
const { currentLayout } = storeToRefs(editorLayoutStore);
const { isViewModeOpen } = storeToRefs(editorToolsStore);

// Local UI state
const showMore = ref(false);
const isEditingName = ref(false);
const editingName = ref("");

const selectedFixture = computed(() =>
  currentLayout.value?.fixtures?.find((f) => f.id === selectedFixtureId.value),
);
const selectedWall = computed(() =>
  currentLayout.value?.walls?.find((w) => w.id === selectedWallId.value),
);
const selectedNode = computed(() =>
  currentLayout.value?.nodes?.find((n) => n.id === selectedNodeId.value),
);
const template = computed(() =>
  selectedFixture.value ? editorFixturesStore.getTemplate(selectedFixture.value.templateId) : null,
);

const displayName = computed(() => {
  if (selectedFixture.value)
    return (
      selectedFixture.value.label ||
      template.value?.name ||
      t("storePlanner.editor.properties.fixture")
    );
  if (selectedArea.value) return areaName.value;
  if (effectiveWall.value) {
    if (effectiveWall.value.type === "door") return t("storePlanner.editor.properties.door");
    if (effectiveWall.value.type === "window") return t("storePlanner.editor.properties.window");
    return t("storePlanner.editor.properties.wall");
  }
  if (selectedNode.value) return t("storePlanner.editor.properties.wallNode");
  return "";
});

const startEditingName = () => {
  editingName.value = displayName.value;
  isEditingName.value = true;
};

const saveName = () => {
  if (!isEditingName.value) return;
  const newName = editingName.value.trim();
  if (selectedFixture.value) {
    handleUpdate(selectedFixture.value.id, { label: newName });
  } else if (selectedArea.value) {
    areaName.value = newName;
  }
  isEditingName.value = false;
};

const surveyPhotos = computed(() => selectedFixture.value?.surveyPhotos || []);
const headerImage = computed(() =>
  surveyPhotos.value.length > 0 ? surveyPhotos.value[0]?.url : null,
);

const { takePhoto, savePhoto } = useSurveyCamera();
const isGalleryOpen = ref(false);
const viewingPhotoIndex = ref(0);

const viewingPhotoUrl = computed(() => surveyPhotos.value[viewingPhotoIndex.value]?.url || null);

const openGallery = (index = 0) => {
  if (surveyPhotos.value.length === 0) return;
  viewingPhotoIndex.value = index;
  isGalleryOpen.value = true;
};

const closeGallery = () => {
  isGalleryOpen.value = false;
};

const handleHeaderClick = async () => {
  if (!selectedFixture.value) return;

  if (headerImage.value) {
    openGallery(0);
  } else {
    await handleTakePhoto();
  }
};

const handleTakePhoto = async () => {
  if (!selectedFixture.value) return;

  const result = await takePhoto();
  if (result) {
    try {
      const savedPath = await savePhoto(result.path || result.webPath || "");
      const uiUrl = savedPath;

      editorFixturesStore.addSurveyPhoto(selectedFixture.value.id, {
        id: Math.random().toString(),
        url: uiUrl,
        timestamp: new Date().toISOString(),
      });

      if (surveyPhotos.value.length > 0) {
        openGallery(surveyPhotos.value.length - 1);
      }
    } catch (e) {
      console.error("Failed to save and display photo", e);
    }
  }
};

const nextPhoto = () => {
  viewingPhotoIndex.value = (viewingPhotoIndex.value + 1) % surveyPhotos.value.length;
};

const prevPhoto = () => {
  viewingPhotoIndex.value =
    (viewingPhotoIndex.value - 1 + surveyPhotos.value.length) % surveyPhotos.value.length;
};

const wallLength = computed({
  get: () => {
    if (!selectedWall.value) return 0;
    const { startNodeId, endNodeId } = selectedWall.value;
    const startNode = currentLayout.value?.nodes.find((n) => n.id === startNodeId);
    const endNode = currentLayout.value?.nodes.find((n) => n.id === endNodeId);
    if (!startNode || !endNode) return 0;
    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    return parseFloat((Math.sqrt(dx * dx + dy * dy) / 100).toFixed(2));
  },
  set: (newLengthM: number) => {
    if (!selectedWall.value || !newLengthM || newLengthM <= 0) return;
    const newLength = newLengthM * 100;
    const { startNodeId, endNodeId } = selectedWall.value;
    const startNode = currentLayout.value?.nodes.find((n) => n.id === startNodeId);
    const endNode = currentLayout.value?.nodes.find((n) => n.id === endNodeId);
    if (!startNode || !endNode) return;

    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const currentLength = Math.sqrt(dx * dx + dy * dy);

    if (currentLength === 0) return;

    const scalar = newLength / currentLength;
    const newDx = dx * scalar;
    const newDy = dy * scalar;

    editorConstructionStore.updateNode(endNodeId, {
      x: startNode.x + newDx,
      y: startNode.y + newDy,
    });
  },
});

// Door/Window width - derived from node distance like wallLength
const doorWindowWidth = computed({
  get: () => {
    if (!effectiveWall.value) return 1.0;
    const { startNodeId, endNodeId } = effectiveWall.value;
    const startNode = currentLayout.value?.nodes.find((n) => n.id === startNodeId);
    const endNode = currentLayout.value?.nodes.find((n) => n.id === endNodeId);
    if (!startNode || !endNode)
      return parseFloat(((effectiveWall.value.width || 100) / 100).toFixed(2));

    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    return parseFloat((Math.sqrt(dx * dx + dy * dy) / 100).toFixed(2));
  },
  set: (newWidthM: number) => {
    if (!effectiveWall.value || !newWidthM || newWidthM <= 0) return;
    const newWidth = newWidthM * 100;
    const { startNodeId, endNodeId } = effectiveWall.value;
    const startNode = currentLayout.value?.nodes.find((n) => n.id === startNodeId);
    const endNode = currentLayout.value?.nodes.find((n) => n.id === endNodeId);
    if (!startNode || !endNode) return;

    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const currentLength = Math.sqrt(dx * dx + dy * dy);

    if (currentLength === 0) return;

    const scalar = newWidth / currentLength;
    const newDx = dx * scalar;
    const newDy = dy * scalar;

    editorConstructionStore.updateNode(endNodeId, {
      x: startNode.x + newDx,
      y: startNode.y + newDy,
    });

    // Also update the width property for metadata
    editorConstructionStore.updateWall(effectiveWall.value.id, {
      width: newWidth,
    });
  },
});

// Door/Window height - same pattern as fixtures
const doorWindowHeight = computed({
  get: () => {
    if (!effectiveWall.value) return 0.2;
    const wall = currentLayout.value?.walls.find((w) => w.id === effectiveWall.value?.id);
    return parseFloat(((wall?.height || 20) / 100).toFixed(2));
  },
  set: (newHeightM: number) => {
    if (!effectiveWall.value) return;
    editorConstructionStore.updateWall(effectiveWall.value.id, {
      height: Math.max(5, newHeightM * 100),
    });
  },
});

const selectedShelfLevel = computed(() => {
  if (!selectedFixture.value?.contents?.levels || !selectedShelfLevelId.value) return null;
  return selectedFixture.value.contents.levels.find((l) => l.id === selectedShelfLevelId.value);
});

const handleShelfHeightUpdate = (val: number) => {
  if (!selectedFixture.value || !selectedShelfLevelId.value || !selectedFixture.value.contents)
    return;

  const levels = [...selectedFixture.value.contents.levels].sort((a, b) => a.height - b.height);
  const currentIndex = levels.findIndex((l) => l.id === selectedShelfLevelId.value);
  if (currentIndex === -1) return;

  const prevHeight = currentIndex > 0 ? levels[currentIndex - 1]?.height || 0 : 0;
  const nextHeight =
    currentIndex < levels.length - 1
      ? levels?.[currentIndex + 1]?.height || 0
      : selectedFixture.value.height3D || 200;

  const minSpacing = 10;
  const thickness = 2;

  const minAllowed = prevHeight + minSpacing + thickness;
  const maxAllowed = nextHeight - minSpacing - thickness;

  const newHeight = Math.max(minAllowed, Math.min(maxAllowed, val));

  const newLevels = levels.map((l) => {
    if (l.id === selectedShelfLevelId.value) return { ...l, height: newHeight };
    return l;
  });

  editorProductStore.updateFixtureContents(selectedFixture.value.id, {
    levels: newLevels,
  });
};

const handleShelfRowsChange = (delta: number) => {
  if (!selectedFixture.value?.contents || !selectedFixtureId.value) return;

  const currentLevels = [...selectedFixture.value.contents.levels].sort(
    (a, b) => (a.height || 0) - (b.height || 0),
  );
  const totalHeight = selectedFixture.value.height3D || 200;
  const currentCount = currentLevels.length;
  const newCount = Math.max(1, Math.min(10, currentCount + delta));

  if (newCount === currentCount) return;

  let newLevels = [];

  if (newCount > currentCount) {
    // Add levels
    newLevels = [...currentLevels];
    for (let i = 0; i < newCount - currentCount; i++) {
      newLevels.push({
        id: Math.random().toString(36).substr(2, 9),
        slots: [
          {
            id: Math.random().toString(36).substr(2, 9),
            productId: null,
            facings: 1,
            priceLabel: false,
          },
        ],
        height: 0,
      });
    }
  } else {
    // Remove levels
    newLevels = currentLevels.slice(0, newCount);
  }

  // Recalculate heights
  const spacing = totalHeight / (newCount + 1);
  newLevels = newLevels.map((l, index) => ({
    ...l,
    height: Math.round((index + 1) * spacing),
  }));

  editorProductStore.updateFixtureContents(selectedFixture.value.id, {
    levels: newLevels,
  });
};

const fixtureWidth = computed({
  get: () => parseFloat(((selectedFixture.value?.width || 0) / 100).toFixed(2)),
  set: (val: number) => handleUpdate(selectedFixture.value?.id, { width: val * 100 }),
});

const fixtureDepth = computed({
  get: () => parseFloat(((selectedFixture.value?.height || 0) / 100).toFixed(2)),
  set: (val: number) => handleUpdate(selectedFixture.value?.id, { height: val * 100 }),
});

const fixtureHeight = computed({
  get: () => {
    if (selectedShelfLevelId.value) {
      return parseFloat(((selectedShelfLevel.value?.height || 0) / 100).toFixed(2));
    }
    return parseFloat(((selectedFixture.value?.height3D || 0) / 100).toFixed(2));
  },
  set: (val: number) => {
    if (selectedShelfLevelId.value) {
      handleShelfHeightUpdate(val * 100);
    } else {
      handleUpdate(selectedFixture.value?.id, { height3D: val * 100 });
    }
  },
});

const wallHeight = computed({
  get: () => parseFloat(((effectiveWall.value?.height || 0) / 100).toFixed(2)),
  set: (val: number) => {
    if (!currentLayout.value) return;
    // Apply height to ALL walls in the layout
    const newHeight = val * 100;
    currentLayout.value.walls.forEach((wall) => {
      editorConstructionStore.updateWall(wall.id, { height: newHeight }, false);
    });
    editorLayoutStore.commit();
  },
});

const handleUpdate = (id: string | undefined, updates: Partial<PlacedFixture>) => {
  if (!id) return;
  editorFixturesStore.updateFixture(id, updates);
};

const selectedNodeWall = computed(() => {
  if (!selectedNodeId.value || !currentLayout.value?.walls) return null;

  return currentLayout.value.walls.find(
    (w) =>
      (w.type === "door" || w.type === "window") &&
      (w.startNodeId === selectedNodeId.value || w.endNodeId === selectedNodeId.value),
  );
});

const selectedArea = computed(() =>
  currentLayout.value?.areas?.find((a) => a.id === selectedAreaId.value),
);

const hasSelection = computed(
  () =>
    !!selectedFixture.value ||
    !!selectedWall.value ||
    !!selectedNodeWall.value ||
    !!selectedArea.value,
);

// Use selected wall or the wall connected to selected node
const effectiveWall = computed(() => selectedWall.value || selectedNodeWall.value);

const fixturePlacement = computed(() => {
  if (!selectedFixtureId.value || !currentLayout.value?.placements) {
    return null;
  }
  return currentLayout.value.placements.find((p) => p.fixtureId === selectedFixtureId.value);
});

// Area properties
const areaNumber = computed(() => {
  if (!selectedArea.value || !currentLayout.value) return 1;
  const index = currentLayout.value.areas.findIndex((a) => a.id === selectedAreaId.value);
  return index + 1;
});

const areaName = computed({
  get: () =>
    selectedArea.value?.name || t("storePlanner.library.categories.areas") + ` ${areaNumber.value}`,
  set: (val: string) => {
    if (selectedAreaId.value) {
      editorLayoutStore.updateArea(selectedAreaId.value, { name: val });
    }
  },
});

const areaSurface = computed(() => {
  if (!selectedAreaId.value) return 0;
  return editorConstructionStore.calculateAreaSurface(selectedAreaId.value);
});

const handleToggleAreaDragLock = () => {
  if (selectedAreaId.value) {
    editorConstructionStore.toggleAreaDragLock(selectedAreaId.value);
  }
};

const handleToggleAreaSizeLock = () => {
  if (selectedAreaId.value) {
    editorConstructionStore.toggleAreaSizeLock(selectedAreaId.value);
  }
};

// Watch for selection change to reset UI state
watch([selectedFixtureId, selectedWallId, selectedNodeId, selectedAreaId], () => {
  isEditingName.value = false;
  showMore.value = false;
});

// Watch for fixture dimension changes to update the UI in real-time
watch(
  () => currentLayout.value?.fixtures,
  (fixtures) => {
    if (selectedFixtureId.value && fixtures) {
      const updatedFixture = fixtures.find((f) => f.id === selectedFixtureId.value);
      if (updatedFixture) {
        // The fixture dimensions have been updated, so the UI will automatically reflect the changes
      }
    }
  },
  { deep: true },
);
</script>

<template>
  <Transition name="slide-properties">
    <div
      v-if="hasSelection && (editorToolsStore.editorMode === 'design' || isViewModeOpen)"
      class="selection-properties-bar shadow-xl"
      :class="{ 'in-view-mode': isViewModeOpen }"
    >
      <div class="properties-container">
        <!-- Left: Summary & Photo -->
        <div class="item-summary px-3">
          <div
            class="icon-wrapper clickable"
            :class="{
              'border border-lg border-success': fixturePlacement,
              'has-image': !!headerImage,
            }"
            @click.stop="handleHeaderClick"
          >
            <img
              v-if="selectedFixture && headerImage"
              :src="headerImage"
              class="header-thumb-img"
            />
            <IMdiCamera v-else-if="selectedFixture" />
            <IMdiDoor v-else-if="effectiveWall?.type === 'door'" />
            <IMdiWindowClosedVariant v-else-if="effectiveWall?.type === 'window'" />
            <IMdiWall v-else-if="effectiveWall" />
            <IMdiRuler v-else />
          </div>
          <div class="flex flex-column ml-2 grow">
            <div
              v-if="!isEditingName"
              class="name-display"
              :class="{ clickable: selectedFixture || selectedArea }"
              @click="selectedFixture || selectedArea ? startEditingName() : null"
            >
              <h3 class="header-title">{{ displayName }}</h3>
              <IMdiPencil v-if="selectedFixture || selectedArea" class="edit-icon size-2.5" />
            </div>
            <Input
              v-else
              v-model="editingName"
              @blur="saveName"
              @keyup.enter="saveName"
              auto-focus
              class="name-input border-none h-7 p-0 shadow-none focus-visible:ring-0 font-extrabold text-sm bg-transparent"
            />
          </div>
        </div>

        <!-- Center: Interaction Props -->
        <div class="interaction-props flex flex-row justify-between align-center px-2">
          <div v-if="selectedFixture" class="flex items-center gap-4">
            <div class="flex gap-2">
              <div class="mini-input">
                <input
                  type="number"
                  v-model.number="fixtureWidth"
                  @blur="editorLayoutStore.commit()"
                  min="0.1"
                  step="0.01"
                />
                <span class="pl-4">{{ t("storePlanner.editor.properties.width") }}</span>
              </div>
              <div v-if="!template?.isWallAttached" class="mini-input">
                <input
                  type="number"
                  v-model.number="fixtureDepth"
                  @blur="editorLayoutStore.commit()"
                  min="0.1"
                  step="0.01"
                />
                <span>{{ t("storePlanner.editor.properties.depth") }}</span>
              </div>
              <div v-if="template?.isWallAttached" class="mini-input">
                <input
                  type="number"
                  :value="fixtureDepth"
                  readonly
                  :title="
                    t('storePlanner.editor.properties.wall') +
                    ' ' +
                    t('storePlanner.editor.properties.depth') +
                    ': ' +
                    fixtureDepth +
                    'm'
                  "
                />
                <span>D*</span>
              </div>
              <div class="mini-input">
                <input
                  type="number"
                  v-model.number="fixtureHeight"
                  @blur="editorLayoutStore.commit()"
                  min="0.05"
                  step="0.01"
                />
                <span>H (m)</span>
              </div>
            </div>

            <template v-if="selectedFixture?.contents">
              <div class="flex align-center gap-2">
                <button
                  class="shelf-btn-mini"
                  @click="handleShelfRowsChange(-1)"
                  :disabled="selectedFixture.contents.levels.length <= 1"
                >
                  <IMdiMinus class="size-3" />
                </button>
                <div class="shelf-label-stack">
                  <span class="shelf-count">{{ selectedFixture.contents.levels.length }}</span>
                  <span class="shelf-label-small">{{
                    t("storePlanner.editor.properties.rows")
                  }}</span>
                </div>
                <button
                  class="shelf-btn-mini"
                  @click="handleShelfRowsChange(1)"
                  :disabled="selectedFixture.contents.levels.length >= 10"
                >
                  <IMdiPlus class="size-3" />
                </button>
              </div>
            </template>

            <!-- Temperature Control for Fridges -->
            <div v-if="template?.category === 'fridges'" class="flex align-center gap-2">
              <div class="mini-input">
                <input
                  type="number"
                  :value="selectedFixture.temperature ?? 4"
                  @input="
                    (e) =>
                      handleUpdate(selectedFixture!.id, {
                        temperature: parseFloat((e.target as HTMLInputElement).value),
                      })
                  "
                  @blur="editorLayoutStore.commit()"
                  step="0.5"
                />
                <span>°C</span>
              </div>
            </div>
          </div>

          <div v-if="effectiveWall" class="flex align-center gap-4">
            <!-- Door Controls: Swing + Flipped -->
            <div v-if="effectiveWall.type === 'door'" class="flex align-center gap-2">
              <Select
                :model-value="effectiveWall.doorSwing || 'left'"
                @update:model-value="
                  (val) => {
                    editorConstructionStore.updateWall(effectiveWall!.id, {
                      doorSwing: val as 'left' | 'right' | 'sliding',
                    });
                    editorLayoutStore.commit();
                  }
                "
              >
                <SelectTrigger
                  class="w-[110px] h-8 border-none shadow-none focus:ring-0 p-0 text-xs font-bold"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">
                    {{ t("storePlanner.editor.properties.doorSwing.left") }}
                  </SelectItem>
                  <SelectItem value="right">
                    {{ t("storePlanner.editor.properties.doorSwing.right") }}
                  </SelectItem>
                  <SelectItem value="sliding">
                    {{ t("storePlanner.editor.properties.doorSwing.sliding") }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Switch
                :checked="effectiveWall.flipped || false"
                @update:checked="
                  (val: boolean) => {
                    editorConstructionStore.updateWall(effectiveWall!.id, {
                      flipped: !!val,
                    });
                    editorLayoutStore.commit();
                  }
                "
              />
            </div>

            <div v-if="effectiveWall.type === 'wall'" class="flex gap-2">
              <div class="mini-input">
                <input
                  type="number"
                  v-model.number="wallLength"
                  @blur="editorLayoutStore.commit()"
                  min="0.1"
                  step="0.01"
                />
                <span>W (m)</span>
              </div>
              <div class="mini-input">
                <input
                  type="number"
                  v-model.number="wallHeight"
                  @blur="editorLayoutStore.commit()"
                  min="0.1"
                  step="0.01"
                />
                <span>{{ t("storePlanner.editor.properties.height") }}</span>
              </div>
            </div>

            <div
              v-if="effectiveWall.type === 'door' || effectiveWall.type === 'window'"
              class="flex gap-2"
            >
              <div class="mini-input">
                <input
                  type="number"
                  v-model.number="doorWindowWidth"
                  @blur="editorLayoutStore.commit()"
                  min="0.1"
                  step="0.01"
                />
                <span>W (m)</span>
              </div>
              <div class="mini-input">
                <input
                  type="number"
                  v-model.number="doorWindowHeight"
                  @blur="editorLayoutStore.commit()"
                  min="0.05"
                  step="0.01"
                />
                <span>H (m)</span>
              </div>
            </div>
          </div>

          <!-- Area Properties -->
          <div v-if="selectedArea" class="flex align-center gap-4">
            <div class="flex gap-2">
              <div class="mini-input area-surface">
                <input
                  type="text"
                  :value="areaSurface.toFixed(2)"
                  readonly
                  :title="t('storePlanner.setup.surfaceArea')"
                />
                <span>m²</span>
              </div>
            </div>

            <!-- Lock Buttons -->
            <div class="flex align-center gap-2">
              <button
                @click="handleToggleAreaDragLock"
                class="lock-btn"
                :class="{ 'lock-active': selectedArea.lockedDimension }"
                :title="t('storePlanner.editor.properties.dragLock')"
              >
                <IMdiCursorMove class="size-3.5" />
                <IMdiLock v-if="selectedArea.lockedDimension" class="lock-icon size-2.5" />
              </button>
              <button
                @click="handleToggleAreaSizeLock"
                class="lock-btn"
                :class="{ 'lock-active': selectedArea.lockedSize }"
                :title="t('storePlanner.editor.properties.sizeLock')"
              >
                <IMdiResize class="size-3.5" />
                <IMdiLock v-if="selectedArea.lockedSize" class="lock-icon size-2.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Right: More Trigger -->
        <div class="more-actions grow flex justify-end px-3">
          <button
            v-if="selectedFixture"
            @click="showMore = !showMore"
            class="more-toolbar-btn"
            :class="{ active: showMore }"
            title="More Options"
          >
            <IMdiChevronUp v-if="showMore" class="size-5" />
            <IMdiChevronDown v-else class="size-5" />
          </button>
        </div>
      </div>

      <!-- Expandable Detail Pane -->
      <Transition name="expand-details">
        <div v-if="showMore" class="detail-pane flex-column pa-3">
          <div class="pane-content flex flex-column gap-2">
            <div v-if="selectedFixture" class="flex flex-column gap-2 grow">
              <div class="field-item">
                <label class="pane-label">Description</label>
                <Textarea
                  v-model="selectedFixture.description"
                  @update:model-value="
                    (val) =>
                      handleUpdate(selectedFixture!.id, {
                        description: val.toString() || '',
                      })
                  "
                  placeholder="Add notes..."
                  class="description-area min-h-[60px] text-xs"
                />
              </div>
              <div class="field-item">
                <label class="pane-label">Collection</label>
                <Select
                  :model-value="selectedFixture.collectionId"
                  @update:model-value="
                    (val) => {
                      const collection = getCollectionById(val as string);
                      handleUpdate(selectedFixture!.id, {
                        collectionId: (val as string) || undefined,
                        customColor: collection?.color,
                      });
                      editorLayoutStore.commit();
                    }
                  "
                  class="collection-select"
                >
                  <SelectTrigger class="w-full h-8 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="c in ITEM_COLLECTIONS" :key="c.id" :value="c.id">
                      <div class="flex align-center gap-2">
                        <div
                          class="collection-color-dot"
                          :style="{ backgroundColor: c.color }"
                        ></div>
                        <span>{{ c.name }}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div class="pane-actions flex gap-2 mt-2">
              <Button
                variant="default"
                size="sm"
                class="grow"
                @click="editorFixturesStore.saveCustomTemplate(selectedFixture!, displayName)"
              >
                <IMdiContentSave class="mr-2 h-4 w-4" />
                Save as Template
              </Button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>

  <!-- Photo Gallery Teleport -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isGalleryOpen" class="photo-modal">
        <button @click="closeGallery" class="close-modal-btn">
          <IMdiClose class="size-5" />
        </button>
        <div class="modal-content" @click.stop>
          <div class="photo-container">
            <img :src="viewingPhotoUrl ?? ''" class="full-photo" />
            <button v-if="surveyPhotos.length > 1" @click.stop="prevPhoto" class="nav-btn prev">
              <IMdiChevronLeft class="size-8" />
            </button>
            <button v-if="surveyPhotos.length > 1" @click.stop="nextPhoto" class="nav-btn next">
              <IMdiChevronRight class="size-8" />
            </button>
            <button @click="handleTakePhoto" class="gallery-camera-btn">
              <IMdiCamera class="size-6" />
            </button>
          </div>
          <div class="photo-info" v-if="selectedFixture">
            <span class="photo-count">{{ viewingPhotoIndex + 1 }} / {{ surveyPhotos.length }}</span>
            <span class="photo-date">{{
              new Date(surveyPhotos[viewingPhotoIndex]?.timestamp || 0).toLocaleString()
            }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.selection-properties-bar {
  position: absolute;
  top: 0;
  left: 64px;
  width: calc(100% - 128px);
  margin-right: 0;
  background: color-mix(in srgb, var(--background), transparent 5%);
  backdrop-filter: blur(24px);
  border-bottom: 1px solid color-mix(in srgb, var(--foreground), transparent 92%);
  border-right: 1px solid color-mix(in srgb, var(--foreground), transparent 90%);
  z-index: 100;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding-top: max(var(--safe-area-inset-top), 4px);
}

.selection-properties-bar.in-view-mode {
  position: fixed;
  left: 0;
  width: 100%;
  z-index: 102;
  border-radius: 0;
  border-left: none;
}

.properties-container {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 4px;
}

.item-summary {
  display: flex;
  align-items: center;
  min-width: 180px;
}

.name-display {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 140px;
}

.name-display:hover .edit-icon {
  opacity: 1;
}

.edit-icon {
  opacity: 0.3;
  transition: opacity 0.2s;
}

.name-input :deep(input) {
  font-size: 14px;
  font-weight: 800;
  padding: 0;
}

.icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--primary), transparent 90%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  overflow: hidden;
  flex-shrink: 0;
}

.icon-wrapper.has-image {
  background: black;
}

.header-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.header-title {
  font-size: 14px;
  font-weight: 900;
  line-height: 1.2;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-input {
  position: relative;
}

.mini-input input {
  width: 100%;
  height: 32px;
  background: color-mix(in srgb, var(--foreground), transparent 96%);
  border: 1px solid color-mix(in srgb, var(--foreground), transparent 92%);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
  color: var(--foreground);
  outline: none;
  padding-right: 14px;
  transition: all 0.2s;
}

.mini-input input:focus {
  background: color-mix(in srgb, var(--primary), transparent 92%);
  border-color: var(--primary);
}

.mini-input input:invalid {
  border-color: var(--destructive);
  background: color-mix(in srgb, var(--destructive), transparent 95%);
}

/* Remove spin buttons for cleaner look */
.mini-input input::-webkit-inner-spin-button,
.mini-input input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}

.mini-input input[type="number"] {
  -moz-appearance: textfield;
}

.mini-input span {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 8px;
  font-weight: 900;
  color: color-mix(in srgb, var(--foreground), transparent 70%);
}

.shelf-btn-mini {
  width: 24px;
  height: 20px;
  background: color-mix(in srgb, var(--foreground), transparent 95%); /* Normal grey bg */
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: color-mix(in srgb, var(--foreground), transparent 40%);
  transition: all 0.2s;
  border: none;
  cursor: pointer;
}

.shelf-btn-mini:hover:not(:disabled) {
  background: color-mix(in srgb, var(--foreground), transparent 90%);
  color: var(--primary);
}

.shelf-btn-mini:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.shelf-label-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
}

.shelf-count {
  font-size: 14px;
  font-weight: 900;
  color: var(--primary);
}

.shelf-label-small {
  font-size: 7px;
  font-weight: 800;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--foreground), transparent 60%);
}

/* Detail Pane */
.detail-pane {
  background: color-mix(in srgb, var(--foreground), transparent 98%);
  border-top: 1px solid color-mix(in srgb, var(--foreground), transparent 95%);
  z-index: 101;
  display: flex;
}

.pane-label {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--foreground), transparent 60%);
  margin-bottom: 2px;
  display: block;
}

/* More Button - Toolbar Style */
.more-toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  color: color-mix(in srgb, var(--foreground), transparent 40%); /* Grey darken style */
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  border: 1px solid transparent;
}

.more-toolbar-btn:hover {
  background: color-mix(in srgb, var(--foreground), transparent 95%);
  color: var(--foreground);
}

.more-toolbar-btn.active {
  background: var(--primary);
  color: var(--primary-foreground);
}

/* Transitions */
.slide-properties-enter-active,
.slide-properties-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-properties-enter-from,
.slide-properties-leave-to {
  transform: translateY(-100%) scale(0.98);
  opacity: 0;
}

.expand-details-enter-active,
.expand-details-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 400px;
}

.expand-details-enter-from,
.expand-details-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

/* Common Styles */
.swing-select {
  width: 120px;
  font-size: 8px !important;
}

.collection-color-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--foreground), transparent 90%);
  flex-shrink: 0;
}

/* Photo Gallery */
.photo-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  pointer-events: auto;
}
.modal-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  height: 100%;
  max-width: 900px;
}
.photo-container {
  position: relative;
  width: 100%;
  height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}
.full-photo {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 12px;
}
.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-btn.prev {
  left: 20px;
}
.nav-btn.next {
  right: 20px;
}
.gallery-camera-btn {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--primary), transparent 20%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}
.photo-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
}
.close-modal-btn {
  position: absolute;
  top: 24px;
  right: 24px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

/* Lock Buttons */
.lock-btn {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--foreground), transparent 96%);
  border: 1px solid color-mix(in srgb, var(--foreground), transparent 92%);
  color: color-mix(in srgb, var(--foreground), transparent 40%);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.lock-btn:hover {
  background: color-mix(in srgb, var(--foreground), transparent 92%);
  border-color: color-mix(in srgb, var(--foreground), transparent 85%);
  color: var(--foreground);
}

.lock-btn.lock-active {
  background: color-mix(in srgb, var(--primary), transparent 90%);
  border-color: var(--primary);
  color: var(--primary);
}

.lock-btn .lock-icon {
  position: absolute;
  top: 2px;
  right: 2px;
  background: white;
  border-radius: 50%;
  padding: 1px;
}

.mini-input.area-surface input {
  width: 80px;
}
</style>
