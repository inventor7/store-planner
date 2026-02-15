<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { ref } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const editorToolsStore = useEditorTools();
const layoutStore = useEditorLayout();

const { isLibraryOpen, editorMode, isReadonly } = storeToRefs(editorToolsStore);
const { canUndo, canRedo } = storeToRefs(layoutStore);

const showClearConfirm = ref(false);

const handleClearAll = async () => {
  showClearConfirm.value = true;
};

const confirmClear = async () => {
  showClearConfirm.value = false;
  await layoutStore.resetCurrentFloor();
};

const cancelClear = () => {
  showClearConfirm.value = false;
};

interface Props {
  onExit?: () => void;
}

defineProps<Props>();
</script>

<template>
  <div class="right-toolbar-container h-full">
    <div
      class="mode-toolbar flex flex-col justify-between items-center p-2 gap-2 shadow-lg bg-background/95 backdrop-blur-md border-l border-border pointer-events-auto"
    >
      <!-- Top Section: Action Buttons -->
      <div class="top-actions gap-3 flex flex-col items-center w-full">
        <button
          v-if="!isReadonly && editorMode === 'design'"
          @click.stop="editorToolsStore.openLibrary()"
          class="toolbar-btn transition-colors hover:bg-accent hover:text-accent-foreground"
          :class="{ 'bg-primary text-primary-foreground shadow-md': isLibraryOpen }"
          :title="t('storePlanner.editor.toolbar.addFixture')"
        >
          <IMdiPlusBox class="w-7 h-7 text-primary" />
          <span class="btn-label">{{ t("storePlanner.editor.toolbar.addFixture") }}</span>
        </button>

        <button
          v-if="editorMode === 'design'"
          @click="layoutStore.undo"
          :disabled="!canUndo"
          class="toolbar-btn transition-colors hover:bg-accent disabled:opacity-30 disabled:pointer-events-none"
          :title="t('storePlanner.editor.toolbar.undo')"
        >
          <IMdiUndo class="w-5 h-5" />
          <span class="btn-label">{{ t("storePlanner.editor.toolbar.undo") }}</span>
        </button>
        <button
          v-if="editorMode === 'design'"
          @click="layoutStore.redo"
          :disabled="!canRedo"
          class="toolbar-btn transition-colors hover:bg-accent disabled:opacity-30 disabled:pointer-events-none"
          :title="t('storePlanner.editor.toolbar.redo')"
        >
          <IMdiRedo class="w-5 h-5" />
          <span class="btn-label">{{ t("storePlanner.editor.toolbar.redo") }}</span>
        </button>

        <button
          v-if="editorMode === 'design'"
          @click="handleClearAll"
          class="toolbar-btn text-destructive transition-colors hover:bg-destructive/10"
          :title="t('storePlanner.editor.toolbar.clearFloor')"
        >
          <IMdiDeleteOutline class="w-5 h-5" />
          <span class="btn-label">{{ t("storePlanner.editor.toolbar.clearFloor") }}</span>
        </button>
      </div>

      <!-- Bottom Section: Mode Toggle Button -->
      <button
        @click="
          !isReadonly &&
          editorToolsStore.setEditorMode(
            editorToolsStore.editorMode === 'design' ? 'survey' : 'design',
          )
        "
        class="toolbar-btn transition-transform hover:-translate-y-1"
        :class="{
          'bg-primary text-primary-foreground': editorToolsStore.editorMode === 'survey',
          'opacity-50 cursor-not-allowed': isReadonly,
        }"
        :disabled="isReadonly"
        :title="
          isReadonly
            ? t('storePlanner.editor.toolbar.readonly') // Assuming key exists or fallback
            : editorToolsStore.editorMode === 'design'
              ? t('storePlanner.editor.toolbar.switchToSurvey')
              : t('storePlanner.editor.toolbar.switchToDesign')
        "
      >
        <component
          :is="
            editorToolsStore.editorMode === 'design'
              ? 'IMdiViewDashboardEdit'
              : 'IMdiClipboardCheck'
          "
          class="w-5 h-5"
        />
        <span class="btn-label">
          {{
            editorToolsStore.editorMode === "design"
              ? t("storePlanner.editor.toolbar.design")
              : t("storePlanner.editor.toolbar.survey")
          }}
        </span>
      </button>
    </div>

    <!-- Clear Confirmation Dialog -->
    <Dialog v-model:open="showClearConfirm">
      <DialogContent class="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{{ t("storePlanner.editor.clearDialog.title") }}</DialogTitle>
          <DialogDescription>
            {{ t("storePlanner.editor.clearDialog.message") }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="cancelClear">
            {{ t("storePlanner.editor.clearDialog.cancel") }}
          </Button>
          <Button variant="destructive" @click="confirmClear"> Clear All </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.right-toolbar-container {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  pointer-events: none;
  display: flex;
  flex-direction: row-reverse;
}

.mode-toolbar {
  width: 64px;
}

.toolbar-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  cursor: pointer;
}

.btn-label {
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.02em;
}
</style>
