<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Props {
  zoomPercentage: number
}

interface Emits {
  (e: 'update:zoomPercentage', value: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const showSlider = ref(false)
const sliderValue = ref(props.zoomPercentage)

const zoomIn = () => {
  const newZoom = Math.min(1000, props.zoomPercentage + 10)
  emit('update:zoomPercentage', newZoom)
}

const zoomOut = () => {
  const newZoom = Math.max(10, props.zoomPercentage - 10)
  emit('update:zoomPercentage', newZoom)
}

const openSlider = () => {
  sliderValue.value = props.zoomPercentage
  showSlider.value = true
}

const closeSlider = () => {
  showSlider.value = false
}

const updateSlider = (event: Event) => {
  const target = event.target as HTMLInputElement
  const newValue = Number(target.value)
  sliderValue.value = newValue
  emit('update:zoomPercentage', newValue)
}

const applySlider = () => {
  emit('update:zoomPercentage', sliderValue.value)
  closeSlider()
}

// Click outside to close popup
const handleClickOutside = (event: Event) => {
  const target = event.target as Element
  if (showSlider.value && !target.closest('.zoom-control')) {
    closeSlider()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="flex items-center gap-2 relative zoom-control">
    <!-- Zoom Out Button -->
    <button @click="zoomOut"
      class="w-8 h-8 flex items-center justify-center bg-white border border-slate-400 rounded-md text-slate-700 hover:bg-emerald-300 hover:border-emerald-300 hover:text-emerald-900 transition-all duration-200 font-medium">
      -
    </button>

    <!-- Zoom Value Display (Clickable) -->
    <button @click="openSlider"
      class="px-3 py-1 bg-white border border-slate-400 rounded-md text-slate-700 hover:bg-emerald-300 hover:border-emerald-300 hover:text-emerald-900 transition-all duration-200 text-sm font-medium w-16">
      {{ zoomPercentage }}%
    </button>

    <!-- Zoom In Button -->
    <button @click="zoomIn"
      class="w-8 h-8 flex items-center justify-center bg-white border border-slate-400 rounded-md text-slate-700 hover:bg-emerald-300 hover:border-emerald-300 hover:text-emerald-900 transition-all duration-200 font-medium">
      +
    </button>

    <!-- Slider Popup -->
    <div v-if="showSlider"
      class="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white border border-slate-300 rounded-lg shadow-lg p-4 z-50 min-w-[200px]">
      <div class="flex flex-col gap-3">
        <div class="text-sm font-medium text-slate-700">Zoom: {{ sliderValue }}%</div>
        <input type="range" min="10" max="1000" step="1" :value="sliderValue" @input="updateSlider" class="w-full" />
        <div class="flex gap-2">
          <button @click="applySlider"
            class="flex-1 px-3 py-1 bg-emerald-300 text-emerald-900 rounded-md text-sm font-medium hover:bg-emerald-400 transition-colors">
            Apply
          </button>
          <button @click="closeSlider"
            class="flex-1 px-3 py-1 bg-slate-200 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-300 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Click outside to close popup */
</style>
