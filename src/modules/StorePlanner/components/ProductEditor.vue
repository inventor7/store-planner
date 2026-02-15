<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditorLayout } from "@/modules/StorePlanner/stores/useEditorLayout";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { useEditorProducts } from "@/modules/StorePlanner/stores/useEditorProducts";
import { storeToRefs } from "pinia";
import { getTemplateById } from "@/modules/StorePlanner/data/fixtureTemplates";
import {
  sampleProducts,
  productCategories,
  getProductById,
} from "@/modules/StorePlanner/data/products";

const layoutStore = useEditorLayout();
const toolsStore = useEditorTools();
const productsStore = useEditorProducts();

// Destructure reactive properties with storeToRefs
const { currentLayout } = storeToRefs(layoutStore);
const { isProductEditorOpen, editingFixtureId } = storeToRefs(toolsStore);

const selectedCategory = ref("all");
const searchQuery = ref("");
const activeSlot = ref<{ level: number; slot: number } | null>(null);

const fixture = computed(() =>
  currentLayout.value?.fixtures.find((f) => f.id === editingFixtureId.value),
);
const template = computed(() => (fixture.value ? getTemplateById(fixture.value.templateId) : null));

const contents = computed(() => fixture.value?.contents);

const filteredProducts = computed(() => {
  const products = sampleProducts.filter((p) => {
    const matchesCategory =
      selectedCategory.value === "all" || p.category === selectedCategory.value;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.value.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return products;
});

const handleProductSelect = (productId: string | null) => {
  if (activeSlot.value && editingFixtureId.value) {
    productsStore.updateShelfSlot(
      editingFixtureId.value,
      activeSlot.value.level,
      activeSlot.value.slot,
      { productId },
    );
    activeSlot.value = null;
  }
};

const handleTogglePriceLabel = (levelIndex: number, slotIndex: number) => {
  if (editingFixtureId.value && contents.value) {
    const slot = contents.value.levels[levelIndex]?.slots[slotIndex];
    if (slot) {
      productsStore.updateShelfSlot(editingFixtureId.value, levelIndex, slotIndex, {
        priceLabel: !slot.priceLabel,
      });
    }
  }
};

const handleFacingsChange = (levelIndex: number, slotIndex: number, delta: number) => {
  if (editingFixtureId.value && contents.value) {
    const slot = contents.value.levels[levelIndex]?.slots[slotIndex];
    if (slot) {
      const newFacings = Math.max(1, Math.min(10, slot.facings + delta));
      productsStore.updateShelfSlot(editingFixtureId.value, levelIndex, slotIndex, {
        facings: newFacings,
      });
    }
  }
};
</script>

<template>
  <Transition name="fade">
    <div
      v-if="isProductEditorOpen && fixture && template && contents"
      class="product-editor-overlay fixed inset-0 z-1000 bg-background flex"
    >
      <div class="editor-container flex-1 flex flex-col">
        <!-- Header -->
        <div
          class="editor-header flex items-center justify-between p-4 px-6 border-b border-border"
        >
          <div class="header-left flex items-center gap-2">
            <IMdiPackageVariantClosed class="w-5 h-5" />
            <h2 class="header-title text-lg font-bold text-foreground">
              {{ template.name }} - Product Editor
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="h-9 w-9 rounded-full text-muted-foreground hover:bg-accent"
            @click="toolsStore.closeProductEditor"
          >
            <IMdiClose class="w-5 h-5" />
          </Button>
        </div>

        <div class="editor-main flex-1 flex overflow-hidden">
          <!-- Shelf visualization -->
          <div class="shelf-view flex-1 p-6 overflow-y-auto bg-accent/5">
            <div class="levels-container flex flex-col gap-6">
              <div
                v-for="(level, levelIndex) in contents.levels"
                :key="level.id"
                class="level-item relative"
              >
                <div class="level-header flex items-center gap-3 mb-2">
                  <span class="level-label text-xs font-black uppercase text-muted-foreground">
                    Level {{ contents.levels.length - levelIndex }}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    class="h-5 w-5 rounded-md border-muted-foreground/30 text-muted-foreground hover:bg-accent hover:text-foreground"
                    @click="
                      editingFixtureId && productsStore.addShelfSlot(editingFixtureId, levelIndex)
                    "
                  >
                    <IMdiPlus class="w-3 h-3" />
                  </Button>
                </div>

                <!-- Shelf bar -->
                <div class="shelf-bar h-2 w-full bg-[#4e342e] rounded shadow-md" />

                <!-- Slots container -->
                <div class="slots-row flex gap-2 min-h-[80px] bg-accent/10 rounded-b-lg p-3">
                  <div
                    v-for="(slot, slotIndex) in level.slots"
                    :key="slot.id"
                    @click="activeSlot = { level: levelIndex, slot: slotIndex }"
                    class="slot-box relative flex-1 min-w-[80px] max-w-[140px] h-20 rounded-lg border-2 transition-all bg-background cursor-pointer"
                    :class="{
                      'border-primary bg-primary/5':
                        activeSlot?.level === levelIndex && activeSlot?.slot === slotIndex,
                      'border-border/50 shadow-sm': slot.productId,
                      'border-dashed border-border flex items-center justify-center bg-transparent':
                        !slot.productId,
                      'hover:border-primary/30': !(
                        activeSlot?.level === levelIndex && activeSlot?.slot === slotIndex
                      ),
                    }"
                  >
                    <div
                      v-if="slot.productId"
                      class="floor-pattern absolute inset-0 opacity-10 bg-[url('@/assets/checker-pattern.png')] bg-size-[10px_10px]"
                    />
                    <div
                      v-else
                      class="floor-grid absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-size-[20px_20px]"
                    />
                    <div
                      v-if="slot.productId"
                      class="slot-product p-1 h-full flex flex-col relative"
                    >
                      <div
                        class="product-swatch flex-1 rounded font-bold text-[10px] text-white flex items-center justify-center"
                        :style="{
                          backgroundColor: getProductById(slot.productId)?.color,
                        }"
                      >
                        x{{ slot.facings }}
                      </div>
                      <div
                        class="product-name-mini text-[8px] text-center mt-1 truncate text-foreground"
                      >
                        {{ getProductById(slot.productId)?.name }}
                      </div>
                      <div
                        v-if="slot.priceLabel"
                        class="price-tag absolute bottom-[-4px] left-1/2 -translate-x-1/2 bg-amber-400 text-black text-[8px] font-black px-1 rounded-full shadow-md z-10"
                      >
                        ${{ getProductById(slot.productId)?.price.toFixed(2) }}
                      </div>
                    </div>
                    <IMdiPlus v-else class="w-4 h-4 text-muted-foreground/30" />

                    <!-- Slot controls -->
                    <div
                      v-if="activeSlot?.level === levelIndex && activeSlot?.slot === slotIndex"
                      class="slot-quick-actions absolute top-[-10px] right-[-10px] flex gap-1 z-20"
                    >
                      <button
                        @click.stop="handleTogglePriceLabel(levelIndex, slotIndex)"
                        class="action-circle w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-sm"
                        :class="
                          slot.priceLabel ? 'bg-amber-400 text-black' : 'bg-slate-500 text-white'
                        "
                      >
                        <IMdiTag class="w-3 h-3" />
                      </button>
                      <button
                        v-if="level.slots.length > 1"
                        @click.stop="
                          () => {
                            if (editingFixtureId) {
                              productsStore.removeShelfSlot(
                                editingFixtureId,
                                levelIndex,
                                slotIndex,
                              );
                            }
                            activeSlot = null;
                          }
                        "
                        class="action-circle w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center transition-transform hover:scale-110 shadow-sm"
                      >
                        <IMdiDelete class="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Product selection panel -->
          <div class="product-sidebar w-[300px] flex flex-col bg-background border-l border-border">
            <div class="sidebar-header p-4 flex flex-col gap-3 border-b border-border/50">
              <div class="relative group">
                <IMdiMagnify
                  class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                />
                <Input v-model="searchQuery" placeholder="Search products..." class="pl-9 h-9" />
              </div>

              <div
                class="cat-chips flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <Badge
                  @click="selectedCategory = 'all'"
                  :variant="selectedCategory === 'all' ? 'default' : 'secondary'"
                  class="cursor-pointer font-bold px-3 py-0.5 rounded-full whitespace-nowrap"
                >
                  All
                </Badge>
                <Badge
                  v-for="cat in productCategories"
                  :key="cat"
                  @click="selectedCategory = cat"
                  :variant="selectedCategory === cat ? 'default' : 'secondary'"
                  class="cursor-pointer font-bold px-3 py-0.5 rounded-full whitespace-nowrap"
                >
                  {{ cat }}
                </Badge>
              </div>
            </div>

            <div class="sidebar-list flex-1 overflow-y-auto p-2 flex flex-col gap-1">
              <!-- Empty space option -->
              <button
                @click="handleProductSelect(null)"
                :disabled="!activeSlot"
                class="sidebar-item group flex items-center gap-3 p-2 rounded-lg transition-all border border-transparent hover:bg-accent/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div
                  class="item-visual w-8 h-8 rounded bg-accent flex items-center justify-center text-muted-foreground shrink-0"
                >
                  <IMdiClose class="w-4 h-4" />
                </div>
                <div class="item-info flex-1 text-left">
                  <div class="item-name text-sm font-bold text-foreground leading-tight">
                    Empty Space
                  </div>
                  <div class="item-sub text-[10px] text-muted-foreground">Remove product</div>
                </div>
              </button>

              <button
                v-for="product in filteredProducts"
                :key="product.id"
                @click="handleProductSelect(product.id)"
                :disabled="!activeSlot"
                class="sidebar-item group flex items-center gap-3 p-2 rounded-lg transition-all border border-transparent hover:bg-accent/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div
                  class="item-visual w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold shrink-0"
                  :style="{ backgroundColor: product.color }"
                >
                  {{ product.name.charAt(0) }}
                </div>
                <div class="item-info flex-1 text-left min-w-0">
                  <div class="item-name text-sm font-bold text-foreground truncate leading-tight">
                    {{ product.name }}
                  </div>
                  <div
                    class="item-sub-row flex justify-between text-[10px] text-muted-foreground mt-0.5"
                  >
                    <span class="truncate">{{ product.sku }}</span>
                    <span class="font-black text-foreground ml-2"
                      >${{ product.price.toFixed(2) }}</span
                    >
                  </div>
                </div>
              </button>
            </div>

            <!-- Facings control when slot selected -->
            <div
              v-if="
                activeSlot && contents.levels[activeSlot.level]?.slots[activeSlot.slot]?.productId
              "
              class="sidebar-footer p-4 border-t border-border bg-accent/5"
            >
              <div class="facings-row flex items-center justify-between">
                <span class="footer-label text-xs font-black uppercase text-foreground"
                  >Facings</span
                >
                <div class="stepper flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    class="h-7 w-7 rounded-md"
                    @click="handleFacingsChange(activeSlot.level, activeSlot.slot, -1)"
                  >
                    <IMdiMinus class="w-3.5 h-3.5" />
                  </Button>
                  <span class="step-value text-sm font-bold w-5 text-center">
                    {{ contents.levels[activeSlot.level]?.slots[activeSlot.slot]?.facings }}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    class="h-7 w-7 rounded-md"
                    @click="handleFacingsChange(activeSlot.level, activeSlot.slot, 1)"
                  >
                    <IMdiPlus class="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
