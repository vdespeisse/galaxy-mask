<template>
  <component :is="svgComponent" v-if="svgComponent" :class="iconClass" :style="iconStyle" v-bind="$attrs" />
  <span v-else class="svg-icon-error">
    Icon "{{ name }}" not found
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'

interface Props {
  name: string
  size?: string | number
  color?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: '1em',
  color: 'currentColor'
})

const svgComponent = ref<string | null>(null)
const loadingError = ref<string | null>(null)

const iconClass = computed(() => {
  return ['svg-icon', props.class].filter(Boolean).join(' ')
})

const iconStyle = computed(() => {
  return {
    width: typeof props.size === 'number' ? `${props.size}px` : props.size,
    height: typeof props.size === 'number' ? `${props.size}px` : props.size,
    color: props.color,
    display: 'inline-block',
    verticalAlign: 'middle'
  }
})

watchEffect(async () => {
  try {
    // Dynamic import of the SVG file
    const module = await import(`../assets/${props.name}.svg`)
    svgComponent.value = module.default
    loadingError.value = null
  } catch (error) {
    console.error(`Failed to load SVG icon "${props.name}":`, error)
    svgComponent.value = null
    loadingError.value = `Icon "${props.name}" not found`
  }
})
</script>

<style scoped>
.svg-icon {
  display: inline-block;
  vertical-align: middle;
  line-height: 1;
}

.svg-icon :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.svg-icon-error {
  color: #ff4444;
  font-size: 0.875em;
  font-style: italic;
}
</style>
