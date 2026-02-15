<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";

const { t } = useI18n();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "floorAdded"): void;
}>();

const editorLayoutStore = useEditorLayout();
const { currentLayout } = storeToRefs(editorLayoutStore);

const getNextLevel = () => {
  if (!currentLayout.value) return 1;
  const levels = currentLayout.value.floors.map((f) => f.level);
  let next = 1;
  while (levels.includes(next)) next++;
  return next;
};

const floorLevel = ref(getNextLevel());
const floorName = ref(t("storePlanner.editor.floors.defaultName", { level: floorLevel.value }));
// Initialize in meters (store uses cm)
const widthM = ref((currentLayout.value?.width || 2000) / 100);
const heightM = ref((currentLayout.value?.height || 2000) / 100);

const surfaceArea = computed(() => {
  return (widthM.value * heightM.value).toFixed(2);
});

const adjustLevel = (delta: number) => {
  if (!currentLayout.value) return;
  const levels = currentLayout.value.floors.map((f) => f.level);
  let next = floorLevel.value + delta;
  if (next < 1) next = 1;

  while (levels.includes(next)) {
    next += delta;
    if (next < 1) {
      next = 1;
      break;
    }
  }
  floorLevel.value = next;
  // Auto update name if it follows the pattern
  if (
    floorName.value ===
    t("storePlanner.editor.floors.defaultName", {
      level: floorLevel.value - delta,
    })
  ) {
    floorName.value = t("storePlanner.editor.floors.defaultName", {
      level: floorLevel.value,
    });
  }
};

const handleCreate = async () => {
  if (!floorName.value) return;
  await editorLayoutStore.addFloor(
    floorName.value,
    floorLevel.value,
    Math.round(widthM.value * 100), // Convert back to cm
    Math.round(heightM.value * 100), // Convert back to cm
  );
  emit("floorAdded"); // Emit event to notify parent to refresh data
  emit("close");
};
</script>

<template>
  <div
    class="create-floor-sheet p-6 bg-background rounded-t-[20px] shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.1)] border-x border-t border-border"
  >
    <div class="sheet-header flex items-center justify-between mb-6">
      <h2 class="sheet-title text-lg font-bold text-foreground">
        {{ t("storePlanner.editor.floors.createTitle") }}
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
        @click="handleCreate"
        class="submit-btn"
        :disabled="!floorName"
        color="primary"
        block
        size="default"
        variant="flat"
      >
        {{ t("storePlanner.setup.addFloor") }}
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
.create-floor-sheet {
  border-bottom: none;
}
</style>
