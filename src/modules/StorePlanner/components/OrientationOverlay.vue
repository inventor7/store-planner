<script setup lang="ts">
import { useScreenOrientation } from "@vueuse/core";
import { computed } from "vue";

const { orientation } = useScreenOrientation();
const isPortrait = computed(() => orientation.value?.startsWith("portrait"));
</script>

<template>
  <Transition name="fade">
    <div
      v-if="isPortrait"
      class="orientation-overlay fixed inset-0 z-50 bg-background/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
    >
      <div
        class="rotate-icon-wrapper w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 animate-bounce"
      >
        <IMdiScreenRotation class="rotate-icon w-8 h-8 text-primary" />
      </div>
      <h2 class="overlay-title text-xl font-bold mb-2 text-foreground">Rotate Your Device</h2>
      <p class="overlay-text text-sm text-muted-foreground max-w-[250px] mx-auto">
        For the best experience, please rotate your device to landscape mode.
      </p>
    </div>
  </Transition>
</template>

<style scoped>
@keyframes bounce {
  0%,
  20%,
  50%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-20px);
  }
  60% {
    transform: translateY(-10px);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
