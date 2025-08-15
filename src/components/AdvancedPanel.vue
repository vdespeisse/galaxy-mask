<script setup lang="ts">
import { colorPresets } from '../lib/colors'
import type { Settings } from '../types'

interface Props {
  modelValue: Settings
}

interface Emits {
  (e: 'update:modelValue', value: Settings): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const updateSettings = (updates: Partial<Settings>) => {
  emit('update:modelValue', { ...props.modelValue, ...updates })
}
</script>

<template>
  <div class="p-4">
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

            <!-- Color Preview -->
            <div v-if="modelValue.colorScheme && colorPresets[modelValue.colorScheme]" class="mt-2">
              <div class="flex gap-1">
                <div v-for="color in colorPresets[modelValue.colorScheme]" :key="color"
                  class="w-4 h-4 rounded border border-slate-300" :style="{ backgroundColor: color }" :title="color">
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
    </div>
  </div>
</template>

<style scoped>
/* Component-specific styles if needed */
</style>
