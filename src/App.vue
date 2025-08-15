<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { csvParseRows } from 'd3-dsv'
import * as d3 from 'd3'
import Heatmap from './components/Heatmap.vue'
import ZoomControl from './components/ZoomControl.vue'
import HotkeyHelp from './components/HotkeyHelp.vue'
import SvgIcon from './components/SvgIcon.vue'
import ToolButton from './components/ToolButton.vue'
import AdvancedPanel from './components/AdvancedPanel.vue'
import { coordToKey, arrayToSet, setToArray } from './lib/mask'
import type { Settings } from './types'

const fileInputRef = ref<HTMLInputElement | null>(null)
const maskFileInputRef = ref<HTMLInputElement | null>(null)
const galaxyLeft = ref<(number | null)[][]>([])
const galaxyRight = ref<(number | null)[][]>([])
const galaxyLeftFilename = ref<string>('')
const galaxyRightFilename = ref<string>('')
const error = ref<string>('')
const mask = ref<Set<string>>(new Set())

// Advanced panel state
const isAdvancedPanelOpen = ref(false)

// Settings state
const settings = ref<Settings>({
  colorScheme: "spectral",
  interpolationType: "percentile",
  interpolationRangeAbsolute: [0, 100],
  interpolationRangePercentile: [0, 100],
  maskDisplay: "show"
})

// Create reactive state object
const state = reactive({
  transform: d3.zoomIdentity,
  mode: 'mask' as string,
  tool: 'hand' as string
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
  if (mask.value.size === 0) {
    error.value = 'No mask data to save.'
    return
  }

  // Get dimensions from the data
  const maxRows = Math.max(galaxyLeft.value.length, galaxyRight.value.length)
  const maxCols = Math.max(
    galaxyLeft.value[0]?.length || 0,
    galaxyRight.value[0]?.length || 0
  )

  // Convert Set to array for saving
  const maskArray = setToArray(mask.value, maxRows, maxCols)

  // Convert boolean mask to CSV string with 0s and 1s, no headers
  const csvContent = maskArray
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
    // Convert array to Set for internal storage
    mask.value = arrayToSet(maskData)
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


const handleMaskUpdate = (maskUpdate: { values: { x: number; y: number }[], add: boolean }) => {
  if (maskUpdate.add) {
    // Add all coordinates to the mask Set
    maskUpdate.values.forEach(({ x, y }) => {
      mask.value.add(coordToKey(y, x))
    })
  } else {
    // Remove all coordinates from the mask Set
    maskUpdate.values.forEach(({ x, y }) => {
      mask.value.delete(coordToKey(y, x))
    })
  }
}

function getDigit(e: KeyboardEvent): number | null {
  if (e.code.startsWith('Digit')) return Number(e.code.slice(5));     // top row
  if (e.code.startsWith('Numpad') && /Numpad[0-9]/.test(e.code)) {
    return Number(e.code.slice(6)); // numpad 0–9
  }
  return null;
}

onMounted(() => {
  document.addEventListener('keydown', (e) => {
    const digit = getDigit(e)
    const tools = ['hand', 'point', 'select', 'shape']
    if (digit) {
      const tool = tools[digit - 1]
      if (tool) {
        state.tool = tool
      }
    }

    // Mode switching hotkeys
    if (e.key === 'a' || e.key === 'A') {
      state.mode = 'mask'
    } else if (e.key === 'z' || e.key === 'Z') {
      state.mode = 'erase'
    } else if (e.key === 'e' || e.key === 'E') {
      state.mode = 'view'
    } else if (e.key === 'h' || e.key === 'H') {
      // Cycle through mask display options: show -> hide -> transparent -> show
      const displayOptions: Array<'show' | 'hide' | 'transparent'> = ['show', 'hide', 'transparent']
      const currentIndex = displayOptions.indexOf(settings.value.maskDisplay)
      const nextIndex = (currentIndex + 1) % displayOptions.length
      settings.value.maskDisplay = displayOptions[nextIndex]
    }
  })
})
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

      <!-- Mode and Tools -->
      <div class="flex gap-4 flex-1 items-center justify-center">
        <div class="flex gap-2 items-center">
          <div>Mode:</div>
          <select v-model="state.mode"
            class="px-3 py-1 text-sm font-medium rounded border border-slate-400 bg-white text-slate-700 cursor-pointer transition-all duration-200 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300">
            <option value="mask">Mask</option>
            <option value="erase">Erase</option>
            <option value="view">View</option>
          </select>
        </div>

        <div class="bg-white rounded-lg p-1 flex gap-1 shadow-sm">
          <ToolButton v-model="state.tool" value="hand" icon="hand" :number="1" />
          <ToolButton v-model="state.tool" value="point" icon="point" :number="2" />
          <ToolButton v-model="state.tool" value="select" icon="select" :number="3" />
          <ToolButton v-model="state.tool" value="shape" icon="shape" :number="4" />
        </div>
      </div>

      <!-- Zoom Control -->
      <div class="flex items-center gap-2 flex-1 justify-end">
        <ZoomControl v-if="hasData" :zoom-percentage="zoomPercentage" @update:zoom-percentage="updateZoom" />
        <button
          class="px-3 py-2 bg-white text-slate-700 border border-slate-400 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-emerald-300 hover:border-emerald-300 hover:text-emerald-900 active:bg-emerald-300 active:border-emerald-300 active:text-emerald-900 flex items-center gap-2"
          @click="isAdvancedPanelOpen = !isAdvancedPanelOpen">
          <span>Advanced</span>
          <SvgIcon name="menu" class="w-4 h-4" />
        </button>
        <HotkeyHelp />
      </div>

      <input ref="fileInputRef" type="file" accept=".csv,text/csv" multiple class="hidden" @change="handleFileUpload" />
      <input ref="maskFileInputRef" type="file" accept=".csv,text/csv" class="hidden" @change="handleMaskFileUpload" />
    </div>

    <!-- Advanced Panel -->
    <Transition name="slide">
      <div v-if="isAdvancedPanelOpen"
        class="advanced-panel fixed top-0 right-0 w-72 h-full bg-slate-50 border-l border-slate-200 shadow-lg z-50"
        :style="{ top: '63px' }">
        <AdvancedPanel v-model="settings" />
      </div>
    </Transition>

    <!-- Main content area -->
    <div class="flex-1 overflow-hidden">
      <div v-if="error" class="text-red-500 mb-4 p-2 bg-red-50 border border-red-200 rounded-md">{{ error }}</div>

      <div v-if="hasData" class="h-full flex flex-col">
        <div class="flex-1 flex min-h-0 divide-x divide-slate-200">
          <div class="flex-1 min-h-0 flex flex-col">
            <div class="text-center py-1 bg-slate-100 border-b border-slate-200 text-xs text-slate-600">
              {{ galaxyLeftFilename || 'No file loaded' }}
            </div>
            <Heatmap :data="galaxyLeft" :state="state" :mask="mask" :settings="settings" class="flex-1 min-h-0"
              @update:transform="updateTransform" @update:mask="handleMaskUpdate" />
          </div>
          <div class="flex-1 min-h-0 flex flex-col">
            <div class="text-center py-1 bg-slate-100 border-b border-slate-200 text-xs text-slate-600">
              {{ galaxyRightFilename || 'No file loaded' }}
            </div>
            <Heatmap :data="galaxyRight" :state="state" :mask="mask" :settings="settings" class="flex-1 min-h-0"
              @update:transform="updateTransform" @update:mask="handleMaskUpdate" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Slide transition for advanced panel */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease-in-out;
}

.slide-enter-from {
  transform: translateX(100%);
}

.slide-leave-to {
  transform: translateX(100%);
}

.slide-enter-to,
.slide-leave-from {
  transform: translateX(0);
}
</style>
