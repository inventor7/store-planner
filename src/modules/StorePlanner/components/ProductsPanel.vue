<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditorTools } from "@/modules/StorePlanner/stores/useEditorTools";
import { storeToRefs } from "pinia";
import { sampleProducts, productCategories } from "@/modules/StorePlanner/data/products";
import type { Product } from "@/modules/StorePlanner/types/editor";

defineProps<{
  isOpen: boolean;
  fixtureWidth: number;
  shelfSpaceHeight: number;
}>();

const toolsStore = useEditorTools();

// Destructure reactive properties with storeToRefs
const { isProductsPanelExpanded, placingProductId } = storeToRefs(toolsStore);

const isExpanded = computed({
  get: () => isProductsPanelExpanded.value,
  set: (val) => (isProductsPanelExpanded.value = val),
});

const toggleExpanded = () => {
  isProductsPanelExpanded.value = !isProductsPanelExpanded.value;
};

const selectedCategory = ref("all");
const draggedProduct = ref<Product | null>(null);

const filteredProducts = computed(() => {
  return sampleProducts.filter((p) => {
    return selectedCategory.value === "all" || p.category === selectedCategory.value;
  });
});

const handleDragStart = (e: DragEvent, product: Product) => {
  draggedProduct.value = product;
  placingProductId.value = product.id;
  e.dataTransfer?.setData("productId", product.id);
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "copy";
  }
};

const handleProductClick = (product: Product) => {
  if (placingProductId.value === product.id) {
    placingProductId.value = null;
  } else {
    placingProductId.value = product.id;
  }
};

const handleDragEnd = () => {
  draggedProduct.value = null;
};
</script>

<template>
  <Transition
    enter-active-class="transition-transform duration-300 ease-out"
    enter-from-class="translate-x-full"
    leave-active-class="transition-transform duration-300 ease-in"
    leave-to-class="translate-x-full"
  >
    <div
      v-if="isOpen"
      class="products-panel absolute top-0 right-0 w-64 bg-background/95 backdrop-blur-xl border-l border-b border-border flex flex-col shadow-2xl overflow-hidden pointer-events-auto rounded-bl-2xl z-50 max-h-[calc(100vh-40px)]"
      :class="{ 'h-auto': !isExpanded, 'max-h-[85vh]': !isExpanded }"
    >
      <!-- Header -->
      <div
        @click="toggleExpanded"
        class="products-header p-3 border-b border-border/50 cursor-pointer flex items-center justify-between hover:bg-accent/5 transition-colors"
      >
        <div class="header-left flex items-center gap-2">
          <div
            class="icon-wrapper w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"
          >
            <IMdiShopping class="w-4.5 h-4.5" />
          </div>
          <div class="title-group flex flex-col">
            <h3 class="panel-title text-sm font-bold leading-none text-foreground">
              Product Library
            </h3>
            <p class="panel-subtitle text-[10px] text-muted-foreground mt-0.5">
              {{ isExpanded ? "Select items to place" : "Click to expand" }}
            </p>
          </div>
        </div>
        <IMdiChevronDown
          class="expand-icon w-4 h-4 text-muted-foreground transition-transform duration-300"
          :class="{ 'rotate-180': isExpanded }"
        />
      </div>

      <!-- Collapsible Content -->
      <div v-if="isExpanded" class="products-content flex-1 flex flex-col min-h-0">
        <!-- Category Chips -->
        <div class="categories-wrapper p-2 px-3 border-b border-border/50">
          <div
            class="categories-list flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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

        <div
          class="products-list flex-1 overflow-y-auto p-2 px-3 flex flex-col gap-2 [scrollbar-width:thin]"
        >
          <div
            v-for="product in filteredProducts"
            :key="product.id"
            @click="handleProductClick(product)"
            class="product-item group flex items-center gap-3 p-2 rounded-lg border border-transparent transition-all cursor-pointer"
            :class="{
              'bg-primary/10 border-primary/30': placingProductId === product.id,
              'hover:bg-accent/5': placingProductId !== product.id,
            }"
          >
            <!-- Compact Visual -->
            <div
              draggable="true"
              @dragstart="(e) => handleDragStart(e, product)"
              @dragend="handleDragEnd"
              class="product-visual-box w-10 h-10 rounded-md bg-accent/30 flex items-center justify-center shrink-0 overflow-hidden cursor-grab active:cursor-grabbing"
            >
              <div
                class="product-rect w-4 h-6 rounded-sm shadow-sm"
                :style="{ backgroundColor: product.color }"
              />
            </div>

            <div class="product-info flex-1 min-w-0">
              <div
                class="product-name text-[11px] font-bold truncate text-foreground"
                :class="{ 'text-primary': placingProductId === product.id }"
              >
                {{ product.name }}
              </div>
              <div class="product-details text-[9px] text-muted-foreground">
                {{ product.width }}cm · ${{ product.price.toFixed(2) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Scoped styles removed in favor of Tailwind classes */
</style>
