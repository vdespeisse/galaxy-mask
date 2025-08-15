<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  keyName: string
}

const props = defineProps<Props>()

// Detect OS for modifier key display
const isMac = computed(() => {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0
})

// Key mappings for special keys
const keyMappings = computed(() => ({
  'ctrl': isMac.value ? '⌘' : 'Ctrl',
  'shift': '⇧ Shift',
  'alt': 'Alt',
  'cmd': isMac.value ? '⌘' : 'Ctrl',
  'command': isMac.value ? '⌘' : 'Ctrl',
  'option': '⌥ Option',
  'enter': '↵ Enter',
  'space': 'Space',
  'tab': 'Tab',
  'escape': 'Esc',
  'backspace': '⌫ Backspace',
  'delete': 'Del',
  'arrowup': '↑ Up',
  'arrowdown': '↓ Down',
  'arrowleft': '← Left',
  'arrowright': '→ Right',
  'home': 'Home',
  'end': 'End',
  'pageup': 'PgUp',
  'pagedown': 'PgDn'
}))

// Get the display text for a key
const displayText = computed(() => {
  const keyLower = props.keyName.toLowerCase()
  return (keyMappings.value as Record<string, string>)[keyLower] || props.keyName
})

</script>

<template>
  <span
    class="inline-flex items-center justify-center px-2 py-1 text-xs font-mono rounded border text-slate-700 bg-slate-100 border-slate-300">
    {{ displayText }} </span>
</template>
