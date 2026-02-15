<script setup lang="ts">
import { ref } from "vue";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const layoutStore = useEditorLayout();
const toolsStore = useEditorTools();

// Destructure reactive properties with storeToRefs
const { canUndo, canRedo } = storeToRefs(layoutStore);
const { isViewModeOpen, isAIScanning } = storeToRefs(toolsStore);

const showClearDialog = ref(false);

const handleUndo = () => {
  layoutStore.undo();
};

const handleRedo = () => {
  layoutStore.redo();
};

const handleClear = () => {
  console.log("TopBar handleClear");
  if (typeof layoutStore.resetCurrentFloor === "function") {
    layoutStore.resetCurrentFloor();
  } else {
    console.error("resetCurrentFloor is not a function on layoutStore!", Object.keys(layoutStore));
    // Fallback if somehow it's missing but we want it to work
    if (layoutStore.currentLayout) {
      layoutStore.currentLayout.nodes = [];
      layoutStore.currentLayout.walls = [];
      layoutStore.currentLayout.fixtures = [];
      layoutStore.commit();
    }
  }
  showClearDialog.value = false;
};
</script>

<template>
  <div v-if="!isViewModeOpen" class="top-bar-container">
    <button
      v-if="isAIScanning"
      @click="$emit('open-magic-scan')"
      class="toolbar-btn"
      :title="t('storePlanner.editor.toolbar.aiScan')"
    >
      <IMdiMagicStaff class="w-5 h-5 text-purple-500" />
    </button>

    <div class="divider" />

    <button
      @click="handleUndo"
      :disabled="!canUndo"
      class="toolbar-btn"
      :title="t('storePlanner.editor.toolbar.undo')"
    >
      <IMdiUndo class="w-5 h-5" />
    </button>
    <button
      @click="handleRedo"
      :disabled="!canRedo"
      class="toolbar-btn"
      :title="t('storePlanner.editor.toolbar.redo')"
    >
      <IMdiRedo class="w-5 h-5" />
    </button>

    <div class="divider" />

    <Dialog v-model:open="showClearDialog">
      <DialogTrigger as-child>
        <button
          class="toolbar-btn text-destructive"
          :title="t('storePlanner.editor.toolbar.clearFloor')"
        >
          <IMdiDeleteOutline class="w-5 h-5" />
        </button>
      </DialogTrigger>
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{{ t("storePlanner.editor.toolbar.clearConfirmTitle") }}</DialogTitle>
          <DialogDescription>
            {{ t("storePlanner.editor.toolbar.clearConfirmMessage") }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="showClearDialog = false">
            {{ t("storePlanner.editor.magicScan.cancel") }}
          </Button>
          <Button variant="destructive" @click="handleClear">
            {{ t("storePlanner.editor.toolbar.clearAll") }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.top-bar-container {
  @apply fixed top-4 left-[78px] z-40 flex items-center gap-1 bg-background/90 backdrop-blur-md rounded-xl border border-border p-1 shadow-md;
}

.toolbar-btn {
  @apply flex items-center justify-center w-9 h-9 rounded-lg bg-transparent text-muted-foreground transition-all cursor-pointer border-none hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed;
}

.divider {
  @apply w-[1px] h-5 bg-border mx-0.5;
}
</style>
