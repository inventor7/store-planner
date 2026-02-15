<script setup lang="ts">
import { Toaster } from "@/shared/components/ui/sonner";
</script>

<template>
  <RouterView />
  <Toaster position="top-center" :duration="4000" richColors />
</template>
