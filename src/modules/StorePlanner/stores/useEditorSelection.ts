import { defineStore } from "pinia";
import { ref } from "vue";

export const useEditorSelection = defineStore("editor-selection", () => {
  const selectedFixtureId = ref<string | null>(null);
  const selectedWallId = ref<string | null>(null);
  const selectedNodeId = ref<string | null>(null);
  const selectedWallForAttachment = ref<string | null>(null);

  const activeSelectedAreaId = ref<string | null>(null); // renamed to avoid conflict if I used selectedAreaId

  const selectFixture = (id: string | null) => {
    selectedFixtureId.value = id;
    if (id) {
      selectedWallId.value = null;
      selectedNodeId.value = null;
      activeSelectedAreaId.value = null;
    }
  };

  const selectWall = (id: string | null) => {
    selectedWallId.value = id;
    if (id) {
      selectedFixtureId.value = null;
      selectedNodeId.value = null;
      activeSelectedAreaId.value = null;
    }
  };

  const selectNode = (id: string | null) => {
    selectedNodeId.value = id;
    if (id) {
      selectedFixtureId.value = null;
      selectedWallId.value = null;
      activeSelectedAreaId.value = null;
    }
  };

  const selectArea = (id: string | null) => {
    activeSelectedAreaId.value = id;
    if (id) {
      selectedFixtureId.value = null;
      selectedWallId.value = null;
      selectedNodeId.value = null;
    }
  };

  const clearSelection = () => {
    selectedFixtureId.value = null;
    selectedWallId.value = null;
    selectedNodeId.value = null;
    activeSelectedAreaId.value = null;
  };

  return {
    selectedFixtureId,
    selectedWallId,
    selectedNodeId,
    selectedAreaId: activeSelectedAreaId, // Expose as selectedAreaId to match original API,
    selectedWallForAttachment,
    selectFixture,
    selectWall,
    selectNode,
    selectArea,
    deselectAll: clearSelection,
    clearSelection,
  };
});
