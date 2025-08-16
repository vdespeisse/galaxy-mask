<script setup lang="ts">
import { computed } from 'vue'
import * as d3 from 'd3'
import { colorPresets } from '../lib/colors'
import type { Settings } from '../types'

interface Props {
  modelValue: Settings
}

interface Emits {
  (e: 'update:modelValue', value: Settings): void
  (e: 'clear:mask'): void
  (e: 'clear:files'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const updateSettings = (updates: Partial<Settings>) => {
  emit('update:modelValue', { ...props.modelValue, ...updates })
}

// Computed property for color scale gradient
const colorScaleGradient = computed(() => {
  if (!props.modelValue.colorScheme || !colorPresets[props.modelValue.colorScheme]) {
    return ''
  }

  const colors = colorPresets[props.modelValue.colorScheme]
  if (colors.length <= 10) {
    return ''
  }

  // Create interpolator function using the colors array
  const interpolator = d3.interpolateRgbBasis(colors)

  // Generate gradient stops
  const stops = []
  for (let i = 0; i <= 100; i++) {
    const t = i / 100
    const color = interpolator(t)
    stops.push(`${color} ${i}%`)
  }

  return `linear-gradient(to right, ${stops.join(', ')})`
})
</script>

<template>
  <div class="p-4" @click.stop>
    <h3 class="text-lg font-semibold text-slate-800 mb-4">Advanced Options</h3>

    <div class="space-y-6">
      <!-- Colors Section -->
      <div>
        <h4 class="text-sm font-medium text-slate-700 mb-3">Color Scheme</h4>

        <div class="space-y-3">
          <div class="space-y-2">
            <select :value="modelValue.colorScheme"
              @change="updateSettings({ colorScheme: ($event.target as HTMLSelectElement).value })"
              class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300">
              <option v-for="preset in Object.keys(colorPresets)" :key="preset" :value="preset">
                {{ preset }}
              </option>
            </select>
            <!-- Color Scale Gauge for schemes with more than 10 colors -->
            <div v-if="modelValue.colorScheme && colorPresets[modelValue.colorScheme]" class="mt-3">
              <div class="text-xs text-slate-600 mb-2">Color Scale Preview:</div>
              <div class="relative">
                <div class="w-full h-6 rounded border border-slate-300 overflow-hidden">
                  <div class="w-full h-full" :style="{ background: colorScaleGradient }"></div>
                </div>
                <div class="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Min</span>
                  <span>Max</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Interpolation Section -->
      <div>
        <h4 class="text-sm font-medium text-slate-700 mb-3">Interpolation</h4>

        <div class="space-y-3">
          <!-- Interpolation Type Selection -->
          <div class="flex gap-3">
            <label class="flex items-center">
              <input type="radio" :checked="modelValue.interpolationType === 'absolute'"
                @change="updateSettings({ interpolationType: 'absolute' })" class="mr-2" />
              <span class="text-sm">Absolute</span>
            </label>
            <label class="flex items-center">
              <input type="radio" :checked="modelValue.interpolationType === 'percentile'"
                @change="updateSettings({ interpolationType: 'percentile' })" class="mr-2" />
              <span class="text-sm">Percentile</span>
            </label>
          </div>

          <!-- Absolute Range -->
          <div v-if="modelValue.interpolationType === 'absolute'" class="space-y-2">
            <label class="block text-sm text-slate-600">Range</label>
            <div class="flex gap-2">
              <input type="number" :value="modelValue.interpolationRangeAbsolute[0]" @change="(e) => updateSettings({
                interpolationRangeAbsolute: [Number((e.target as HTMLInputElement).value), modelValue.interpolationRangeAbsolute[1]]
              })"
                class="w-0 flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
                placeholder="Min" />
              <input type="number" :value="modelValue.interpolationRangeAbsolute[1]" @change="(e) => updateSettings({
                interpolationRangeAbsolute: [modelValue.interpolationRangeAbsolute[0], Number((e.target as HTMLInputElement).value)]
              })"
                class="w-0 flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
                placeholder="Max" />
            </div>
          </div>

          <!-- Percentile Range -->
          <div v-if="modelValue.interpolationType === 'percentile'" class="space-y-2">
            <label class="block text-sm text-slate-600">Percentile Range</label>
            <div class="flex gap-2">
              <input type="number" :value="modelValue.interpolationRangePercentile[0]" @change="(e) => updateSettings({
                interpolationRangePercentile: [Number((e.target as HTMLInputElement).value), modelValue.interpolationRangePercentile[1]]
              })"
                class="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
                placeholder="Min %" min="0" max="100" />
              <input type="number" :value="modelValue.interpolationRangePercentile[1]" @change="(e) => updateSettings({
                interpolationRangePercentile: [modelValue.interpolationRangePercentile[0], Number((e.target as HTMLInputElement).value)]
              })"
                class="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
                placeholder="Max %" min="0" max="100" />
            </div>
          </div>
        </div>
      </div>

      <!-- Mask Display Section -->
      <div>
        <h4 class="text-sm font-medium text-slate-700 mb-3">Mask Display</h4>

        <div class="space-y-3">
          <div class="space-y-2">
            <label class="block text-sm text-slate-600">Masked cells display:</label>
            <select :value="modelValue.maskDisplay"
              @change="updateSettings({ maskDisplay: ($event.target as HTMLSelectElement).value as 'show' | 'hide' | 'transparent' })"
              class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300">
              <option value="show">Show as black</option>
              <option value="hide">Hide (show as white)</option>
              <option value="transparent">Transparent (low opacity grey)</option>
            </select>
          </div>
        </div>
      </div>
      <div>
        <h4 class="text-sm font-medium text-slate-700 mb-3">Actions</h4>

        <div class="space-y-3">
          <button @click="$emit('clear:mask')"
            class="w-full px-4 py-2 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-red-200 hover:border-red-400 active:bg-red-300">
            Clear Mask
          </button>

          <button @click="$emit('clear:files')"
            class="w-full px-4 py-2 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-red-200 hover:border-red-400 active:bg-red-300">
            Clear Files
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Component-specific styles if needed */
</style>
