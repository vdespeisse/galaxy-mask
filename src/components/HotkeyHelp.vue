<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import Hotkey from './Hotkey.vue'

const showPopup = ref(false)

const openPopup = () => {
  showPopup.value = true
}

const closePopup = () => {
  showPopup.value = false
}
</script>

<template>
  <div class="relative hotkey-help">
    <!-- Question mark button -->
    <button @mouseenter="openPopup" @mouseleave="closePopup"
      class="w-8 h-8 flex items-center justify-center bg-white border border-slate-400 rounded-md text-slate-700 hover:bg-emerald-300 hover:border-emerald-300 hover:text-emerald-900 transition-all duration-200 font-medium text-lg"
      title="Keyboard shortcuts">
      ?
    </button>

    <!-- Popup -->
    <div v-if="showPopup" @mouseenter="openPopup" @mouseleave="closePopup"
      class="absolute top-0 right-full mr-2 bg-white border border-slate-300 rounded-lg shadow-lg p-4 z-50 min-w-[280px]">
      <div class="flex flex-col gap-3">
        <h3 class="text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">
          Keyboard Shortcuts
        </h3>

        <!-- General shortcuts -->
        <div class="space-y-2">
          <div class="flex items-center justify-between text-sm">
            <span class="text-slate-600">Zoom:</span>
            <Hotkey :keys="['cmd', 'wheel']" />
          </div>

          <div class="flex items-center justify-between text-sm">
            <span class="text-slate-600">Pan:</span>
            <Hotkey :keys="['cmd', 'drag']" />
          </div>

          <div class="flex items-center justify-between text-sm">
            <span class="text-slate-600">Toggle hide masked:</span>
            <Hotkey :keys="['h']" />
          </div>
        </div>

        <!-- Mode switching shortcuts -->
        <div class="pt-2 border-t border-slate-200">
          <h4 class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Mode switching
          </h4>
          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-slate-600">Switch tool:</span>
              <div class="flex items-center gap-1">
                <Hotkey :keys="['1']" />
                <Hotkey :keys="['2']" />
                <Hotkey :keys="['3']" />
                <Hotkey :keys="['4']" />
              </div>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-slate-600">Mask mode:</span>
              <Hotkey :keys="['a']" />
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-slate-600">Erase mode:</span>
              <Hotkey :keys="['z']" />
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-slate-600">View mode:</span>
              <Hotkey :keys="['e']" />
            </div>
          </div>
        </div>

        <!-- Mask mode shortcuts -->
        <div class="pt-2 border-t border-slate-200">
          <h4 class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            In point mode
          </h4>
          <div class="flex items-center justify-between text-sm">
            <span class="text-slate-600">Multi point:</span>
            <Hotkey :keys="['shift', 'drag']" />
          </div>
        </div>

        <!-- Shape mode shortcuts -->
        <div class="pt-2 border-t border-slate-200">
          <h4 class="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            In shape mode
          </h4>
          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-slate-600">Validate selection:</span>
              <Hotkey :keys="['enter']" />
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-slate-600">Cancel selection:</span>
              <Hotkey :keys="['esc']" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
