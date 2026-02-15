<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { useEditorFixtures } from "@/modules/StorePlanner/stores/useEditorFixtures";
import { useEditorConstruction } from "@/modules/StorePlanner/stores/useEditorConstruction";
import { useEditorSelection } from "@/modules/StorePlanner/stores/useEditorSelection";
import {
  getTemplatesByCategory,
  fixtureTemplates,
} from "@/modules/StorePlanner/data/fixtureTemplates";
import type { FixtureTemplate } from "@/modules/StorePlanner/types/editor";
import FixtureSVG from "./FixtureSVG.vue";
import { areaTemplates } from "@/modules/StorePlanner/data/areaTemplates";
import { floorTypes } from "@/modules/StorePlanner/data/floors";

const { t } = useI18n();

const editorLayoutStore = useEditorLayout();
const editorToolsStore = useEditorTools();
const editorFixturesStore = useEditorFixtures();
const editorConstructionStore = useEditorConstruction();
const selectionStore = useEditorSelection();

const { currentLayout, currentFloor, customTemplates, favoriteTemplateIds } =
  storeToRefs(editorLayoutStore);
const { isLibraryOpen, libraryCategory } = storeToRefs(editorToolsStore);
const { selectedAreaId, selectedWallForAttachment } = storeToRefs(selectionStore);

const localizedCategoryLabels = computed<Record<string, string>>(() => ({
  favorites: t("storePlanner.library.categories.favorites"),
  all: t("storePlanner.library.categories.all"),
  "my-templates": t("storePlanner.library.categories.myTemplates"),
  shelves: t("storePlanner.library.categories.shelves"),
  fridges: t("storePlanner.library.categories.fridges"),
  checkout: t("storePlanner.library.categories.checkout"),
  structures: t("storePlanner.library.categories.structures"),
  furniture: t("storePlanner.library.categories.furniture"),
  zones: t("storePlanner.library.categories.zones"),
  floors: t("storePlanner.library.categories.floors"),
  areas: t("storePlanner.library.categories.areas"),
}));
// Define categories based on context - if opened from door/window button, show only structures
const categories = computed<
  (
    | "all"
    | "areas"
    | "structures"
    | "floors"
    | "shelves"
    | "fridges"
    | "checkout"
    | "furniture"
    | "zones"
    | "favorites"
    | "my-templates"
  )[]
>(() => {
  const baseCategories: any[] = [
    "favorites",
    "areas",
    "my-templates",
    "all",
    "shelves",
    "fridges",
    "checkout",
    "furniture",
    "zones",
  ];

  // Only show floors if an area is selected
  if (selectedAreaId.value) {
    baseCategories.splice(4, 0, "floors");
  }

  // If opened from door/window button, only show structures?
  // Actually the original logic was: if libraryCategory === 'structures', show structures.
  // Let's stick to the user request: hide floors if no area.
  if (libraryCategory.value === "structures") {
    baseCategories.splice(4, 0, "structures");
  }

  return baseCategories;
});

const searchQuery = ref("");

// Calculate viewport center in world coordinates
const getViewportCenter = () => {
  const zoom = editorToolsStore.zoom;
  const panOffset = editorToolsStore.panOffset;

  // Account for left sidebar (64px)
  const sidebarWidth = 64;
  const screenWidth = window.innerWidth - sidebarWidth;
  const screenHeight = window.innerHeight;

  // Calculate viewport center in screen coordinates
  const screenCenterX = screenWidth / 2;
  const screenCenterY = screenHeight / 2;

  // Convert screen coordinates to world coordinates
  const worldX = (screenCenterX - panOffset.x) / zoom;
  const worldY = (screenCenterY - panOffset.y) / zoom;

  return { x: worldX, y: worldY };
};

const filteredTemplates = computed(() => {
  let templates: FixtureTemplate[] = [];

  if (libraryCategory.value === "favorites") {
    // Include both built-in templates AND custom templates in favorites
    const builtInFavorites = fixtureTemplates.filter((t: FixtureTemplate) =>
      favoriteTemplateIds.value.includes(t.id),
    );
    const customFavorites = customTemplates.value.filter((t: FixtureTemplate) =>
      favoriteTemplateIds.value.includes(t.id),
    );
    templates = [...builtInFavorites, ...customFavorites];
  } else if (libraryCategory.value === "my-templates") {
    templates = customTemplates.value;
  } else {
    templates = getTemplatesByCategory(libraryCategory.value);
  }

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    templates = templates.filter(
      (t: FixtureTemplate) =>
        t.name.toLowerCase().includes(query) || t.description?.toLowerCase().includes(query),
    );
  }

  return templates;
});
const handleSelectFloor = (floorId: string) => {
  if (selectedAreaId.value) {
    // If an area is selected, apply texture ONLY to that area
    editorLayoutStore.updateArea(selectedAreaId.value, {
      floorTypeId: floorId,
    });
    // Auto-close library after selecting floor for area
    editorToolsStore.closeLibrary();
  } else {
    // Otherwise, set it as the default background for the whole floor level
    editorLayoutStore.setFloorType(currentLayout.value?.currentFloorId || "", floorId);
  }
};
const handleSelectTemplate = (template: FixtureTemplate) => {
  if (!currentLayout.value) return;

  // If this is a wall-attached structure (door/window) and we have a selected wall,
  // insert it as a wall segment instead of a fixture
  if (template.isWallAttached && selectedWallForAttachment.value) {
    let wallType: "door" | "window" = "door";
    let doorSwing: "left" | "right" | "sliding" = "left";
    let doorType: "entrance" | "exit" | "standard" = "standard";

    if (template.id === "window") {
      wallType = "window";
    } else if (template.id === "door-sliding") {
      doorSwing = "sliding";
    } else if (template.id === "door-emergency") {
      doorType = "exit";
    }

    editorConstructionStore.insertDoorWindow(
      selectedWallForAttachment.value,
      wallType,
      template.width,
      doorSwing,
      doorType,
    );

    selectedWallForAttachment.value = null;
    editorToolsStore.closeLibrary();
    return;
  }

  // Place in center of current viewport
  const viewportCenter = getViewportCenter();
  const x = viewportCenter.x - template.width / 2;
  const y = viewportCenter.y - template.height / 2;
  editorFixturesStore.addFixture(template.id, x, y);
};

const handleSelectAreaTemplate = (templateId: string) => {
  if (!currentLayout.value) return;
  // Place in center of current viewport
  const viewportCenter = getViewportCenter();
  editorConstructionStore.addAreaFromTemplate(templateId, viewportCenter.x, viewportCenter.y);
  editorToolsStore.closeLibrary();
};

const emit = defineEmits<{
  (e: "drag-start"): void;
  (e: "drag-end"): void;
}>();

const handleDragStart = (e: DragEvent, template: FixtureTemplate) => {
  if (e.dataTransfer) {
    e.dataTransfer.setData("templateId", template.id);
    e.dataTransfer.effectAllowed = "copy";
    // Set drag image centered? Browser handles it usually.
  }
  emit("drag-start");
};

const handleDragEnd = () => {
  emit("drag-end");
};

const getPreviewScale = (template: FixtureTemplate) => {
  return Math.min(60 / template.width, 50 / template.height);
};
</script>

<template>
  <Transition name="library-fade">
    <div
      v-show="isLibraryOpen"
      class="library-overlay absolute inset-0 z-200 bg-background flex flex-col pointer-events-auto"
    >
      <!-- Header -->
      <div
        class="library-header flex items-center justify-between p-3 border-b border-border bg-background"
      >
        <h2 class="library-title text-lg font-bold text-foreground">
          {{ t("storePlanner.library.title") }}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 rounded-full hover:bg-accent border-none transition-transform hover:rotate-90"
          @click="editorToolsStore.closeLibrary"
        >
          <IMdiClose class="w-5 h-5" />
        </Button>
      </div>

      <!-- Category tabs -->
      <div
        class="categories-container p-3 border-b border-border overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div class="flex gap-2">
          <Badge
            v-for="cat in categories"
            :key="cat"
            :variant="libraryCategory === cat ? 'default' : 'secondary'"
            class="px-4 py-1 cursor-pointer whitespace-nowrap rounded-full transition-all"
            @click="editorToolsStore.setLibraryCategory(cat)"
          >
            {{ localizedCategoryLabels[cat] }}
          </Badge>
        </div>
      </div>

      <!-- Items grid -->
      <div class="items-grid-container flex-1 overflow-y-auto p-4">
        <div
          v-if="
            libraryCategory !== 'floors' &&
            libraryCategory !== 'areas' &&
            filteredTemplates.length === 0
          "
          class="no-items text-center py-12 text-muted-foreground text-sm"
        >
          {{ t("storePlanner.library.noItems") }}
        </div>
        <div
          v-else
          class="items-grid grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4 max-[600px]:grid-cols-[repeat(auto-fill,minmax(100px,1fr))] max-[600px]:gap-2"
        >
          <!-- Floor Items -->
          <template v-if="libraryCategory === 'floors'">
            <div
              v-for="floor in floorTypes"
              :key="floor.id"
              class="item-card floor-card bg-background rounded-xl border border-border p-3 cursor-pointer transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5 flex flex-col relative"
              :class="{
                'border-primary bg-primary/5':
                  // Highlight if it matches selected area OR global floor
                  selectedAreaId
                    ? currentLayout?.areas.find((a) => a.id === selectedAreaId)?.floorTypeId ===
                      floor.id
                    : (currentFloor?.floorType || currentLayout?.floorType) === floor.id,
              }"
              @click="handleSelectFloor(floor.id)"
            >
              <div
                class="item-preview floor-preview h-20 flex items-center justify-center bg-accent/30 rounded-lg mb-2 border border-accent/20 relative overflow-hidden"
                :style="{ backgroundColor: floor.thumbColor || floor.color }"
              >
                <div
                  v-if="floor.id === 'tile-checkered'"
                  class="checkered-overlay absolute inset-0 bg-[radial-gradient(circle,transparent_20%,#0000001a_20%)] bg-[size:10px_10px]"
                ></div>
                <div
                  v-if="floor.pattern === 'grid'"
                  class="grid-overlay absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"
                ></div>
              </div>
              <div class="item-info text-center">
                <h4 class="item-name text-[13px] font-bold mb-0.5 text-foreground truncate">
                  {{
                    t("storePlanner.library.items.floors." + floor.id) !==
                    "storePlanner.library.items.floors." + floor.id
                      ? t("storePlanner.library.items.floors." + floor.id)
                      : floor.name
                  }}
                </h4>
              </div>
            </div>
          </template>

          <!-- Area Templates -->
          <template v-else-if="libraryCategory === 'areas'">
            <div
              v-for="template in areaTemplates"
              :key="template.id"
              class="item-card area-card bg-background rounded-xl border border-border p-3 cursor-pointer transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5 flex flex-col relative"
              @click="handleSelectAreaTemplate(template.id)"
            >
              <div
                class="item-preview area-preview h-20 flex items-center justify-center bg-accent/30 rounded-lg mb-2 border border-accent/20 relative overflow-hidden"
              >
                <!-- Area Shape Preview -->
                <svg
                  width="60"
                  height="60"
                  viewBox="0 0 100 100"
                  class="area-shape-svg text-primary"
                >
                  <path
                    v-if="template.id === 'square'"
                    d="M 20 20 L 80 20 L 80 80 L 20 80 Z"
                    fill="currentColor"
                    fill-opacity="0.15"
                    stroke="currentColor"
                    stroke-width="6"
                  />
                  <path
                    v-else-if="template.id === 'l-shape'"
                    d="M 20 20 L 80 20 L 80 50 L 50 50 L 50 80 L 20 80 Z"
                    fill="currentColor"
                    fill-opacity="0.15"
                    stroke="currentColor"
                    stroke-width="6"
                  />
                  <path
                    v-else-if="template.id === 't-shape'"
                    d="M 20 40 L 40 40 L 40 20 L 60 20 L 60 40 L 80 40 L 80 60 L 20 60 Z"
                    fill="currentColor"
                    fill-opacity="0.15"
                    stroke="currentColor"
                    stroke-width="6"
                  />
                  <path
                    v-else-if="template.id === 'u-shape'"
                    d="M 20 20 L 40 20 L 40 60 L 60 60 L 60 20 L 80 20 L 80 80 L 20 80 Z"
                    fill="currentColor"
                    fill-opacity="0.15"
                    stroke="currentColor"
                    stroke-width="6"
                  />
                  <IMdiSquareOutline v-else class="w-10 h-10 text-muted-foreground/50" />
                </svg>
              </div>
              <div class="item-info text-center">
                <h4 class="item-name text-[13px] font-bold mb-0.5 text-foreground truncate">
                  {{
                    t("storePlanner.library.items.areas." + template.id + ".name") !==
                    "storePlanner.library.items.areas." + template.id + ".name"
                      ? t("storePlanner.library.items.areas." + template.id + ".name")
                      : template.name
                  }}
                </h4>
                <p class="item-dims text-[10px] text-muted-foreground/50">
                  {{
                    t("storePlanner.library.items.areas." + template.id + ".description") !==
                    "storePlanner.library.items.areas." + template.id + ".description"
                      ? t("storePlanner.library.items.areas." + template.id + ".description")
                      : template.description
                  }}
                </p>
              </div>
            </div>
          </template>

          <!-- Standard Templates -->
          <template v-else>
            <div
              v-for="template in filteredTemplates"
              :key="template.id"
              class="item-card bg-background rounded-xl border border-border p-3 cursor-pointer transition-all hover:border-primary hover:shadow-md hover:-translate-y-0.5 flex flex-col relative"
              draggable="true"
              @dragstart="(e) => handleDragStart(e, template)"
              @dragend="handleDragEnd"
              @click="handleSelectTemplate(template)"
            >
              <!-- Preview -->
              <div
                class="item-preview h-20 flex items-center justify-center bg-accent/30 rounded-lg mb-2 border border-accent/20 relative overflow-hidden"
              >
                <!-- Image-based fixture: fill entire preview with image -->
                <img
                  v-if="template.imageUrl"
                  :src="template.imageUrl"
                  :alt="
                    t('storePlanner.library.items.fixtures.' + template.id + '.name') !==
                    'storePlanner.library.items.fixtures.' + template.id + '.name'
                      ? t('storePlanner.library.items.fixtures.' + template.id + '.name')
                      : template.name
                  "
                  style="width: 100%; height: 100%; object-fit: contain; object-position: center"
                />
                <!-- Shape-based fixture: use SVG -->
                <svg
                  v-else
                  :width="template.width * getPreviewScale(template)"
                  :height="template.height * getPreviewScale(template)"
                  :viewBox="`0 0 ${template.width} ${template.height}`"
                >
                  <FixtureSVG
                    :template="template"
                    :width="template.width"
                    :height="template.height"
                    :scale="1 / getPreviewScale(template)"
                  />
                </svg>
              </div>

              <div class="item-info text-center">
                <h4 class="item-name text-[13px] font-bold mb-0.5 text-foreground truncate">
                  {{
                    t("storePlanner.library.items.fixtures." + template.id + ".name") !==
                    "storePlanner.library.items.fixtures." + template.id + ".name"
                      ? t("storePlanner.library.items.fixtures." + template.id + ".name")
                      : template.name
                  }}
                </h4>
                <p class="item-dims text-[10px] text-muted-foreground/50">
                  {{ template.width }} x {{ template.height }} cm
                </p>
              </div>

              <!-- Favorite Toggle -->
              <button
                class="favorite-btn absolute top-2 right-2 w-7 h-7 rounded-full bg-white shadow-sm border border-black/5 flex items-center justify-center transition-all hover:scale-110 z-10"
                :class="{
                  'text-red-500 bg-red-50': favoriteTemplateIds.includes(template.id),
                  'text-slate-400': !favoriteTemplateIds.includes(template.id),
                }"
                @click.stop="editorFixturesStore.toggleFavorite(template.id)"
              >
                <IMdiHeart v-if="favoriteTemplateIds.includes(template.id)" class="w-4 h-4" />
                <IMdiHeartOutline v-else class="w-4 h-4" />
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.library-fade-enter-active,
.library-fade-leave-active {
  transition: opacity 0.2s;
}
.library-fade-enter-from,
.library-fade-leave-to {
  opacity: 0;
}
</style>
