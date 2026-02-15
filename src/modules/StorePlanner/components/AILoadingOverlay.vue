<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const steps = computed(() => [
  t("storePlanner.editor.toolbar.ai.steps.geometry"),
  t("storePlanner.editor.toolbar.ai.steps.walls"),
  t("storePlanner.editor.toolbar.ai.steps.ocr"),
  t("storePlanner.editor.toolbar.ai.steps.layout"),
  t("storePlanner.editor.toolbar.ai.steps.finalizing"),
]);

const currentStep = ref(0);

// Cycle through steps to simulate progress
let interval: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  interval = setInterval(() => {
    currentStep.value = (currentStep.value + 1) % steps.value.length;
  }, 1200); // Change text every 1.2s
});

onUnmounted(() => {
  if (interval) clearInterval(interval);
});
</script>

<template>
  <div
    class="ai-overlay fixed inset-0 z-10 backdrop-blur-xl bg-black/20 flex flex-col items-center justify-center overflow-hidden pointer-events-auto"
  >
    <div
      class="gemini-aurora absolute w-[200%] h-[200%] animate-[aurora-spin_8s_linear_infinite] blur-2xl opacity-100"
    />

    <div class="content-container relative z-10 flex flex-col items-center text-center">
      <IMdiCreation class="mb-2 sparkle-anim text-amber-300 w-12 h-12" />
      <h2 class="text-4xl font-bold text-white mb-2 shadow-sm">
        {{ t("storePlanner.editor.toolbar.ai.title") }}
      </h2>

      <div class="step-container">
        <transition name="fade-slide" mode="out-in">
          <p :key="currentStep" class="text-xl text-white font-light tracking-wide">
            {{ steps[currentStep] }}
          </p>
        </transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Big Dog Aurora Effect - Gemini Style */
.gemini-aurora {
  background: radial-gradient(
    circle at center,
    rgba(66, 133, 244, 0.6) 0%,
    rgba(156, 39, 176, 0.6) 30%,
    rgba(233, 30, 99, 0.6) 60%,
    transparent 80%
  );
  transform: translate(-25%, -25%);
}

@keyframes aurora-spin {
  0% {
    transform: translate(-25%, -25%) rotate(0deg);
  }
  100% {
    transform: translate(-25%, -25%) rotate(360deg);
  }
}

/* Text Transitions */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.5s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.sparkle-anim {
  animation: sparkle-spin 2s infinite ease-in-out;
}

@keyframes sparkle-spin {
  0% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.03);
    opacity: 1;
    filter: drop-shadow(0 0 10px rgba(255, 255, 0, 0.6));
  }
  100% {
    transform: scale(1);
    opacity: 0.8;
  }
}
</style>
