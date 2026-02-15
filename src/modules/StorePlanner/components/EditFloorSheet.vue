<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { storeToRefs } from "pinia";

const emit = defineEmits<{
  (e: "close"): void;
}>();

const layoutStore = useEditorLayout();

// Destructure reactive properties with storeToRefs
const { currentLayout, currentFloor } = storeToRefs(layoutStore);

const floorLevel = ref(currentFloor.value?.level || 1);
const floorName = ref(currentFloor.value?.name || "");
// Initialize in meters (store uses cm)
const widthM = ref((currentFloor.value?.width || 2000) / 100);
const heightM = ref((currentFloor.value?.height || 2000) / 100);

const surfaceArea = computed(() => {
  return (widthM.value * heightM.value).toFixed(2);
});

const adjustLevel = (delta: number) => {
  if (!currentLayout.value) return;
  let next = floorLevel.value + delta;
  if (next < 1) next = 1;

  // Check if level is taken by another floor
  const otherLevels = currentLayout.value.floors
    .filter((f) => f.id !== currentLayout.value?.currentFloorId)
    .map((f) => f.level);

  while (otherLevels.includes(next)) {
    next += delta;
    if (next < 1) {
      next = 1;
      break;
    }
  }
  floorLevel.value = next;
};

const handleUpdate = () => {
  if (!floorName.value) return;
  layoutStore.updateCurrentFloor({
    name: floorName.value,
    level: floorLevel.value,
    width: Math.round(widthM.value * 100),
    height: Math.round(heightM.value * 100),
  });
  emit("close");
};
</script>

<template>
  <div
    class="edit-floor-sheet p-6 bg-background rounded-t-[20px] shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.1)] border-x border-t border-border"
  >
    <div class="sheet-header flex items-center justify-between mb-6">
      <h2 class="sheet-title text-lg font-bold text-foreground">
        {{ t("storePlanner.editor.floors.editTitle") }}
      </h2>
      <Button
        variant="ghost"
        size="icon"
        @click="emit('close')"
        class="h-8 w-8 text-muted-foreground"
      >
        <IMdiClose class="w-5 h-5" />
      </Button>
    </div>

    <div class="sheet-body flex flex-col gap-5 overflow-y-auto h-[50vh]">
      <div class="form-group flex flex-col gap-2">
        <label
          class="form-label text-[13px] font-bold text-muted-foreground uppercase tracking-wider"
        >
          {{ t("storePlanner.editor.floors.nameLabel") }}
        </label>
        <Input v-model="floorName" class="h-11" />
      </div>

      <div class="form-group">
        <label class="form-label">{{ t("storePlanner.editor.floors.levelLabel") }}</label>
        <div class="stepper">
          <v-btn
            @click="adjustLevel(-1)"
            icon="mdi-minus"
            variant="text"
            density="compact"
            size="small"
            class="step-btn"
          />
          <span class="step-value">{{ floorLevel }}</span>
          <v-btn
            @click="adjustLevel(1)"
            icon="mdi-plus"
            variant="text"
            density="compact"
            size="small"
            class="step-btn"
          />
        </div>
      </div>

      <div class="dims-row d-flex ga-4">
        <div class="form-group flex-1-1">
          <label class="form-label">{{ t("storePlanner.editor.properties.width") }}</label>
          <v-text-field
            v-model.number="widthM"
            type="number"
            variant="outlined"
            density="comfortable"
            hide-details
            step="0.1"
          />
        </div>
        <div class="form-group flex-1-1">
          <label class="form-label">{{ t("storePlanner.editor.properties.height") }}</label>
          <v-text-field
            v-model.number="heightM"
            type="number"
            variant="outlined"
            density="comfortable"
            hide-details
            step="0.1"
          />
        </div>
      </div>

      <!-- Surface Area Display -->
      <div class="surface-area-box">
        <span class="surface-label">{{ t("storePlanner.setup.surfaceArea") }}</span>
        <span class="surface-value">{{ surfaceArea }} m²</span>
      </div>

      <v-btn
        @click="handleUpdate"
        class="submit-btn"
        :disabled="!floorName"
        color="primary"
        block
        size="default"
        variant="flat"
      >
        {{ t("storePlanner.editor.floors.saveChanges") }}
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
.edit-floor-sheet {
  border-bottom: none;
}
</style>
