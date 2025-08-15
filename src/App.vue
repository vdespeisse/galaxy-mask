<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { csvParseRows } from 'd3-dsv'
import * as d3 from 'd3'
import Heatmap from './components/Heatmap.vue'
import ZoomControl from './components/ZoomControl.vue'
import HotkeyHelp from './components/HotkeyHelp.vue'

const fileInputRef = ref<HTMLInputElement | null>(null)
const maskFileInputRef = ref<HTMLInputElement | null>(null)
const galaxyLeft = ref<(number | null)[][]>([])
const galaxyRight = ref<(number | null)[][]>([])
const galaxyLeftFilename = ref<string>('')
const galaxyRightFilename = ref<string>('')
const error = ref<string>('')
const mask = ref<boolean[][]>([])

// Create reactive state object
const state = reactive({
  transform: d3.zoomIdentity,
  mode: 'view' as string
})

// Computed zoom percentage from state.transform
const zoomPercentage = computed(() => Math.round(state.transform.k * 100))

// Check if we have any data to display
const hasData = computed(() => galaxyLeft.value.length > 0 || galaxyRight.value.length > 0)

const openFilePicker = () => {
  error.value = ''
  fileInputRef.value?.click()
}

const openMaskFilePicker = () => {
  error.value = ''
  maskFileInputRef.value?.click()
}

const parseCSVFile = (file: File): Promise<(number | null)[][]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result as string
        const parsed = csvParseRows(csvContent)
        const result = parsed.map(row => row.map(cell => cell || cell === '0' ? Number(cell) : null))
        // resolve(result.slice(0, 100).map(row => row.slice(0, 100)))
        resolve(result)
      } catch (e) {
        reject(new Error('Failed to parse CSV.'))
      }
    }
    reader.onerror = () => {
      reject(new Error('Failed to read file.'))
    }
    reader.readAsText(file)
  })
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files

  if (!files || files.length === 0) return

  // Check if more than 2 files are selected
  if (files.length > 2) {
    error.value = 'Please select a maximum of 2 files.'
    target.value = ''
    return
  }

  try {
    error.value = ''

    if (files.length === 2) {
      // Two files selected - put one in left, one in right
      const file1 = await parseCSVFile(files[0])
      const file2 = await parseCSVFile(files[1])
      galaxyLeft.value = file1
      galaxyRight.value = file2
      galaxyLeftFilename.value = files[0].name
      galaxyRightFilename.value = files[1].name
    } else if (files.length === 1) {
      // One file selected
      const fileData = await parseCSVFile(files[0])

      if (galaxyLeft.value.length === 0) {
        // No left data exists, put it in left
        galaxyLeft.value = fileData
        galaxyLeftFilename.value = files[0].name
      } else if (galaxyRight.value.length === 0) {
        // Left exists but no right, put it in right
        galaxyRight.value = fileData
        galaxyRightFilename.value = files[0].name
      } else {
        // Both exist, put it in left and clear right
        galaxyLeft.value = fileData
        galaxyRight.value = []
        galaxyLeftFilename.value = files[0].name
        galaxyRightFilename.value = ''
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to process files.'
  }

  // Reset the input so the same files can be uploaded again if needed
  target.value = ''
}

const handleSave = () => {
  if (mask.value.length === 0) {
    error.value = 'No mask data to save.'
    return
  }

  // Convert boolean mask to CSV string with 0s and 1s, no headers
  const csvContent = mask.value
    .map(row => row.map(cell => cell ? '1' : '0').join(','))
    .join('\n')

  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mask.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const parseMaskCSVFile = (file: File): Promise<boolean[][]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result as string
        const rows = csvContent.trim().split('\n')
        const result = rows.map(row =>
          row.split(',').map(cell => cell.trim() === '1')
        )
        resolve(result)
      } catch (e) {
        reject(new Error('Failed to parse mask CSV.'))
      }
    }
    reader.onerror = () => {
      reject(new Error('Failed to read mask file.'))
    }
    reader.readAsText(file)
  })
}

const handleMaskFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files

  if (!files || files.length === 0) return

  if (files.length > 1) {
    error.value = 'Please select only one mask file.'
    target.value = ''
    return
  }

  try {
    error.value = ''
    const maskData = await parseMaskCSVFile(files[0])
    mask.value = maskData
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to process mask file.'
  }

  // Reset the input so the same file can be uploaded again if needed
  target.value = ''
}

const updateZoom = (newZoomPercentage: number) => {
  const newScale = newZoomPercentage / 100

  // Update transform to maintain current pan position but with new zoom level
  const newTransform = d3.zoomIdentity
    .translate(state.transform.x, state.transform.y)
    .scale(newScale)
  state.transform = newTransform
}

const updateTransform = (newTransform: d3.ZoomTransform) => {
  state.transform = newTransform
}


const handleMaskUpdate = (coordinates: { x: number; y: number }) => {
  const { x, y } = coordinates

  // Initialize mask if it doesn't exist
  if (mask.value.length === 0) {
    const maxRows = Math.max(galaxyLeft.value.length, galaxyRight.value.length)
    const maxCols = Math.max(
      galaxyLeft.value[0]?.length || 0,
      galaxyRight.value[0]?.length || 0
    )
    mask.value = Array(maxRows).fill(null).map(() => Array(maxCols).fill(false))
  }

  // Set the mask at the given coordinates (no need to toggle, just set to true)
  if (mask.value[y] && mask.value[y][x] !== undefined) {
    mask.value[y][x] = true
  }
}
</script>

<template>
  <div class="h-screen flex flex-col">
    <!-- Toolbar -->
    <div class="bg-slate-50 border-b border-slate-200 flex items-center justify-between p-2 pr-8 flex-shrink-0">
      <div class="flex gap-3 flex-1">
        <button
          class="px-4 py-2 bg-white text-slate-700 border border-slate-400 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-emerald-300 hover:border-emerald-300 hover:text-emerald-900 active:bg-emerald-300 active:border-emerald-300 active:text-emerald-900"
          @click="openFilePicker">
          Upload Data (1-2 files)
        </button>
        <button
          class="px-4 py-2 bg-white text-slate-700 border border-slate-400 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-emerald-300 hover:border-emerald-300 hover:text-emerald-900 active:bg-emerald-300 active:border-emerald-300 active:text-emerald-900"
          @click="openMaskFilePicker">
          Load Mask
        </button>
        <button
          class="px-4 py-2 bg-white text-slate-700 border border-slate-400 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-emerald-300 hover:border-emerald-300 hover:text-emerald-900 active:bg-emerald-300 active:border-emerald-300 active:text-emerald-900"
          @click="handleSave">
          Save Mask
        </button>
      </div>

      <!-- Mode Toggle Buttons -->
      <div class="flex gap-2 flex-1 items-center justify-center">
        <button class="px-3 py-1 text-sm font-medium rounded border border-slate-400 transition-all duration-200"
          :class="state.mode === 'view'
            ? 'bg-emerald-300 border-emerald-300'
            : 'bg-white text-slate-700 hover:bg-slate-100'" @click="state.mode = 'view'">
          View
        </button>
        <button class="px-3 py-1 text-sm font-medium rounded border border-slate-400 transition-all duration-200"
          :class="state.mode === 'mask'
            ? 'bg-emerald-300 border-emerald-300'
            : 'bg-white text-slate-700 hover:bg-slate-100'" @click="state.mode = 'mask'">
          Mask
        </button>
      </div>

      <!-- Zoom Control -->
      <div class="flex items-center gap-2 flex-1 justify-end">
        <ZoomControl v-if="hasData" :zoom-percentage="zoomPercentage" @update:zoom-percentage="updateZoom" />
        <HotkeyHelp />
      </div>

      <input ref="fileInputRef" type="file" accept=".csv,text/csv" multiple class="hidden" @change="handleFileUpload" />
      <input ref="maskFileInputRef" type="file" accept=".csv,text/csv" class="hidden" @change="handleMaskFileUpload" />
    </div>

    <!-- Main content area -->
    <div class="flex-1 overflow-hidden">
      <div v-if="error" class="text-red-500 mb-4 p-2 bg-red-50 border border-red-200 rounded-md">{{ error }}</div>

      <div v-if="hasData" class="h-full flex flex-col">
        <div class="flex-1 flex min-h-0 divide-x divide-slate-200">
          <div class="flex-1 min-h-0 flex flex-col">
            <div class="text-center py-1 bg-slate-100 border-b border-slate-200 text-xs text-slate-600">
              {{ galaxyLeftFilename || 'No file loaded' }}
            </div>
            <Heatmap :data="galaxyLeft" :state="state" :mask="mask" class="flex-1 min-h-0"
              @update:transform="updateTransform" @update:mask="handleMaskUpdate" />
          </div>
          <div class="flex-1 min-h-0 flex flex-col">
            <div class="text-center py-1 bg-slate-100 border-b border-slate-200 text-xs text-slate-600">
              {{ galaxyRightFilename || 'No file loaded' }}
            </div>
            <Heatmap :data="galaxyRight" :state="state" :mask="mask" class="flex-1 min-h-0"
              @update:transform="updateTransform" @update:mask="handleMaskUpdate" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
