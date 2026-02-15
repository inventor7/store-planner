<script setup lang="ts">
import { computed, ref } from "vue";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { useEditorSelection } from "@/modules/StorePlanner/stores/useEditorSelection";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { useEditorProducts } from "@/modules/StorePlanner/stores/useEditorProducts";
import { useEditorFixtures } from "@/modules/StorePlanner/stores/useEditorFixtures";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
import { getTemplateById } from "@/modules/StorePlanner/data/fixtureTemplates";
import { getProductById } from "@/modules/StorePlanner/data/products";
import TempRuler from "@/modules/StorePlanner/components/TempRuler.vue";
import type { Product, ShelfSlot } from "@/modules/StorePlanner/types/editor";

// Sub-components (will be migrated next)
import ProductsPanel from "./ProductsPanel.vue";
import SurveyPhotosPanel from "./SurveyPhotosPanel.vue";

const layoutStore = useEditorLayout();
const selectionStore = useEditorSelection();
const toolsStore = useEditorTools();
const productsStore = useEditorProducts();
const fixturesStore = useEditorFixtures();

// Destructure reactive properties with storeToRefs
const { currentLayout, customTemplates } = storeToRefs(layoutStore);
const { selectedFixtureId, selectedWallId, selectedNodeId } = storeToRefs(selectionStore);
const { editorMode, isRightPropertiesPanelExpanded } = storeToRefs(toolsStore);
const { selectedShelfLevelId, placingProductId, isProductsPanelExpanded } =
  storeToRefs(productsStore);

const isProductsPanelOpen = ref(true);
const userZoom = ref(1.0);

// Pinch Zoom State
const touchStartDist = ref(0);
const startZoom = ref(1);

const handleTouchStart = (e: TouchEvent) => {
  if (e.touches.length === 2) {
    const p1 = e.touches[0];
    const p2 = e.touches[1];
    if (p1 && p2) {
      touchStartDist.value = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      startZoom.value = userZoom.value;
    }
  }
};

const handleTouchMove = (e: TouchEvent) => {
  if (e.touches.length === 2) {
    const p1 = e.touches[0];
    const p2 = e.touches[1];
    if (p1 && p2) {
      const dist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      if (touchStartDist.value > 0) {
        const scale = dist / touchStartDist.value;
        userZoom.value = Math.min(Math.max(0.5, startZoom.value * scale), 5);
      }
    }
  }
};

const handleTouchEnd = () => {
  touchStartDist.value = 0;
};

const dragOverLevel = ref<string | null>(null);
const selectedSlotId = ref<string | null>(null);

const selectedFixture = computed(() => {
  if (!selectedFixtureId.value || !currentLayout.value) return null;
  return currentLayout.value.fixtures.find((f) => f.id === selectedFixtureId.value) || null;
});

const template = computed(() => {
  if (!selectedFixture.value) return null;
  let t = getTemplateById(selectedFixture.value.templateId);
  if (!t) {
    t = customTemplates.value.find((ct) => ct.id === selectedFixture.value?.templateId);
  }
  return t || null;
});

const isAnyRightPanelOpen = computed(() => {
  if (editorMode.value === "products") {
    return isProductsPanelOpen.value && isProductsPanelExpanded.value;
  }

  const hasSelection = !!(selectedFixtureId.value || selectedWallId.value || selectedNodeId.value);
  return hasSelection && isRightPropertiesPanelExpanded.value;
});

const showSurveyFeatures = computed(() => {
  return editorMode.value === "products" && !isProductsPanelExpanded.value && !selectedSlotId.value;
});

const surveyPhotos = computed(() => {
  return selectedFixture.value?.surveyPhotos || [];
});

const handleRemovePhoto = (id: string) => {
  if (selectedFixtureId.value) {
    fixturesStore.removeSurveyPhoto(selectedFixtureId.value, id);
  }
};

const areDoorsOpen = computed(() => {
  return editorMode.value === "products" && (isProductsPanelOpen.value || !!selectedSlotId.value);
});

const handleBackgroundClick = () => {
  productsStore.selectShelfLevel(null);
  selectedSlotId.value = null;
};

const baseScale = computed(() => {
  if (!selectedFixture.value) return 2.5;

  const rightPanelW = isAnyRightPanelOpen.value ? 320 : 0;
  const leftPanelW = showSurveyFeatures.value ? 220 : 0;

  const availableW = (window.innerWidth - rightPanelW - leftPanelW) * 0.95;
  const availableH = (window.innerHeight - 140) * 0.9;

  const fixtureW = selectedFixture.value.width || 100;
  const fixtureH = selectedFixture.value.height3D || 200;

  const scaleW = availableW / fixtureW;
  const scaleH = availableH / fixtureH;

  return Math.min(scaleW, scaleH, 8) * userZoom.value;
});

const widthPx = computed(() => (selectedFixture.value?.width || 100) * baseScale.value);
const heightPx = computed(() => (selectedFixture.value?.height3D || 200) * baseScale.value);

const levels = computed(() => {
  if (!selectedFixture.value?.contents?.levels) return [];
  return [...selectedFixture.value.contents.levels].sort(
    (a, b) => (a.height || 0) - (b.height || 0),
  );
});

const getFixtureColor = computed(() => {
  return selectedFixture.value?.customColor || template.value?.color || "#8B7355";
});

// Left Side Stats
const leftStats = computed(() => {
  if (!selectedFixture.value?.contents) return { skus: 0, avgPrice: 0, margin: 0 };

  const slots = selectedFixture.value.contents.levels
    .flatMap((l) => l.slots)
    .filter((s) => s.productId);
  const productIds = new Set(
    slots
      .map((s) => s.productId)
      .filter((pid) => {
        const p = getProductById(pid!);
        return p && p.category !== "Special" && p.category !== "Competitor";
      }),
  );

  const skus = productIds.size;

  let totalPrice = 0;
  let totalItems = 0;

  slots.forEach((slot) => {
    const p = getProductById(slot.productId!);
    if (!p || p.category === "Special" || p.category === "Competitor") return;
    const price = slot.customPrice ?? p.price ?? 0;
    const count = (slot.facings || 1) * (slot.depth || 1);
    totalPrice += price * count;
    totalItems += count;
  });

  const avgPrice = totalItems > 0 ? totalPrice / totalItems : 0;
  const margin = avgPrice * 0.35; // Simulation: 35% margin

  return {
    skus,
    avgPrice: Math.round(avgPrice * 10) / 10,
    margin: Math.round(margin * 10) / 10,
  };
});

const handleSpaceSelect = (id: string, e: Event) => {
  e.stopPropagation();

  if (editorMode.value === "products") {
    if (placingProductId.value) {
      const product = getProductById(placingProductId.value);
      if (product) {
        handleProductDrop(product, id);
        return;
      }
    }
  }

  if (selectedShelfLevelId.value === id) {
    productsStore.selectShelfLevel(null);
  } else {
    productsStore.selectShelfLevel(id);
  }
};

const handleProductDrop = (product: Product, levelId: string) => {
  if (!selectedFixtureId.value) return;

  const { valid } = productsStore.canPlaceProduct(product, levelId);
  if (!valid) return;

  const levelIdx = levels.value.findIndex((l) => l.id === levelId);
  if (levelIdx < 0) return;

  productsStore.addShelfSlot(selectedFixtureId.value, levelIdx);
  const level = levels.value[levelIdx];
  if (!level) return;

  const slotIdx = level.slots.length - 1;

  productsStore.updateShelfSlot(selectedFixtureId.value, levelIdx, slotIdx, {
    productId: product.id,
    facings: 1,
  });

  const slot = level.slots[slotIdx];
  if (slot) {
    selectedSlotId.value = slot.id;
    layoutStore.commit();
  }
};

const handleSlotClick = (e: Event, slotId: string) => {
  e.stopPropagation();
  if (selectedSlotId.value === slotId) {
    selectedSlotId.value = null;
  } else {
    selectedSlotId.value = slotId;
  }
};

const updateFacings = (delta: number) => {
  if (!selectedSlotId.value || !selectedFixtureId.value) return;

  let levelIdx = -1;
  let slotIdx = -1;

  levels.value.forEach((level, lIndex) => {
    const sIndex = level.slots.findIndex((s) => s.id === selectedSlotId.value);
    if (sIndex !== -1) {
      levelIdx = lIndex;
      slotIdx = sIndex;
    }
  });

  if (levelIdx === -1 || slotIdx === -1) return;

  const level = levels.value[levelIdx];
  if (!level) return;
  const slot = level.slots[slotIdx];
  if (!slot || !slot.productId) return;

  const product = getProductById(slot.productId);
  if (!product) return;

  const newFacings = Math.max(1, (slot.facings || 1) + delta);

  if (delta > 0) {
    const otherSlotsWidth = level.slots.reduce((sum, s) => {
      if (s.id === slot.id || !s.productId) return sum;
      const p = getProductById(s.productId);
      return sum + (p?.width || 0) * (s.facings || 1);
    }, 0);

    if (otherSlotsWidth + product.width * newFacings > (selectedFixture.value?.width || 100)) {
      return;
    }
  }

  productsStore.updateShelfSlot(selectedFixtureId.value, levelIdx, slotIdx, {
    facings: newFacings,
  });
  layoutStore.commit();
};

const updateSlotData = (updates: Partial<ShelfSlot>) => {
  if (!selectedSlotId.value || !selectedFixtureId.value) return;

  let levelIdx = -1;
  let slotIdx = -1;

  levels.value.forEach((level, lIndex) => {
    const sIndex = level.slots.findIndex((s) => s.id === selectedSlotId.value);
    if (sIndex !== -1) {
      levelIdx = lIndex;
      slotIdx = sIndex;
    }
  });

  if (levelIdx === -1 || slotIdx === -1) return;

  productsStore.updateShelfSlot(selectedFixtureId.value, levelIdx, slotIdx, updates);
  layoutStore.commit();
};

const totalProductsCount = computed(() => {
  if (!selectedFixture.value?.contents) return 0;
  return selectedFixture.value.contents.levels.reduce((acc, level) => {
    return (
      acc +
      level.slots.reduce((sAcc, slot) => {
        if (!slot.productId) return sAcc;
        return sAcc + (slot.facings || 1) * (slot.depth || 1);
      }, 0)
    );
  }, 0);
});

const totalValue = computed(() => {
  if (!selectedFixture.value?.contents) return 0;
  return selectedFixture.value.contents.levels.reduce((acc, level) => {
    return (
      acc +
      level.slots.reduce((sAcc, slot) => {
        if (!slot.productId) return sAcc;
        const product = getProductById(slot.productId);
        if (!product || product.category === "Special" || product.category === "Competitor")
          return sAcc;
        const price = slot.customPrice ?? product.price ?? 0;
        return sAcc + (slot.facings || 1) * (slot.depth || 1) * price;
      }, 0)
    );
  }, 0);
});

const volumeStats = computed(() => {
  if (!selectedFixture.value?.contents) return { myShare: 0, compShare: 0, filled: 0 };

  let myVol = 0;
  let compVol = 0;
  let totalCap = 0;

  const fixtureW = selectedFixture.value.width || 0;
  const fixtureH = selectedFixture.value.height3D || 0;
  const fixtureD = selectedFixture.value.height || 40;
  totalCap = fixtureW * fixtureH * fixtureD;

  selectedFixture.value.contents.levels.forEach((level) => {
    level.slots.forEach((slot) => {
      if (!slot.productId) return;
      const product = getProductById(slot.productId);
      if (!product) return;

      const pWa = product.width;
      const pHa = product.height;
      const pDa = 10;

      const vol = pWa * pHa * pDa * (slot.facings || 1) * (slot.depth || 1);

      if (product.category === "Competitor") {
        compVol += vol;
      } else if (product.category !== "Special") {
        myVol += vol;
      }
    });
  });

  if (totalCap === 0) totalCap = 1;

  return {
    myShare: Math.round((myVol / totalCap) * 100),
    compShare: Math.round((compVol / totalCap) * 100),
    filled: Math.round(((myVol + compVol) / totalCap) * 100),
  };
});

const isTempOpen = ref(false);
const closeTempTimeout = ref<number | null>(null);

const toggleTempControl = () => {
  isTempOpen.value = !isTempOpen.value;
  if (isTempOpen.value) {
    resetTempTimer();
  }
};

const handleTempChange = (val: number) => {
  if (selectedFixture.value) {
    fixturesStore.updateFixture(selectedFixture.value.id, {
      temperature: val,
    });
    resetTempTimer();
  }
};

const resetTempTimer = () => {
  if (closeTempTimeout.value) clearTimeout(closeTempTimeout.value);
  closeTempTimeout.value = window.setTimeout(() => {
    isTempOpen.value = false;
  }, 2000);
};

const removeSelectedSlot = () => {
  if (!selectedSlotId.value || !selectedFixtureId.value) return;

  levels.value.forEach((level, lIndex) => {
    const sIndex = level.slots.findIndex((s) => s.id === selectedSlotId.value);
    if (sIndex !== -1) {
      productsStore.removeShelfSlot(selectedFixtureId.value!, lIndex, sIndex);
    }
  });

  selectedSlotId.value = null;
  layoutStore.commit();
};

const handleShelfDragOver = (e: DragEvent, levelId: string) => {
  e.preventDefault();

  const productId = e.dataTransfer?.getData("productId") || placingProductId.value;
  if (!productId) return;

  const product = getProductById(productId);
  if (!product) return;

  const { valid } = productsStore.canPlaceProduct(product, levelId);
  if (valid) {
    dragOverLevel.value = levelId;
  } else {
    dragOverLevel.value = "invalid-" + levelId;
  }
};

const handleShelfDrop = (e: DragEvent, levelId: string) => {
  dragOverLevel.value = null;
  const productId = e.dataTransfer?.getData("productId") || placingProductId.value;
  if (!productId) return;

  const product = getProductById(productId);
  if (!product) return;

  handleProductDrop(product, levelId);
};

const getProductShape = (category: string) => {
  switch (category) {
    case "Beverages":
      return "bottle";
    case "Snacks":
      return "bag";
    case "Dairy":
      return "carton";
    case "Canned":
      return "can";
    case "Frozen":
      return "box";
    case "Personal Care":
      return "tube";
    default:
      return "box";
  }
};

// Shelf height ruler control
const isShelfHeightRulerOpen = ref(false);
const shelfHeightRulerTimeout = ref<number | null>(null);

const selectedShelfLevel = computed(() => {
  if (!selectedFixtureId.value || !selectedShelfLevelId.value) return null;
  const fixture = currentLayout.value?.fixtures.find((f) => f.id === selectedFixtureId.value);
  if (!fixture?.contents?.levels) return null;
  return fixture.contents.levels.find((l) => l.id === selectedShelfLevelId.value);
});

const shelfHeightBounds = computed(() => {
  if (!selectedFixtureId.value || !selectedShelfLevelId.value || !selectedFixture.value?.contents) {
    return { min: 10, max: 200, current: 0, prevHeight: 0 };
  }

  const sortedLevels = [...selectedFixture.value.contents.levels].sort(
    (a, b) => a.height - b.height,
  );
  const currentIndex = sortedLevels.findIndex((l) => l.id === selectedShelfLevelId.value);

  if (currentIndex === -1) return { min: 10, max: 200, current: 0, prevHeight: 0 };

  const prevHeight = currentIndex > 0 ? sortedLevels[currentIndex - 1]?.height || 0 : 0;
  const currentHeight = selectedShelfLevel.value?.height || 0;
  const nextHeight =
    currentIndex < sortedLevels.length - 1
      ? sortedLevels[currentIndex + 1]?.height || 0
      : selectedFixture.value.height3D || 200;

  const minSpacing = 10;
  const thickness = 2;

  // Calculate the gap/spacing from previous shelf
  const currentGap = currentHeight - prevHeight;
  const maxGap = nextHeight - prevHeight - minSpacing - thickness;

  return {
    min: minSpacing + thickness,
    max: maxGap,
    current: currentGap,
    prevHeight: prevHeight,
  };
});

const handleShelfHeightChange = (newGap: number) => {
  if (!selectedFixtureId.value || !selectedShelfLevelId.value || !selectedFixture.value?.contents)
    return;

  // Convert gap to absolute height
  const newAbsoluteHeight = shelfHeightBounds.value.prevHeight + newGap;

  const newLevels = selectedFixture.value.contents.levels.map((l) => {
    if (l.id === selectedShelfLevelId.value) {
      return { ...l, height: newAbsoluteHeight };
    }
    return l;
  });

  productsStore.updateFixtureContents(selectedFixtureId.value, {
    levels: newLevels,
  });
  layoutStore.commit();

  resetShelfHeightTimer();
};

const resetShelfHeightTimer = () => {
  if (shelfHeightRulerTimeout.value) clearTimeout(shelfHeightRulerTimeout.value);
  shelfHeightRulerTimeout.value = window.setTimeout(() => {
    isShelfHeightRulerOpen.value = false;
  }, 3000);
};

// Open ruler when shelf is selected
watch(selectedShelfLevelId, (newVal) => {
  if (newVal) {
    isShelfHeightRulerOpen.value = true;
    resetShelfHeightTimer();
  } else {
    isShelfHeightRulerOpen.value = false;
  }
});
</script>

<template>
  <div
    class="faceviewer-container relative h-full w-full flex flex-col items-center justify-center p-2 pt-0 overflow-hidden touch-none select-none bg-background/50"
    @click="handleBackgroundClick"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- Left Survey Photos Panel -->
    <Transition name="slide-fade-left">
      <div v-if="showSurveyFeatures" class="left-panel-wrapper absolute left-0 top-0 bottom-0 z-40">
        <SurveyPhotosPanel :photos="surveyPhotos" @remove-photo="handleRemovePhoto" />
      </div>
    </Transition>

    <ProductsPanel
      v-if="editorMode === 'products'"
      :is-open="isProductsPanelOpen"
      :fixture-width="selectedFixture?.width || 100"
      :shelf-space-height="40"
      @close="isProductsPanelOpen = false"
      @drop="handleProductDrop"
    />

    <div
      class="viewer-main"
      :class="{
        '-translate-x-40': isAnyRightPanelOpen,
        '-translate-x-5': showSurveyFeatures,
      }"
    >
      <div v-if="selectedFixture && template" class="canvas-wrapper" @click.stop>
        <div class="render-root">
          <div class="render-column">
            <!-- 2D Fixture Render -->
            <div
              class="fixture-body relative rounded-[2px] border-t-8 border-l-4 border-r-4 border-foreground/5 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] transition-all duration-75"
              :style="{
                width: `${widthPx}px`,
                height: `${heightPx}px`,
                backgroundColor: getFixtureColor,
              }"
            >
              <!-- Dimension Labels -->
              <!-- Width Label (Bottom) -->
              <div
                class="dim-label dim-bottom absolute -bottom-8 inset-x-0 flex flex-col items-center opacity-60 pointer-events-none"
              >
                <div class="dim-line-h w-full h-px bg-primary/40"></div>
                <div class="flex items-center gap-2">
                  <span class="dim-hint text-[8px] font-black uppercase tracking-widest opacity-40"
                    >Width</span
                  >
                  <span class="dim-text font-mono text-xs font-bold text-primary tabular-nums"
                    >{{ selectedFixture?.width }}cm</span
                  >
                </div>
              </div>

              <!-- Height Label (Left) -->
              <div
                class="dim-label dim-left absolute -left-16 inset-y-0 flex items-center opacity-60 pointer-events-none"
              >
                <div class="dim-line-v w-px h-full bg-primary/40"></div>
                <div
                  class="flex flex-col items-center justify-center -rotate-90 whitespace-nowrap gap-2"
                >
                  <span
                    class="dim-hint-v text-[8px] font-black uppercase tracking-widest opacity-40"
                    >Height</span
                  >
                  <span class="dim-text-v font-mono text-xs font-bold text-primary tabular-nums"
                    >{{ selectedFixture?.height3D }}cm</span
                  >
                </div>
              </div>

              <!-- Shine -->
              <div
                class="shine-overlay absolute inset-0 bg-linear-to-tr from-foreground/10 via-transparent to-surface/5 pointer-events-none"
              ></div>

              <!-- Temperature Control -->
              <div
                v-if="template?.category === 'fridges' && selectedFixture"
                class="temp-control absolute top-2 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center"
              >
                <button
                  @click="toggleTempControl"
                  class="temp-badge border border-foreground/10 flex items-center gap-1 p-[2px_8px] bg-background backdrop-blur-md rounded-full transition-colors hover:bg-surface/90"
                >
                  <div class="temp-dots grid grid-cols-2 gap-px">
                    <div class="temp-dot w-[2px] h-[2px] bg-destructive rounded-full pulse-1"></div>
                    <div class="temp-dot w-[2px] h-[2px] bg-destructive rounded-full pulse-2"></div>
                    <div class="temp-dot w-[2px] h-[2px] bg-destructive rounded-full pulse-3"></div>
                  </div>
                  <span
                    class="temp-value font-mono text-[10px] font-bold text-destructive tracking-widest"
                    >{{ selectedFixture.temperature || 4 }}°C</span
                  >
                </button>

                <div
                  v-if="isTempOpen"
                  class="bg-background mt-2 p-1 backdrop-blur-md border border-foreground/10 rounded-lg shadow-lg"
                >
                  <TempRuler
                    :modelValue="selectedFixture.temperature || 4"
                    @update:modelValue="handleTempChange"
                    @change="resetTempTimer"
                  />
                </div>
              </div>

              <!-- Shelf Height Control -->
              <div
                v-if="selectedShelfLevelId && isShelfHeightRulerOpen"
                class="shelf-height-control absolute top-2 right-2 z-50 flex flex-col items-end"
              >
                <div
                  class="shelf-height-label flex items-center gap-1 px-3 py-1 bg-background backdrop-blur-sm rounded-full border border-primary/30 shadow-[0_4px_12px_rgba(var(--primary),0.2)]"
                >
                  <IMdiArrowExpandVertical class="w-4 h-4 text-primary" />
                  <span
                    class="shelf-height-value font-mono text-[11px] font-bold text-primary tracking-tight"
                    >{{ Math.round(shelfHeightBounds.current) }}cm</span
                  >
                </div>
                <div
                  class="shelf-height-popover mt-2 p-1 bg-background backdrop-blur-md border border-primary/20 rounded-lg shadow-lg"
                >
                  <TempRuler
                    :modelValue="shelfHeightBounds.current"
                    @update:modelValue="handleShelfHeightChange"
                    @change="resetShelfHeightTimer"
                    :min="shelfHeightBounds.min"
                    :max="shelfHeightBounds.max"
                  />
                </div>
              </div>

              <!-- Left Side Stats -->
              <div
                v-if="showSurveyFeatures"
                class="side-stats side-left absolute top-0 -left-32 flex flex-col gap-3"
              >
                <div
                  class="stat-card w-24 p-2 bg-surface/90 backdrop-blur-md border border-foreground/10 rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col items-center text-center"
                >
                  <span
                    class="stat-label text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5"
                    >{{ t("storePlanner.editor.faceView.range") }}</span
                  >
                  <span
                    class="stat-value text-base font-black text-foreground tabular-nums leading-none"
                    >{{ leftStats.skus }}</span
                  >
                  <span class="stat-sub text-[8px] font-bold text-muted-foreground">{{
                    t("storePlanner.editor.faceView.skus")
                  }}</span>
                </div>
                <div
                  class="stat-card w-24 p-2 bg-surface/90 backdrop-blur-md border border-foreground/10 rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col items-center text-center"
                >
                  <span
                    class="stat-label text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5"
                    >Avg. Price</span
                  >
                  <span
                    class="stat-value text-base font-black text-success tabular-nums leading-none"
                    >${{ leftStats.avgPrice }}</span
                  >
                </div>
                <div
                  class="stat-card w-24 p-2 bg-surface/90 backdrop-blur-md border border-foreground/10 rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col items-center text-center"
                >
                  <span
                    class="stat-label text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5"
                    >{{ t("storePlanner.editor.faceView.expROI") }}</span
                  >
                  <span class="stat-value text-base font-black text-info tabular-nums leading-none"
                    >${{ leftStats.margin }}</span
                  >
                  <span class="stat-sub text-[8px] font-bold text-muted-foreground">{{
                    t("storePlanner.editor.faceView.margin")
                  }}</span>
                </div>
              </div>

              <!-- Right Side Stats -->
              <div
                v-if="showSurveyFeatures"
                class="side-stats side-right absolute top-0 -right-32 flex flex-col gap-3"
              >
                <div
                  class="stat-card w-24 p-2 bg-surface/90 backdrop-blur-md border border-foreground/10 rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col items-center text-center"
                >
                  <span
                    class="stat-label text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5"
                    >{{ t("storePlanner.editor.faceView.stock") }}</span
                  >
                  <span
                    class="stat-value text-base font-black text-foreground tabular-nums leading-none"
                    >{{ totalProductsCount }}</span
                  >
                </div>
                <div
                  class="stat-card w-24 p-2 bg-surface/90 backdrop-blur-md border border-foreground/10 rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col items-center text-center"
                >
                  <span
                    class="stat-label text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5"
                    >Value</span
                  >
                  <span
                    class="stat-value text-base font-black text-success tabular-nums leading-none"
                    >${{ Math.round(totalValue) }}</span
                  >
                </div>
                <div
                  class="stat-card w-24 p-2 bg-surface/90 backdrop-blur-md border border-foreground/10 rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col items-center text-center gap-1.5"
                >
                  <span
                    class="stat-label text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5"
                    >{{ t("storePlanner.editor.faceView.volShare") }}</span
                  >
                  <div class="vol-row w-full flex flex-col gap-0.5">
                    <div
                      class="vol-info flex justify-between text-[8px] font-bold text-muted-foreground"
                    >
                      <span>{{ t("storePlanner.editor.faceView.me") }}</span
                      ><span>{{ volumeStats.myShare }}%</span>
                    </div>
                    <div class="vol-bar h-1 w-full bg-foreground/10 rounded-full overflow-hidden">
                      <div
                        class="vol-fill h-full rounded-full bg-primary"
                        :style="{ width: `${volumeStats.myShare}%` }"
                      ></div>
                    </div>
                  </div>
                  <div class="vol-row w-full flex flex-col gap-0.5">
                    <div
                      class="vol-info flex justify-between text-[8px] font-bold text-muted-foreground"
                    >
                      <span>{{ t("storePlanner.editor.faceView.comp") }}</span
                      ><span>{{ volumeStats.compShare }}%</span>
                    </div>
                    <div class="vol-bar h-1 w-full bg-foreground/10 rounded-full overflow-hidden">
                      <div
                        class="vol-fill h-full rounded-full bg-destructive"
                        :style="{ width: `${volumeStats.compShare}%` }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Shelves Rendering -->
              <div class="shelves-container absolute inset-0">
                <template v-for="(level, idx) in levels" :key="level.id">
                  <!-- Shelf Plate -->
                  <div
                    class="shelf-plate absolute inset-x-0 h-1 bg-foreground/20 w-full z-10 pointer-events-none"
                    :style="{
                      bottom: `${
                        (idx === levels.length - 1
                          ? selectedFixture.height3D || 200
                          : level.height || 0) * baseScale
                      }px`,
                    }"
                  ></div>

                  <!-- Clickable Space -->
                  <div
                    class="shelf-space absolute inset-x-0 w-full cursor-pointer transition-all duration-200 z-0 flex items-end justify-start overflow-hidden"
                    :class="{
                      'bg-primary/15 shadow-[inset_0_0_0_2px_rgba(var(--primary),0.4)]':
                        selectedShelfLevelId === level.id,
                      'bg-success/20 shadow-[inset_0_0_0_2px_rgba(var(--success),0.4)]':
                        dragOverLevel === level.id,
                      'bg-destructive/20 shadow-[inset_0_0_0_2px_rgba(var(--destructive),0.4)] cursor-not-allowed':
                        dragOverLevel === 'invalid-' + level.id,
                    }"
                    :style="{
                      bottom: idx === 0 ? '0px' : `${(levels[idx - 1]?.height || 0) * baseScale}px`,
                      height: `${
                        ((idx === levels.length - 1
                          ? selectedFixture.height3D || 200
                          : level.height || 0) -
                          (idx === 0 ? 0 : levels[idx - 1]?.height || 0)) *
                        baseScale
                      }px`,
                    }"
                    @click="(e) => handleSpaceSelect(level.id, e)"
                    @dragover="handleShelfDragOver($event, level.id)"
                    @dragleave="dragOverLevel = null"
                    @drop="handleShelfDrop($event, level.id)"
                  >
                    <template v-if="level.slots">
                      <div
                        v-for="slot in level.slots.filter(
                          (s) => s.productId && editorMode === 'products',
                        )"
                        :key="slot.id"
                        class="slot-wrapper relative flex flex-col items-center justify-end h-full shrink-0"
                        :style="{
                          width: `${(getProductById(slot.productId!)?.width || 8) * baseScale * slot.facings}px`,
                        }"
                        @click="(e) => handleSlotClick(e, slot.id)"
                      >
                        <div
                          class="slot-visual relative w-full flex flex-nowrap items-end justify-center overflow-hidden border-x border-foreground/5"
                          :style="{
                            height: `${Math.min((getProductById(slot.productId!)?.height || 15) * baseScale, ((idx === levels.length - 1 ? selectedFixture.height3D || 200 : level.height || 0) - (idx === 0 ? 0 : levels[idx - 1]?.height || 0)) * baseScale - 4)}px`,
                          }"
                        >
                          <div
                            v-for="f in slot.facings"
                            :key="f"
                            class="product-facing h-full rounded-sm shadow-sm relative overflow-hidden flex-1 border-r border-black/10 flex items-end justify-center transition-transform duration-100 active:scale-95 last:border-r-0"
                            :class="{
                              'shadow-[0_0_0_6px_rgba(var(--primary),1)] z-20':
                                selectedSlotId === slot.id,
                            }"
                            :style="{
                              backgroundColor: getProductById(slot.productId!)?.color || '#888',
                            }"
                          >
                            <!-- Shape Overlays -->
                            <template v-if="slot.productId">
                              <template
                                v-if="getProductById(slot.productId!)?.category === 'Special'"
                              >
                                <div
                                  class="gap-visual absolute inset-0 border-2 border-dashed border-foreground/20 flex items-center justify-center"
                                >
                                  <span
                                    class="gap-text text-[8px] font-bold text-foreground/30 uppercase -rotate-45"
                                    >Gap</span
                                  >
                                </div>
                              </template>
                              <template
                                v-else-if="
                                  getProductById(slot.productId!)?.category === 'Competitor'
                                "
                              >
                                <div
                                  class="comp-visual absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(var(--foreground),0.1),rgba(var(--foreground),0.1)_4px,rgba(var(--foreground),0.05)_4px,rgba(var(--foreground),0.05)_8px)] opacity-20"
                                ></div>
                              </template>
                              <template v-else>
                                <div
                                  v-if="
                                    getProductShape(
                                      getProductById(slot.productId!)?.category || '',
                                    ) === 'bottle'
                                  "
                                  class="shape-bottle absolute top-0 left-[25%] right-[25%] h-1/5 bg-black/10 rounded-[2px_2px_0_0]"
                                ></div>
                                <div
                                  v-if="
                                    getProductShape(
                                      getProductById(slot.productId!)?.category || '',
                                    ) === 'can'
                                  "
                                  class="shape-can absolute top-0 left-0 right-0 h-[8%] bg-black/10"
                                ></div>
                                <div
                                  v-if="
                                    getProductShape(
                                      getProductById(slot.productId!)?.category || '',
                                    ) === 'bag'
                                  "
                                  class="shape-bag absolute top-1/20 left-[10%] right-[10%] h-[5%] bg-white/10 rounded-t-full"
                                ></div>
                              </template>
                            </template>
                            <!-- Generic Label -->
                            <div
                              class="product-label absolute top-[30%] inset-x-[15%] h-1/4 bg-surface/40 rounded-sm flex flex-col items-center justify-center gap-[2px]"
                            >
                              <div class="w-4/5 h-px bg-foreground/5"></div>
                              <div class="w-3/5 h-px bg-foreground/5"></div>
                            </div>
                            <!-- Shine -->
                            <div
                              class="product-shine absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-transparent pointer-events-none"
                            ></div>
                          </div>
                        </div>

                        <!-- Facings Label -->
                        <div
                          v-if="
                            editorMode === 'products' &&
                            slot.facings > 1 &&
                            selectedSlotId !== slot.id
                          "
                          class="facings-badge absolute -bottom-1 left-1/2 -translate-x-1/2 bg-surface/80 text-foreground text-[8px] font-bold px-1 rounded-full pointer-events-none"
                        >
                          x{{ slot.facings }}
                        </div>
                      </div>
                    </template>
                  </div>
                </template>
              </div>

              <!-- Fridge Doors -->
              <div
                v-if="template?.category === 'fridges'"
                class="fridge-doors absolute inset-0 flex border-4 border-foreground/10 pointer-events-none [perspective:1000px]"
              >
                <div
                  v-for="(d, idx) in template?.doors || 1"
                  :key="d"
                  class="fridge-door flex-1 border-x border-foreground/20 bg-info/5 backdrop-blur-[1px] relative transition-all duration-700 ease-in-out"
                  :class="{
                    'opacity-30': areDoorsOpen,
                    '[transform-origin:left_center]': idx === 0,
                    '[transform-origin:right_center]': idx !== 0,
                    '-rotate-y-[105deg]': areDoorsOpen && idx === 0,
                    'rotate-y-[105deg]': areDoorsOpen && idx !== 0,
                  }"
                >
                  <div
                    class="door-shine absolute inset-0 bg-linear-to-br from-surface/10 to-transparent opacity-30"
                  ></div>
                  <div
                    class="door-handle absolute top-1/2 -translate-y-1/2 w-1.5 h-20 bg-muted-foreground/50 rounded-full transition-opacity duration-700"
                    :class="[idx === 0 ? 'right-3' : 'left-3', { 'opacity-0': areDoorsOpen }]"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Floating Toolbar -->
      <div
        v-if="editorMode === 'products' && selectedSlotId"
        class="floating-toolbar absolute bottom-0 left-1/2 -translate-x-1/2 bg-surface/95 backdrop-blur-md border border-foreground/10 rounded-t-2xl p-2 flex items-center gap-2 z-120 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
        @click.stop
      >
        <div
          class="toolbar-group flex items-center bg-foreground/5 border border-foreground/10 rounded-lg p-1"
        >
          <button
            @click="updateFacings(-1)"
            class="tool-btn w-12 h-12 flex items-center justify-center text-foreground rounded-lg transition-colors hover:bg-foreground/10 text-2xl font-bold"
          >
            -
          </button>
          <div class="tool-info flex flex-col items-center min-w-[40px]">
            <span class="tool-label text-[8px] font-bold text-muted-foreground uppercase"
              >Facings</span
            ><span class="tool-value text-sm font-bold text-foreground tabular-nums">{{
              levels.flatMap((l) => l.slots).find((s) => s.id === selectedSlotId)?.facings
            }}</span>
          </div>
          <button
            @click="updateFacings(1)"
            class="tool-btn w-12 h-12 flex items-center justify-center text-foreground rounded-lg transition-colors hover:bg-foreground/10 text-2xl font-bold"
          >
            +
          </button>
        </div>

        <div
          class="toolbar-group flex items-center bg-foreground/5 border border-foreground/10 rounded-lg p-1"
        >
          <button
            @click="
              updateSlotData({
                depth: Math.max(
                  1,
                  (levels.flatMap((l) => l.slots).find((s) => s.id === selectedSlotId)?.depth ||
                    1) - 1,
                ),
              })
            "
            class="tool-btn w-12 h-12 flex items-center justify-center text-foreground rounded-lg transition-colors hover:bg-foreground/10 text-2xl font-bold"
          >
            -
          </button>
          <div class="tool-info flex flex-col items-center min-w-[40px]">
            <span class="tool-label text-[8px] font-bold text-muted-foreground uppercase"
              >Depth</span
            ><span class="tool-value text-sm font-bold text-foreground tabular-nums">{{
              levels.flatMap((l) => l.slots).find((s) => s.id === selectedSlotId)?.depth || 1
            }}</span>
          </div>
          <button
            @click="
              updateSlotData({
                depth:
                  (levels.flatMap((l) => l.slots).find((s) => s.id === selectedSlotId)?.depth ||
                    1) + 1,
              })
            "
            class="tool-btn w-12 h-12 flex items-center justify-center text-foreground rounded-lg transition-colors hover:bg-foreground/10 text-2xl font-bold"
          >
            +
          </button>
        </div>

        <div
          class="toolbar-group price-group flex items-center bg-foreground/5 border border-foreground/10 rounded-lg p-1"
        >
          <div class="tool-info flex flex-col items-center min-w-[40px]">
            <span class="tool-label text-[8px] font-bold text-muted-foreground uppercase"
              >Price</span
            >
            <div class="price-input flex items-center gap-1">
              <span class="text-[10px] text-muted-foreground">$</span>
              <input
                type="number"
                step="0.01"
                class="bg-transparent border-none border-b border-foreground/10 text-foreground text-sm font-bold w-12 text-center focus:outline-none focus:border-primary"
                :value="
                  levels.flatMap((l) => l.slots).find((s) => s.id === selectedSlotId)
                    ?.customPrice ??
                  getProductById(
                    levels.flatMap((l) => l.slots).find((s) => s.id === selectedSlotId)
                      ?.productId || '',
                  )?.price
                "
                @input="
                  (e) =>
                    updateSlotData({
                      customPrice: parseFloat((e.target as HTMLInputElement).value),
                    })
                "
              />
            </div>
          </div>
        </div>

        <button
          @click="
            updateSlotData({
              fences:
                (levels.flatMap((l) => l.slots).find((s) => s.id === selectedSlotId)?.fences || 0) +
                1,
            })
          "
          class="tool-action-btn flex flex-col items-center justify-center px-3 h-11 bg-foreground/5 border border-foreground/10 rounded-lg cursor-pointer transition-colors hover:bg-foreground/10"
        >
          <span class="tool-label text-[8px] font-bold text-muted-foreground uppercase">Fence</span>
          <div class="tool-row flex items-center gap-1">
            <IMdiLayersTriple class="w-4 h-4 text-primary" />
            <span class="tool-value text-sm font-bold text-foreground tabular-nums">{{
              levels.flatMap((l) => l.slots).find((s) => s.id === selectedSlotId)?.fences || 0
            }}</span>
          </div>
        </button>

        <div class="divider-v w-px h-8 bg-foreground/10 mx-1"></div>

        <button
          @click="removeSelectedSlot"
          class="delete-btn w-11 h-11 flex items-center justify-center text-destructive border border-destructive/20 rounded-xl transition-all hover:bg-destructive/10"
        >
          <IMdiDelete class="w-6 h-6" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
.pulse-1 {
  animation: pulse 1.5s infinite;
}
.pulse-2 {
  animation: pulse 1.5s infinite 0.2s;
}
.pulse-3 {
  animation: pulse 1.5s infinite 0.4s;
}

.slide-fade-left-enter-active {
  transition: all 0.3s ease-out;
}
.slide-fade-left-leave-active {
  transition: all 0.3s ease-in;
}
.slide-fade-left-enter-from,
.slide-fade-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}
</style>
