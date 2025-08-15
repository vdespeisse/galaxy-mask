<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from './SvgIcon.vue'

interface Props {
  modelValue: string
  value: string
  icon: string
  label?: string
  number?: number
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  number: undefined
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isActive = computed(() => props.modelValue === props.value)

const handleClick = () => {
  emit('update:modelValue', props.value)
}
</script>

<template>
  <button @click="handleClick"
    class="tool-button rounded-md transition-all duration-200 flex flex-col items-center gap-1 min-w-[32px] cursor-pointer relative"
    :class="isActive
      ? 'bg-emerald-300 text-emerald-900'
      : 'bg-white text-slate-600 hover:bg-emerald-100 hover:text-emerald-800'">
    <SvgIcon :name="icon" size="18" />
    <span v-if="label" class="text-xs font-medium">{{ label }}</span>
    <span v-if="number" class="number-indicator absolute font-medium text-slate-500">
      {{ number }}
    </span>
  </button>
</template>

<style scoped>
.number-indicator {
  bottom: 2px;
  right: 2px;
  font-size: 10px;
}

.tool-button {
  padding: 10px;
}
</style>