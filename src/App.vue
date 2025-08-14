<script setup lang="ts">
import { ref, computed } from 'vue'
import { csvParseRows } from 'd3-dsv'
import * as d3 from 'd3'
import Heatmap from './components/Heatmap.vue'

const fileInputRef = ref<HTMLInputElement | null>(null)
const parsedOutput = ref<(number | null)[][]>([])
const error = ref<string>('')
const transform = ref<d3.ZoomTransform>(d3.zoomIdentity)

// Computed zoom percentage from transform
const zoomPercentage = computed(() => Math.round(transform.value.k * 100))

const openFilePicker = () => {
  error.value = ''
  fileInputRef.value?.click()
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const csvContent = e.target?.result as string
      const parsed = csvParseRows(csvContent)
      parsedOutput.value = parsed.map(row => row.map(cell => cell || cell === '0' ? Number(cell) : null))
    } catch (e) {
      error.value = 'Failed to parse CSV.'
    }
  }
  reader.onerror = () => {
    error.value = 'Failed to read file.'
  }
  reader.readAsText(file)
  // reset the input so the same file can be uploaded again if needed
  target.value = ''
}

const updateZoom = (event: Event) => {
  const target = event.target as HTMLInputElement
  const newZoomPercentage = Number(target.value)
  const newScale = newZoomPercentage / 100

  // Update transform to maintain current pan position but with new zoom level
  const newTransform = d3.zoomIdentity
    .translate(transform.value.x, transform.value.y)
    .scale(newScale)
  transform.value = newTransform
}

const updateTransform = (newTransform: d3.ZoomTransform) => {
  transform.value = newTransform
}
</script>

<template>
  <div style="padding: 16px">
    <button @click="openFilePicker">Upload CSV</button>
    <input ref="fileInputRef" type="file" accept=".csv,text/csv" style="display: none" @change="handleFileUpload" />

    <div v-if="error" style="color: red; margin-top: 12px">{{ error }}</div>

    <div v-if="parsedOutput.length > 0" style="margin-top: 16px;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <span>Zoom:</span>
        <input type="range" min="10" max="1000" step="1" :value="zoomPercentage" @input="updateZoom"
          style="flex: 1; min-width: 200px;" />
        <span style="min-width: 60px; text-align: center;">{{ zoomPercentage }}%</span>
      </div>
      <div class="flex flex-row w-screen h-screen" style="margin-left: calc(-16px);">

        <Heatmap :data="parsedOutput" :transform="transform" style="flex: 1;" @update:transform="updateTransform" />
        <Heatmap :data="parsedOutput" :transform="transform" style="flex: 1;" @update:transform="updateTransform" />
        <!-- <Heatmap :data="parsedOutput" :zoom="zoom" /> -->

      </div>
    </div>

    <!-- <pre v-if="parsedOutput.length > 0"
      style="margin-top: 12px; max-width: 100%; overflow: auto; font-size: 10px;">{{ parsedOutput.join('\n') }}</pre> -->
  </div>
</template>

<style scoped></style>
