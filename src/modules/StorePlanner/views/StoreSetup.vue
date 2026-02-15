<script setup lang="ts">
import DraggableSheet from "@/shared/components/ui/DraggableSheet.vue";
import CreateFloorSheet from "../components/CreateFloorSheet.vue";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { useRouter, useRoute } from "vue-router";
import { useStoreSchemaDetails } from "@/modules/StorePlanner/composables/useStoreSchemaDetails";
import { useUpdateStoreSchema } from "@/modules/StorePlanner/composables/useUpdateStoreSchema";
import { setAccessToken } from "@/shared/services/http";
import { toast } from "vue-sonner";

const { t } = useI18n();

interface TemplateFixture {
  templateId: string;
  x: number;
  y: number;
  rotation?: number;
}

interface PathSegment {
  x: number;
  y: number;
  type: "wall" | "door" | "window";
}

interface StoreTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  width: number;
  height: number;
  path?: PathSegment[];
  fixtures: TemplateFixture[];
  category: "retail" | "grocery" | "empty";
}

interface Props {
  partnerId?: string;
  partnerName?: string;
  onComplete?: () => void;
}

const router = useRouter();
const route = useRoute();
const props = defineProps<Props>();

// Use individual stores instead of combined editorStore
const layoutStore = useEditorLayout();
const editorToolsStore = useEditorTools();

// Destructure reactive properties with storeToRefs
const { currentLayout, savedLayouts } = storeToRefs(layoutStore);

// API-first approach: Get schemaId from query params
const schemaId = computed(() => route.query.schemaId as string | null);
const accessToken = computed(
  () => (route.query["access-token"] as string) || (route.query.accessToken as string) || null,
);
const isReadonly = computed(() => {
  const r = route.query.readonly || route.query.readOnly;
  return r === "true" || r === "1";
});

// Set access token and readonly state
watch(
  [accessToken, isReadonly],
  ([newToken, newReadonly]) => {
    if (newToken) {
      setAccessToken(newToken);
    }
    editorToolsStore.setReadonly(newReadonly);
  },
  { immediate: true },
);

// Track if we're manually refreshing
const isRefreshing = ref(false);

// Check if localStorage has data for a DIFFERENT schema (different partner)
// If so, we need to fetch fresh data for the new partner
const isDifferentSchema = computed(() => {
  if (!schemaId.value) return false;
  // If we have localStorage data but for a different schema, we need to fetch new data
  return (
    currentLayout.value !== null &&
    layoutStore.currentSchemaId !== null &&
    layoutStore.currentSchemaId !== schemaId.value
  );
});

// Check if we have valid localStorage data for the current schema
const hasValidLocalStorageData = computed(() => {
  if (!schemaId.value) return false;
  // Check if currentLayout exists and matches the current schemaId
  return currentLayout.value !== null && layoutStore.currentSchemaId === schemaId.value;
});

// Fetch from API if:
// 1. We're visiting a different schema (different partner)
// 2. OR we don't have any localStorage data for this schema
// 3. OR we're force refreshing
const shouldFetch = computed(
  () =>
    !!schemaId.value &&
    (isDifferentSchema.value || !hasValidLocalStorageData.value || isRefreshing.value),
);

// Always provide the schemaId (but control fetching via shouldFetch in enabled option)
const {
  data: schemaDataRef,
  isLoading: isLoadingSchema,
  error,
  refetch,
} = useStoreSchemaDetails(schemaId, {
  enabled: shouldFetch,
});
const { mutateAsync: updateSchema, isLoading: isSaving } = useUpdateStoreSchema();

const schemaData = computed(() => schemaDataRef.value);

const apiLayout = computed(() => {
  if (!schemaData.value?.json_description) return null;
  try {
    return typeof schemaData.value.json_description === "string"
      ? JSON.parse(schemaData.value.json_description)
      : schemaData.value.json_description;
  } catch (e) {
    console.error("Failed to parse layout JSON", e);
    return null;
  }
});

const apiFloors = computed(() => {
  if (!apiLayout.value) return [];

  return apiLayout.value.floors?.map((floor) => {
    if (floor.id === apiLayout.value.currentFloorId) {
      return {
        ...floor,
        nodes: apiLayout.value.nodes || floor.nodes,
        walls: apiLayout.value.walls || floor.walls,
        fixtures: apiLayout.value.fixtures || floor.fixtures,
        areas: apiLayout.value.areas || floor.areas,
      };
    }
    return floor;
  });
});

// Load schema into editor store
const loadSchemaIntoEditor = () => {
  if (apiLayout.value && schemaId.value) {
    // Always load API data if:
    // 1. We're visiting a different schema (different partner)
    // 2. We don't have valid localStorage data
    // 3. We're force refreshing
    if (isDifferentSchema.value || !hasValidLocalStorageData.value || isRefreshing.value) {
      console.log(
        `[StoreSetup] Loading schema ${schemaId.value} into localStorage`,
        isDifferentSchema.value ? "(different partner)" : "(fresh data)",
      );
      layoutStore.currentLayout = { ...apiLayout.value };
      layoutStore.currentSchemaId = schemaId.value;
      isRefreshing.value = false;
    }
  }
};

// Watch for API data changes and load into editor
watch(
  () => apiLayout.value,
  (newLayout) => {
    if (newLayout) {
      loadSchemaIntoEditor();
    }
  },
  { immediate: true },
);

// State
const viewMode = ref<"browse" | "configure">("browse");
const selectedTemplate = ref<StoreTemplate | null>(null);

// Form State
const storeName = ref("");
const firstFloorName = ref(t("storePlanner.setup.defaultFloorName"));
const width = ref(1000);
const height = ref(800);

const widthM = computed({
  get: () => width.value / 100,
  set: (val) => (width.value = Math.round(val * 100)),
});

const heightM = computed({
  get: () => height.value / 100,
  set: (val) => (height.value = Math.round(val * 100)),
});

const surfaceArea = computed(() => (widthM.value * heightM.value).toFixed(2));

const customLayoutId = ref<string | null>(null);

// Use API layout if available, otherwise fallback to localStorage layouts
const currentStore = computed(() => {
  if (schemaId.value) {
    if (currentLayout.value) {
      return {
        ...currentLayout.value,
        floors: currentLayout.value.floors.map((floor) => {
          if (floor.id === currentLayout.value?.currentFloorId) {
            return {
              ...floor,
              nodes: currentLayout.value?.nodes || floor.nodes,
              walls: currentLayout.value?.walls || floor.walls,
              fixtures: currentLayout.value?.fixtures || floor.fixtures,
              areas: currentLayout.value.areas || floor.areas,
            };
          }
          return floor;
        }),
      };
    }

    // Otherwise use API data
    if (apiLayout.value) {
      return {
        ...apiLayout.value,
        floors: apiFloors.value,
      };
    }
  }

  // Fallback to localStorage for backward compatibility (Efficy app)
  if (props.partnerId && savedLayouts.value.length > 0) {
    const filtered = savedLayouts.value.filter((l) => l.partnerId === props.partnerId);
    return filtered.length > 0 ? filtered[0] : null;
  }

  return null;
});

const isConfigureMode = computed(() => viewMode.value === "configure");
const showFloorSheet = ref(false);

const handleLoadFloor = async (floorId: string) => {
  if (!currentStore.value) return;

  // API-first approach: Navigate to editor with query params
  if (schemaId.value) {
    // Ensure schema is loaded into editor store
    loadSchemaIntoEditor();

    // Ensure currentSchemaId is set for localStorage tracking
    if (!layoutStore.currentSchemaId) {
      layoutStore.currentSchemaId = schemaId.value;
    }

    layoutStore.switchFloor(floorId);

    router.push({
      name: "partner-store-plan",
      params: { partnerId: schemaData.value?.partner_id || props.partnerId || "unknown" },
      query: {
        schemaId: schemaId.value,
        floorId: floorId,
        ...(accessToken.value && { "access-token": accessToken.value }),
        ...(isReadonly.value && { readonly: "true" }),
      },
    });
  } else {
    // Fallback for Efficy app (localStorage)
    await layoutStore.loadLayout(currentStore.value.id);
    layoutStore.switchFloor(floorId);
    props.onComplete?.();
  }
};

// const handleBack = () => {
//   viewMode.value = "browse";
//   selectedTemplate.value = null;
//   customLayoutId.value = null;
// };

const handleCreate = async () => {
  if (customLayoutId.value && selectedTemplate.value?.id === "empty") {
    layoutStore.updateLayoutDimensions(
      customLayoutId.value,
      storeName.value,
      width.value,
      height.value,
    );
    await layoutStore.loadLayout(customLayoutId.value);
    viewMode.value = "configure";
  } else {
    await layoutStore.createNewLayout(
      storeName.value,
      width.value,
      height.value,
      props.partnerId,
      firstFloorName.value,
    );
  }

  // Refresh the layouts after creation
  if (props.partnerId) {
    await layoutStore.fetchPartnerLayouts(props.partnerId);
  }

  props.onComplete?.();
};

// Save all modifications to API
const saveAllChanges = async () => {
  if (!layoutStore.currentLayout || !schemaId.value) {
    toast.error("No changes to save");
    return;
  }

  try {
    // Ensure we're saving the latest localStorage data
    await updateSchema({
      schemaId: schemaId.value,
      jsonDescription: JSON.stringify(layoutStore.currentLayout),
    });

    // Mark that localStorage is now in sync with the schema
    layoutStore.currentSchemaId = schemaId.value;

    toast.success("Changes saved successfully", {
      description: new Date().toLocaleString(),
    });

    // Don't refetch - we already have the latest data in localStorage
    // Refetching would just return what we just saved
  } catch (err) {
    console.error("Failed to save changes:", err);
    toast.error("Failed to save changes", {
      description: "Please try again later",
    });
  }
};

// Force refresh data from API (discards localStorage changes)
const handleForceRefresh = async () => {
  if (!schemaId.value) {
    toast.error("No schema to refresh");
    return;
  }

  try {
    isRefreshing.value = true;

    console.log("[StoreSetup] Force refreshing schema from API");

    // Force refetch from API by temporarily enabling the query
    await refetch();

    toast.success("Data refreshed from server", {
      description: "Latest data loaded successfully",
    });
  } catch (err) {
    console.error("Failed to refresh data:", err);
    toast.error("Failed to refresh data", {
      description: "Please try again later",
    });
    isRefreshing.value = false;
  }
};
</script>

<template>
  <div class="setup-container">
    <div class="setup-content">
      <!-- Loading State -->
      <div v-if="isLoadingSchema" class="flex justify-center items-center h-64">
        <IMdiLoading class="w-8 h-8 animate-spin text-primary" />
        <span class="ml-3 text-lg">Loading store details...</span>
      </div>

      <!-- Error State -->
      <div
        v-else-if="error"
        class="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20"
      >
        <h3 class="font-bold">Error loading store</h3>
        <p>{{ error.value?.message }}</p>
        <p v-if="!schemaId" class="mt-2 text-sm opacity-80">Missing schemaId query parameter.</p>
      </div>

      <div v-else-if="viewMode === 'browse'" class="browse-view">
        <div v-if="currentStore" class="section">
          <!-- Header with Store Name and Buttons -->
          <div class="mb-6">
            <div class="flex items-center justify-end mb-4">
              <div class="flex items-center gap-3">
                <!-- Refresh Button -->
                <Button
                  v-if="schemaId"
                  @click="handleForceRefresh"
                  :disabled="isRefreshing || isLoadingSchema"
                  size="default"
                  variant="outline"
                  class="gap-2"
                >
                  <IMdiRefresh
                    v-if="!isRefreshing"
                    class="w-4 h-4"
                    :class="{ 'animate-spin': isLoadingSchema }"
                  />
                  <IMdiLoading v-else class="w-4 h-4 animate-spin" />
                  {{ isRefreshing ? "Refreshing..." : "Refresh" }}
                </Button>

                <!-- Save All Button -->
                <Button
                  v-if="schemaId && !isReadonly"
                  @click="saveAllChanges"
                  :disabled="isSaving"
                  size="default"
                  class="gap-2"
                >
                  <IMdiContentSave v-if="!isSaving" class="w-4 h-4" />
                  <IMdiLoading v-else class="w-4 h-4 animate-spin" />
                  {{ isSaving ? "Saving..." : "Save All Changes" }}
                </Button>
              </div>
            </div>
          </div>

          <div class="projects-grid">
            <div
              v-for="floor in currentStore.floors"
              :key="floor.id"
              class="project-card"
              @click="handleLoadFloor(floor.id)"
            >
              <div class="card-header flex items-start justify-between mb-3">
                <div
                  class="card-icon p-2 rounded-lg bg-foreground/5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                >
                  <IMdiLayers class="w-5 h-5" />
                </div>
                <!-- <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  @click.stop="handleDeleteFloor(floor.id)"
                  :title="t('storePlanner.setup.deleteFloor')"
                >
                  <IMdiClose class="w-4 h-4" />
                </Button> -->
              </div>
              <h4 class="project-name">{{ floor.name }}</h4>
              <!-- <p class="project-dims">
                {{ t("storePlanner.setup.level", { level: floor.level }) }}
              </p> -->
              <div
                class="card-footer mt-4 text-xs font-semibold text-primary flex items-center gap-1"
              >
                {{ t("storePlanner.setup.openFloor") }}
                <IMdiArrowRight class="w-3 h-3" />
              </div>
            </div>
          </div>

          <Sheet v-model:open="showFloorSheet">
            <SheetContent side="bottom">
              <CreateFloorSheet
                @close="showFloorSheet = false"
                @floor-added="
                  async () => {
                    if (props.partnerId) {
                      await layoutStore.fetchPartnerLayouts(props.partnerId);
                    }
                  }
                "
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <draggable-sheet height="100%" v-model="isConfigureMode">
        <div>
          <div class="config-card">
            <div
              class="config-header flex flex-row justify-between items-center gap-3 p-8 border-b bg-muted/20"
            >
              <div class="flex flex-row gap-2 items-center">
                <div class="config-icon-wrapper p-2 bg-background rounded-lg border">
                  <IMdiStorefront class="text-primary w-5 h-5" />
                </div>
                <div>
                  <h2 class="config-title text-xl font-bold m-0">{{ partnerName }}</h2>
                  <p class="config-subtitle text-sm text-muted-foreground m-0 mt-0.5">
                    {{ t("storePlanner.setup.configureSubtitle") }}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                class="text-destructive hover:text-destructive hover:bg-destructive/10"
                @click="viewMode = 'browse'"
                :title="t('_today.close')"
              >
                <IMdiClose class="w-5 h-5" />
              </Button>
            </div>

            <div class="config-body p-8 flex flex-col gap-6">
              <div class="flex flex-row gap-4">
                <div class="grid w-full items-center gap-1.5">
                  <Label for="width">{{ t("storePlanner.setup.widthM") }}</Label>
                  <Input id="width" v-model.number="widthM" type="number" step="0.1" />
                </div>
                <div class="grid w-full items-center gap-1.5">
                  <Label for="height">{{ t("storePlanner.setup.heightM") }}</Label>
                  <Input id="height" v-model.number="heightM" type="number" step="0.1" />
                </div>
              </div>
              <!-- Surface Area Display -->
              <div class="surface-area-box mb-2">
                <span class="surface-label">{{ t("storePlanner.setup.surfaceArea") }}</span>
                <span class="surface-value">{{ surfaceArea }} m²</span>
              </div>

              <Button
                class="w-full submit-btn font-bold"
                size="default"
                :disabled="!storeName || width < 100 || height < 100"
                @click="handleCreate"
              >
                {{
                  customLayoutId
                    ? t("storePlanner.setup.saveChanges")
                    : t("storePlanner.setup.createStore")
                }}
              </Button>
            </div>
          </div>
        </div>
      </draggable-sheet>
    </div>
  </div>
</template>

<style scoped>
@reference "@/assets/index.css";
.setup-container {
  min-height: 100vh;
}

.setup-content {
  max-width: 1152px;
  margin: 0 auto;
  padding: 40px 16px;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.project-card {
  @apply bg-card border border-border rounded-xl p-5 cursor-pointer transition-all relative;
}
.project-card:hover {
  @apply border-primary shadow-lg;
}

.template-card {
  @apply bg-card border border-border rounded-xl overflow-hidden cursor-pointer transition-all flex flex-col;
}
.template-card:hover {
  @apply border-primary/50 translate-y-[-4px] shadow-lg;
}

.empty-canvas {
  @apply border-2 border-dashed border-border/20 bg-transparent items-center justify-center text-center p-6 min-h-[220px];
}
.empty-canvas:hover {
  @apply border-primary bg-foreground/5;
}
</style>
