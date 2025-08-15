<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from './SvgIcon.vue'

interface Props {
  modelValue: string
  value: string
  icon: string
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: ''
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
    class="p-1 rounded-md transition-all duration-200 flex flex-col items-center gap-1 min-w-[32px] cursor-pointer"
    :class="isActive
      ? 'bg-emerald-300 text-emerald-900'
      : 'bg-white text-slate-600 hover:bg-emerald-100 hover:text-emerald-800'">
    <SvgIcon :name="icon" size="20" />
    <span v-if="label" class="text-xs font-medium">{{ label }}</span>
  </button>
</template>
