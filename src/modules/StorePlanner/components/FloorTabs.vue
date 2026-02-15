<template>
  <div
    class="floor-tabs-container bg-background/95 backdrop-blur-3xl border-b border-border z-50 pointer-events-auto flex flex-col transition-all duration-300 ease-in-out"
  >
    <div class="floor-tabs-wrapper flex w-full overflow-hidden">
      <div class="floor-tabs-scroller flex flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide">
        <div class="floor-tabs flex min-w-max border border-border">
          <button
            v-if="editorMode === 'design'"
            class="add-floor-tab flex items-center justify-center w-11 bg-primary/10 text-primary cursor-pointer transition-colors hover:bg-primary/20"
            @click="showAddFloorModal = true"
            :title="t('storePlanner.editor.floors.addLabel')"
          >
            <IMdiPlus class="w-5 h-5" />
          </button>
          <div
            v-for="floor in layoutStore.currentLayout?.floors || []"
            :key="floor.id"
            class="floor-tab flex items-center px-5 py-3.5 cursor-pointer transition-all duration-200 min-w-[120px] border-r border-primary/20 whitespace-nowrap"
            :class="{
              'bg-primary text-primary-foreground border-primary':
                floor.id === layoutStore.currentLayout?.currentFloorId,
            }"
            @click="handleTabClick(floor.id)"
            @mousedown="startPress(floor)"
            @touchstart="startPress(floor)"
            @mouseup="cancelPress"
            @touchend="cancelPress"
            @mouseleave="cancelPress"
          >
            <div class="tab-content flex flex-row gap-2 w-full items-baseline">
              <span class="tab-name text-xs font-semibold leading-none">{{ floor.name }}</span>
              <span class="tab-surface text-[10px] font-normal opacity-80 leading-none"
                >{{ calculateSurface(floor) }} m²</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Floor Modal -->
    <Dialog v-model:open="showAddFloorModal">
      <DialogContent class="sm:max-w-[500px]">
        <DialogHeader>
          <div class="flex items-center justify-between w-full pr-6">
            <DialogTitle>{{ newFloorName }}</DialogTitle>
            <span class="text-xs text-muted-foreground">({{ newFloorArea }} m²)</span>
          </div>
        </DialogHeader>
        <div class="grid grid-cols-3 gap-4 py-4">
          <div class="space-y-2">
            <Label>{{ t("storePlanner.editor.floors.levelLabel") }}</Label>
            <Input
              v-model.number="newFloorLevel"
              type="number"
              :class="{ 'border-destructive': !isNewLevelValid }"
            />
            <p v-if="!isNewLevelValid" class="text-[10px] text-destructive">
              {{ t("storePlanner.editor.floors.levelExists") }}
            </p>
          </div>
          <div class="space-y-2">
            <Label>{{ t("storePlanner.editor.floors.widthM") }}</Label>
            <Input v-model.number="newFloorWidthM" type="number" step="0.1" />
          </div>
          <div class="space-y-2">
            <Label>{{ t("storePlanner.editor.floors.heightM") }}</Label>
            <Input v-model.number="newFloorHeightM" type="number" step="0.1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="cancelAddFloor">
            {{ t("storePlanner.editor.floors.cancel") }}
          </Button>
          <Button @click="createFloor" :disabled="!isNewLevelValid">
            {{ t("storePlanner.editor.floors.create") }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Floor Modal -->
    <Dialog v-model:open="showEditFloorModal">
      <DialogContent class="sm:max-w-[500px]">
        <DialogHeader>
          <div class="flex items-center justify-between w-full pr-6">
            <DialogTitle>{{ editFloorName }}</DialogTitle>
            <span class="text-xs text-muted-foreground">({{ editFloorArea }} m²)</span>
          </div>
        </DialogHeader>
        <div class="grid grid-cols-3 gap-4 py-4">
          <div class="space-y-2">
            <Label>{{ t("storePlanner.editor.floors.levelLabel") }}</Label>
            <Input
              v-model.number="editFloorLevel"
              type="number"
              :class="{ 'border-destructive': !isEditLevelValid }"
            />
            <p v-if="!isEditLevelValid" class="text-[10px] text-destructive">
              {{ t("storePlanner.editor.floors.levelExists") }}
            </p>
          </div>
          <div class="space-y-2">
            <Label>{{ t("storePlanner.editor.floors.widthM") }}</Label>
            <Input v-model.number="editFloorWidthM" type="number" step="0.1" />
          </div>
          <div class="space-y-2">
            <Label>{{ t("storePlanner.editor.floors.heightM") }}</Label>
            <Input v-model.number="editFloorHeightM" type="number" step="0.1" />
          </div>
        </div>
        <DialogFooter class="flex justify-between sm:justify-between items-center w-full">
          <Button variant="destructive" size="icon" @click="deleteFloor">
            <IMdiDelete class="w-4 h-4" />
          </Button>
          <div class="flex gap-2">
            <Button variant="ghost" @click="showEditFloorModal = false">
              {{ t("storePlanner.editor.floors.cancel") }}
            </Button>
            <Button @click="updateFloor" :disabled="!isEditLevelValid">
              {{ t("storePlanner.editor.floors.save") }}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { useMessageBox } from "@/shared/composables/useMessageBox";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import type { StoreFloor } from "@/modules/StorePlanner/types/editor";

const { t } = useI18n();
const { confirm, alert } = useMessageBox();
const layoutStore = useEditorLayout();
const toolsStore = useEditorTools();
const { currentLayout } = storeToRefs(layoutStore);
const { editorMode } = storeToRefs(toolsStore);

// State for add floor modal
const showAddFloorModal = ref(false);
const newFloorWidthM = ref(10.0); // Default 10m x 10m
const newFloorHeightM = ref(10.0);
const newFloorLevel = ref(1);

// Long Press Logic
const pressTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const isLongPressActive = ref(false);

const startPress = (floor: StoreFloor) => {
  if (editorMode.value !== "design") return;
  isLongPressActive.value = false;
  pressTimer.value = setTimeout(() => {
    isLongPressActive.value = true;
    openEditFloorModal(floor);
  }, 600);
};

const cancelPress = () => {
  if (pressTimer.value) {
    clearTimeout(pressTimer.value);
    pressTimer.value = null;
  }
};

const handleTabClick = (floorId: string) => {
  if (!isLongPressActive.value) {
    switchFloor(floorId);
  }
  isLongPressActive.value = false;
};

// Initialize level correctly
watch(showAddFloorModal, (isOpen) => {
  if (isOpen && currentLayout.value) {
    const levels = currentLayout.value.floors.map((f) => f.level);
    if (levels.length === 0) {
      newFloorLevel.value = 1;
    } else {
      newFloorLevel.value = Math.max(...levels) + 1;
    }
  }
});

const newFloorName = computed(() => {
  return t("storePlanner.editor.floors.defaultName", {
    level: newFloorLevel.value,
  });
});

// State for edit floor modal
const showEditFloorModal = ref(false);
const editingFloor = ref<StoreFloor | null>(null);
const editFloorName = ref("");
const editFloorLevel = ref(1);
const editFloorWidthM = ref(10.0);
const editFloorHeightM = ref(10.0);

const isNewLevelValid = computed(() => {
  if (!currentLayout.value) return true;
  return !currentLayout.value.floors.some((f) => f.level === newFloorLevel.value);
});

const isEditLevelValid = computed(() => {
  const floor = editingFloor.value;
  if (!currentLayout.value || !floor) return true;
  return !currentLayout.value.floors.some(
    (f) => f.level === editFloorLevel.value && f.id !== floor.id,
  );
});

const newFloorArea = computed(() => (newFloorWidthM.value * newFloorHeightM.value).toFixed(2));

const editFloorArea = computed(() => (editFloorWidthM.value * editFloorHeightM.value).toFixed(2));

// Watchers for automatic naming
watch(newFloorLevel, () => {
  // Name is computed, but we ensure level reflects in name if needed
});

watch(editFloorLevel, (newLevel) => {
  if (editingFloor.value) {
    editFloorName.value = t("storePlanner.editor.floors.defaultName", {
      level: newLevel,
    });
  }
});

// Methods
const switchFloor = (floorId: string) => {
  layoutStore.switchFloor(floorId);
};

const calculateSurface = (floor: StoreFloor) => {
  const width = floor.width || currentLayout.value?.width || 0;
  const height = floor.height || currentLayout.value?.height || 0;
  return ((width * height) / 10000).toFixed(2); // Convert cm² to m²
};

const openEditFloorModal = (floor: StoreFloor) => {
  editingFloor.value = floor;
  editFloorName.value = floor.name;
  editFloorLevel.value = floor.level;
  editFloorWidthM.value = (floor.width || currentLayout.value?.width || 1000) / 100;
  editFloorHeightM.value = (floor.height || currentLayout.value?.height || 1000) / 100;
  showEditFloorModal.value = true;
};

const updateFloor = async () => {
  const floor = editingFloor.value;
  if (!floor) return;

  // Check if the new level already exists (excluding the current floor)
  const existingFloorWithLevel = currentLayout.value?.floors.find(
    (f) => f.level === editFloorLevel.value && f.id !== floor.id,
  );

  if (existingFloorWithLevel) {
    alert(t("storePlanner.editor.floors.levelExists"));
    return;
  }

  // Update the floor using the store method
  await layoutStore.updateFloor(floor.id, {
    name: editFloorName.value,
    level: editFloorLevel.value,
    width: Math.round(editFloorWidthM.value * 100),
    height: Math.round(editFloorHeightM.value * 100),
  });

  showEditFloorModal.value = false;
  editingFloor.value = null;
};

const deleteFloor = async () => {
  if (!editingFloor.value) return;

  const ok = await confirm({
    message: t("storePlanner.editor.floors.deleteConfirm"),
    icon: "mdi-delete",
    iconColor: "error",
  });

  if (ok) {
    await layoutStore.deleteFloor(editingFloor.value.id);
    showEditFloorModal.value = false;
    editingFloor.value = null;
  }
};

const createFloor = async () => {
  if (!currentLayout.value) return;

  await layoutStore.addFloor(
    newFloorName.value,
    newFloorLevel.value,
    Math.round(newFloorWidthM.value * 100),
    Math.round(newFloorHeightM.value * 100),
  );

  showAddFloorModal.value = false;
  newFloorWidthM.value = 10.0;
  newFloorHeightM.value = 10.0;
  layoutStore.commit();
};

const cancelAddFloor = () => {
  showAddFloorModal.value = false;
  newFloorWidthM.value = 10.0;
  newFloorHeightM.value = 10.0;
};

// Expose methods to parent components
defineExpose({
  toggleFloorTabs: () => {
    toolsStore.toggleFloorTabs();
  },
  hideFloorTabs: () => {
    toolsStore.hideFloorTabs();
  },
});
</script>

<style scoped>
.floor-tabs-container {
  position: absolute;
  top: 0;
  left: 64px;
  width: calc(100% - 128px);
  margin-right: 64px;
}
</style>
