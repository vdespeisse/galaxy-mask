<script setup lang="ts">
import KeyCap from './KeyCap.vue'

interface Props {
  keys: string[]
}

const props = defineProps<Props>()
</script>

<template>
  <div class="flex items-center gap-1">
    <template v-for="(key, index) in keys" :key="index">
      <KeyCap :keyName="key" />
      <span v-if="index < keys.length - 1" class="text-slate-400">+</span>
    </template>
  </div>
</template>
