<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{
  photos: { id: string; url: string; timestamp: string }[];
}>();

const emit = defineEmits<{
  (e: "take-photo"): void;
  (e: "remove-photo", id: string): void;
}>();

const viewingPhotoUrl = ref<string | null>(null);

// Dummy photo for demo purposes if empty
const DUMMY_PHOTO = {
  id: "dummy",
  url: "https://images.unsplash.com/photo-1506617420156-8e4536971650?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8c3RvcmUlMjBzaGVsZnxlbnwwfHwwfHx8MA%3D%3D",
  timestamp: new Date().toISOString(),
  isDummy: true,
};

const displayPhotos = computed(() => {
  if (props.photos.length === 0) return [DUMMY_PHOTO];
  return [...props.photos].reverse();
});
</script>

<template>
  <div
    class="photos-panel h-full w-20 flex flex-col items-center py-4 gap-3 bg-background/90 backdrop-blur-xl border-r border-border z-20"
  >
    <!-- Header -->
    <div
      class="photos-header text-[9px] font-black uppercase text-muted-foreground tracking-widest text-center"
    >
      Scans
    </div>

    <!-- Photo List -->
    <div
      class="photos-list flex-1 w-full flex flex-col items-center gap-3 overflow-y-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div
        v-for="photo in displayPhotos"
        :key="photo.id"
        class="photo-thumb group relative w-14 h-14 rounded-lg bg-accent/50 border-2 border-border overflow-hidden shrink-0 cursor-pointer transition-colors hover:border-primary"
        @click="viewingPhotoUrl = photo.url"
      >
        <img
          :src="photo.url"
          class="photo-img w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />

        <!-- Dummy Indicator -->
        <div
          v-if="(photo as any).isDummy"
          class="demo-badge absolute top-0 right-0 bg-amber-500/90 text-[6px] text-black font-bold px-1 rounded-bl-sm"
        >
          DEMO
        </div>

        <!-- Overlay -->
        <div
          class="photo-overlay absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
        >
          <Button
            v-if="!(photo as any).isDummy"
            variant="destructive"
            size="icon"
            class="h-6 w-6 rounded-md"
            @click.stop="emit('remove-photo', photo.id)"
          >
            <IMdiDelete class="w-3 h-3" />
          </Button>
          <IMdiFullscreen class="text-white w-4 h-4 drop-shadow-md" />
        </div>
      </div>
    </div>
  </div>

  <!-- Full Screen Preview Modal -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-200"
      leave-to-class="opacity-0"
    >
      <div
        v-if="viewingPhotoUrl"
        class="photo-modal fixed inset-0 z-200 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
        @click="viewingPhotoUrl = null"
      >
        <Button
          variant="ghost"
          size="icon"
          class="close-modal-btn absolute top-6 right-6 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
          @click="viewingPhotoUrl = null"
        >
          <IMdiClose class="w-6 h-6" />
        </Button>
        <img
          :src="viewingPhotoUrl"
          class="full-photo max-w-full max-h-full rounded-2xl shadow-2xl border border-white/10 select-none animate-in zoom-in-95 duration-200"
          @click.stop
        />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Scoped styles removed in favor of Tailwind classes */
</style>
