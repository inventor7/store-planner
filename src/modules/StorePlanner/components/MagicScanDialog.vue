<script setup lang="ts">
import { useFloorPlanScanner } from "@/modules/StorePlanner/composables/useFloorPlanScanner";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const { isScanning, error, handleScan } = useFloorPlanScanner();
const emit = defineEmits(["close"]);
</script>

<template>
  <v-dialog :model-value="true" max-width="400" persistent>
    <v-card class="pa-4 rounded-xl d-flex flex-column align-center text-center">
      <div class="icon-circle mb-4">
        <v-icon color="primary" size="32">mdi-magic-staff</v-icon>
      </div>

      <h3 class="text-h6 font-weight-bold mb-2">
        {{ t("storePlanner.editor.magicScan.title") }}
      </h3>
      <p class="text-caption text-medium-emphasis mb-6">
        {{ t("storePlanner.editor.magicScan.description") }}
      </p>

      <div v-if="error" class="text-error text-caption mb-4">
        {{ error }}
      </div>

      <div class="d-flex flex-column gap-3 w-100">
        <v-btn
          color="primary"
          height="48"
          block
          rounded="xl"
          :loading="isScanning"
          @click="handleScan"
        >
          <v-icon start>mdi-camera</v-icon>
          {{ t("storePlanner.editor.magicScan.scanButton") }}
        </v-btn>

        <v-btn
          variant="text"
          height="48"
          block
          rounded="xl"
          :disabled="isScanning"
          @click="emit('close')"
        >
          {{ t("storePlanner.editor.magicScan.cancel") }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.icon-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}
.gap-3 {
  gap: 12px;
}
</style>
