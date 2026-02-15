<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";

const { t } = useI18n();

const editorLayoutStore = useEditorLayout();
const { currentLayout } = storeToRefs(editorLayoutStore);

const floors = computed(() => currentLayout.value?.floors || []);
const currentFloorId = computed(() => currentLayout.value?.currentFloorId);

const handleSwitchFloor = (id: string) => {
  editorLayoutStore.switchFloor(id);
};

const handleDeleteFloor = (id: string) => {
  if (confirm(t("storePlanner.editor.floors.deleteConfirm"))) {
    editorLayoutStore.deleteFloor(id);
  }
};
</script>

<template>
  <div class="floor-list flex flex-col gap-3">
    <div class="floor-header pb-2 border-b border-border">
      <h3 class="floor-title text-[10px] font-black uppercase text-muted-foreground tracking-wider">
        {{ t("storePlanner.editor.toolbar.floors") }}
      </h3>
    </div>

    <div class="floor-items flex flex-col gap-1.5">
      <div
        v-for="floor in floors"
        :key="floor.id"
        class="floor-item group flex items-center justify-between p-2 px-3 rounded-lg bg-accent/30 cursor-pointer transition-all border border-transparent hover:bg-accent/50"
        :class="{ 'bg-primary/10 border-primary/30': currentFloorId === floor.id }"
        @click="handleSwitchFloor(floor.id)"
      >
        <div class="floor-info flex items-center gap-2">
          <span
            class="floor-level text-[10px] font-black bg-accent/50 px-1.5 py-0.5 rounded-md min-w-[24px] text-center"
            :class="{ 'text-primary bg-primary/20': currentFloorId === floor.id }"
          >
            L{{ floor.level }}
          </span>
          <span
            class="floor-name text-[13px] font-bold truncate max-w-[100px]"
            :class="{ 'text-primary': currentFloorId === floor.id }"
          >
            {{ floor.name }}
          </span>
        </div>

        <Button
          v-if="floors.length > 1"
          variant="ghost"
          size="icon"
          class="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
          @click.stop="handleDeleteFloor(floor.id)"
        >
          <IMdiDelete class="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
