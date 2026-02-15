<script setup lang="ts">
import { ref } from "vue";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";

const props = defineProps<{
  onExit: () => void;
}>();

const emit = defineEmits(["toggle-floor-tabs"]);

const toolsStore = useEditorTools();
const layoutStore = useEditorLayout();

const { editorMode, isAIScanning, isAIEnabled, zoom, globalSnackbar, isMagicScanOpen } =
  storeToRefs(toolsStore);

const snackbarText = ref("");

const handleExit = () => {
  layoutStore.saveCurrentLayout();
  props.onExit();
};

const handleSave = async () => {
  await layoutStore.saveCurrentLayout();

  // Snapshot Logic - Export full Konva stage content
  try {
    if (!toolsStore.takeSnapshot) {
      throw new Error("Snapshot function not available");
    }

    // Call the snapshot function registered by KonvaCanvas
    const pngDataUrl = await toolsStore.takeSnapshot();

    if (!pngDataUrl) {
      throw new Error("Failed to generate snapshot");
    }

    const fileName = `store-layout-${
      layoutStore.currentLayout?.name || "snapshot"
    }-${Date.now()}.png`;

    if (Capacitor.isNativePlatform()) {
      // Mobile: Share via native share sheet
      try {
        const base64Data = pngDataUrl.split(",")[1];
        if (!base64Data) {
          throw new Error("Failed to extract base64 data");
        }

        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        await Share.share({
          title: "Store Layout Snapshot",
          files: [result.uri],
        });

        snackbarText.value = t("storePlanner.editor.toolbar.snapshotShared");
      } catch (err: unknown) {
        const error = err as Error;
        console.error("Native share failed:", error);
        snackbarText.value = "Share failed: " + error.message;
      }
    } else {
      // Web: Download PNG file
      const a = document.createElement("a");
      a.download = fileName;
      a.href = pngDataUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      snackbarText.value = t("storePlanner.editor.toolbar.snapshotDownloaded");
    }
  } catch (e) {
    console.error("Snapshot generation failed:", e);
    snackbarText.value = t("storePlanner.editor.toolbar.snapshotFailed");
  }

  globalSnackbar.value = {
    show: true,
    text: snackbarText.value,
    color: "success",
  };
};

const handleAI = () => {
  isMagicScanOpen.value = !isMagicScanOpen.value;
};

const toggleFloorTabs = () => {
  emit("toggle-floor-tabs");
};
</script>

<template>
  <aside class="left-toolbar bg-background/95 backdrop-blur-xl border-r border-border">
    <div class="section-scrollable gap-3 p-2">
      <button
        v-if="editorMode === 'design' && isAIEnabled"
        @click="handleAI"
        class="toolbar-btn transition-colors hover:bg-accent hover:text-accent-foreground"
        :class="{ 'bg-primary text-primary-foreground shadow-lg': isAIScanning }"
        :title="t('storePlanner.editor.toolbar.aiAssistant')"
      >
        <IMdiCreation class="w-5 h-5" />
        <span class="btn-label">{{ t("storePlanner.editor.toolbar.aiAssistant") }}</span>
      </button>

      <div v-if="editorMode === 'design'" class="w-full bg-border shadow-sm my-1"></div>

      <button
        @click="toggleFloorTabs"
        class="toolbar-btn transition-colors hover:bg-accent hover:text-accent-foreground"
        :title="t('storePlanner.editor.toolbar.floors')"
      >
        <IMdiLayers class="w-5 h-5" />
        <span class="btn-label">{{ t("storePlanner.editor.toolbar.floors") }}</span>
      </button>

      <button
        @click="handleSave"
        class="toolbar-btn transition-colors hover:bg-accent hover:text-accent-foreground"
        :title="t('storePlanner.editor.toolbar.share')"
      >
        <IMdiShare class="w-5 h-5 text-primary" />
        <span class="btn-label">{{ t("storePlanner.editor.toolbar.share") }}</span>
      </button>

      <button
        @click="handleExit"
        class="toolbar-btn transition-colors hover:bg-accent hover:text-accent-foreground"
        :title="t('storePlanner.editor.toolbar.exit')"
      >
        <IMdiLogout class="w-5 h-5" />
        <span class="btn-label">{{ t("storePlanner.editor.toolbar.exit") }}</span>
      </button>
    </div>

    <!-- 4. Fixed Bottom: Zoom % & Settings -->
    <div class="section-fixed toolbar-footer bg-background/50">
      <div class="w-full h-px bg-border my-0"></div>
      <button
        @click="toolsStore.resetView"
        class="toolbar-btn zoom-percent-btn transition-colors hover:bg-accent"
        :title="t('storePlanner.editor.toolbar.resetZoom')"
      >
        <span class="zoom-value text-primary font-bold text-xs">{{ Math.round(zoom * 100) }}%</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.left-toolbar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 50;
  user-select: none;
  overflow: hidden;
  height: 100%;
  padding-top: max(var(--safe-area-inset-top), 8px);
}

.section-fixed {
  flex-shrink: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
  gap: 4px;
  z-index: 2;
}

.section-scrollable {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.section-scrollable::-webkit-scrollbar {
  display: none;
}

/* Tool Buttons */
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
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.02em;
}

.zoom-percent-btn {
  height: 48px;
}
</style>
