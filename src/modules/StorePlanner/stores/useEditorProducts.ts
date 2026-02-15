import { defineStore } from "pinia";
import { ref } from "vue";
import { useEditorLayout } from "./useEditorLayout";
import { useEditorSelection } from "./useEditorSelection";
import { useEditorTools } from "./useEditorTools";
import { generateId } from "@/modules/StorePlanner/utils/editorUtils";
import { getTemplateById as getStaticTemplateById } from "@/modules/StorePlanner/data/fixtureTemplates";

import { getProductById } from "@/modules/StorePlanner/data/products";
import type { FixtureContents, ShelfSlot, Product } from "@/modules/StorePlanner/types/editor";

export const useEditorProducts = defineStore("editor-products", () => {
  const layoutStore = useEditorLayout();
  const selectionStore = useEditorSelection();
  const toolsStore = useEditorTools();

  // State
  const isProductEditorOpen = ref(false);
  const editingFixtureId = ref<string | null>(null);
  const selectedShelfLevelId = ref<string | null>(null);
  const placingProductId = ref<string | null>(null);
  const isProductsPanelExpanded = ref(true);

  // Actions
  const openProductEditor = (fixtureId: string) => {
    isProductEditorOpen.value = true;
    editingFixtureId.value = fixtureId;
  };

  const closeProductEditor = () => {
    isProductEditorOpen.value = false;
    editingFixtureId.value = null;
  };

  const selectShelfLevel = (id: string | null) => {
    selectedShelfLevelId.value = id;
  };

  const updateFixtureContents = async (fixtureId: string, contents: FixtureContents) => {
    if (!layoutStore.currentLayout) return;
    const fixture = layoutStore.currentLayout.fixtures.find((f) => f.id === fixtureId);
    if (fixture) {
      fixture.contents = contents;
      layoutStore.commit();
    }
  };

  const updateShelfSlot = async (
    fixtureId: string,
    levelIndex: number,
    slotIndex: number,
    updates: Partial<ShelfSlot>,
  ) => {
    if (!layoutStore.currentLayout) return;
    const fixture = layoutStore.currentLayout.fixtures.find((f) => f.id === fixtureId);
    if (!fixture?.contents) return;

    const slot = fixture.contents.levels[levelIndex]?.slots[slotIndex];
    if (slot) {
      Object.assign(slot, updates);
      layoutStore.commit();
    }
  };

  const addShelfSlot = async (fixtureId: string, levelIndex: number) => {
    if (!layoutStore.currentLayout) return;
    const fixture = layoutStore.currentLayout.fixtures.find((f) => f.id === fixtureId);
    if (!fixture?.contents) return;

    const level = fixture.contents.levels[levelIndex];
    if (level) {
      level.slots.push({
        id: generateId(),
        productId: null,
        facings: 1,
        depth: 1,
        fences: 0,
        priceLabel: false,
      });
      layoutStore.commit();
    }
  };

  const removeShelfSlot = async (fixtureId: string, levelIndex: number, slotIndex: number) => {
    if (!layoutStore.currentLayout) return;
    const fixture = layoutStore.currentLayout.fixtures.find((f) => f.id === fixtureId);
    if (!fixture?.contents) return;

    const level = fixture.contents.levels[levelIndex];
    if (level) {
      level.slots.splice(slotIndex, 1);
      layoutStore.commit();
    }
  };

  const canPlaceProduct = (product: Product, levelId: string) => {
    if (!layoutStore.currentLayout || !selectionStore.selectedFixtureId) return { valid: false };

    const fixture = layoutStore.currentLayout.fixtures.find(
      (f) => f.id === selectionStore.selectedFixtureId,
    );
    if (!fixture?.contents) return { valid: false };

    const levelIdx = fixture.contents.levels.findIndex((l) => l.id === levelId);
    if (levelIdx === -1) return { valid: false };

    const level = fixture.contents.levels[levelIdx];
    if (!level) return { valid: false };
    const prevLevel = levelIdx > 0 ? fixture.contents.levels[levelIdx - 1] : null;

    const spaceHeight = (level.height || 0) - (prevLevel?.height || 0);
    const usedWidth = level.slots.reduce((sum, slot) => {
      if (!slot.productId) return sum;
      const p = getProductById(slot.productId);
      return sum + (p?.width || 0) * slot.facings;
    }, 0);

    const availableWidth = (fixture.width || 100) - usedWidth;
    const fitsHeight = product.height <= spaceHeight;
    const fitsWidth = product.width <= availableWidth;

    return {
      fitsHeight,
      fitsWidth,
      valid: fitsHeight && fitsWidth,
      spaceHeight,
      availableWidth,
    };
  };

  return {
    isProductEditorOpen,
    editingFixtureId,
    selectedShelfLevelId,
    placingProductId,
    isProductsPanelExpanded,
    openProductEditor,
    closeProductEditor,
    selectShelfLevel,
    updateFixtureContents,
    updateShelfSlot,
    addShelfSlot,
    removeShelfSlot,
    canPlaceProduct,
  };
});
