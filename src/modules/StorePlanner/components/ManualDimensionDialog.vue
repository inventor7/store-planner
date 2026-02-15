<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  initialValue: number;
  title: string;
  unit: string;
}>();

const emit = defineEmits<{
  (e: "save", value: number): void;
  (e: "close"): void;
}>();

const { t } = useI18n();
const inputValue = ref(props.initialValue);
const inputRef = ref<HTMLInputElement | null>(null);

onMounted(() => {
  inputRef.value?.focus();
  inputRef.value?.select();
});

const handleSave = () => {
  if (typeof inputValue.value === "number") {
    emit("save", inputValue.value);
  }
};
</script>

<template>
  <div
    class="dimension-dialog-overlay fixed inset-0 bg-black/40 backdrop-blur-md z-10000 flex items-center justify-center p-4"
    @click.self="emit('close')"
  >
    <div
      class="dimension-card bg-background p-6 rounded-[20px] w-[320px] border border-border/50 shadow-2xl"
    >
      <div class="flex items-center justify-between mb-4">
        <span class="text-[10px] font-bold tracking-widest text-primary uppercase">{{
          title
        }}</span>
        <Button
          variant="ghost"
          size="icon"
          class="h-8 w-8 text-muted-foreground"
          @click="emit('close')"
        >
          <IMdiClose class="w-4 h-4" />
        </Button>
      </div>

      <div class="input-container relative flex items-baseline">
        <input
          ref="inputRef"
          v-model.number="inputValue"
          type="number"
          class="dimension-input w-full text-5xl font-extrabold border-b-2 border-primary outline-none text-center bg-transparent py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          @keydown.enter="handleSave"
          @keydown.escape="emit('close')"
        />
        <span class="unit-label text-lg font-semibold text-muted-foreground ml-2">{{ unit }}</span>
      </div>

      <div class="flex justify-end mt-6 gap-2">
        <Button variant="ghost" @click="emit('close')">
          {{ t("storePlanner.common.cancel") }}
        </Button>
        <Button @click="handleSave">
          {{ t("storePlanner.common.apply") }}
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No extra styles needed beyond Tailwind classes for this layout */
</style>
