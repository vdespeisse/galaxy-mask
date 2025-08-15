<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch, ref } from 'vue'
import * as d3 from 'd3'

interface State {
  transform: d3.ZoomTransform
  mode: string
}

interface Props {
  data: (number | null)[][]
  state: State
  mask?: boolean[][]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:transform': [transform: d3.ZoomTransform]
  'update:mask': [coordinates: { x: number; y: number }]
}>()

const containerRef = ref<HTMLDivElement>()

// Local mask state for efficient updates
const localMask = ref<boolean[][]>([])

// Helper function to compare two masks
const areMasksEqual = (mask1: boolean[][] | undefined, mask2: boolean[][]): boolean => {
  if (!mask1 || mask1.length !== mask2.length) return false

  for (let i = 0; i < mask1.length; i++) {
    if (!mask1[i] || mask1[i].length !== mask2[i].length) return false
    for (let j = 0; j < mask1[i].length; j++) {
      if (mask1[i][j] !== mask2[i][j]) return false
    }
  }
  return true
}

function updateMask(newMask: boolean[][]) {
  if (newMask.length > 0) {
    const cellsToUpdate: Array<{ i: number; j: number }> = []

    for (let i = 0; i < newMask.length; i++) {
      for (let j = 0; j < newMask[i].length; j++) {
        const shouldBeMasked = newMask[i][j]
        const isCurrentlyMasked = localMask.value[i] && localMask.value[i][j]

        if (shouldBeMasked && !isCurrentlyMasked) {
          cellsToUpdate.push({ i, j })
        }
      }
    }

    // Update local mask and colors for changed cells
    cellsToUpdate.forEach(({ i, j }) => {
      localMask.value[i][j] = true
      updateCellColor(i, j)
    })
  }
}

// Initialize local mask when props.mask changes
watch(() => props.mask, (newMask) => {
  if (areMasksEqual(newMask, localMask.value)) {
    return
  }

  // Initialize local mask if needed
  if (localMask.value.length === 0 && newMask && newMask.length > 0) {
    localMask.value = Array(newMask.length).fill(null).map(() => Array(newMask[0].length).fill(false))
  }

  // Find cells that differ and update them incrementally
  if (newMask) {
    updateMask(newMask)
  }

}, { immediate: true, deep: true })

// Create color scale from blue (negative) to red (positive)
const colorScale = computed(() => {
  if (!props.data.length) return null

  const allValues = props.data.flat().filter(val => val !== null) as number[]
  if (allValues.length === 0) return null

  const minVal = Math.min(...allValues)
  const maxVal = Math.max(...allValues)

  return d3.scaleLinear<string>()
    .domain([minVal, 0, maxVal])
    .range(['blue', 'yellow', 'red'])
})

// Function to get the color of a square
const getSquareColor = (value: number | null, i: number, j: number): string => {
  // Check if this cell is masked using local state
  if (localMask.value[i] && localMask.value[i][j]) {
    return 'black'
  }

  if (value === null) return 'white'
  return colorScale.value ? colorScale.value(value) : 'white'
}

// Computed properties for dimensions
const rows = computed(() => props.data.length)
const cols = computed(() => props.data[0]?.length || 0)

// Calculate square size based on transform scale (6px default)
const squareSize = computed(() => {
  const baseSize = 6
  return baseSize
})

// Flatten the 2D data array for rendering
const flattenedData = computed(() => {
  const result: Array<{ value: number | null; i: number; j: number }> = []
  props.data.forEach((row, i) => {
    row.forEach((value, j) => {
      result.push({ value, i, j })
    })
  })
  return result
})

let svg: any = null
let g: any = null
let zoom: any = null

// State for shift + mouse press mode
let isShiftPressed = false
let isCtrlPressed = false
let isMousePressed = false
let isDragging = false
let lastMaskedCell: { x: number; y: number } | null = null

const updateTransform = (transform: d3.ZoomTransform) => {
  if (g && svg && zoom) {
    // Use d3.zoomTransform to properly process the transform through D3's zoom system
    zoom.transform(svg, transform)
  }
}

// Efficient color update for a single cell
const updateCellColor = (i: number, j: number) => {
  if (g) {
    const rect = g.selectAll("rect.heatmap-cell")
      .filter((d: any) => d.i === i && d.j === j)

    if (!rect.empty()) {
      const value = props.data[i]?.[j]
      rect.attr("fill", getSquareColor(value, i, j))
    }
  }
}

// Batch update colors for multiple cells
const updateCellsColors = (cells: Array<{ i: number; j: number }>) => {
  if (g) {
    cells.forEach(({ i, j }) => {
      updateCellColor(i, j)
    })
  }
}

const updateColors = () => {
  if (g) {
    g.selectAll("rect.heatmap-cell")
      .attr("fill", (d: any) => getSquareColor(d.value, d.i, d.j))
  }
}

// Get cell coordinates from mouse position
const getCellFromMousePosition = (event: MouseEvent): { x: number; y: number } | null => {
  if (!containerRef.value || !svg) return null

  const rect = containerRef.value.getBoundingClientRect()

  // Calculate mouse position relative to container
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  // Apply inverse transform to get position in data coordinates
  const transform = d3.zoomTransform(svg.node())
  const dataX = (mouseX - transform.x) / transform.k
  const dataY = (mouseY - transform.y) / transform.k

  // Calculate centering offset
  const totalDataWidth = cols.value * squareSize.value
  const totalDataHeight = rows.value * squareSize.value
  const offsetX = (rect.width - totalDataWidth) / 2
  const offsetY = (rect.height - totalDataHeight) / 2

  // Convert to cell coordinates
  const cellX = Math.floor((dataX - offsetX) / squareSize.value)
  const cellY = Math.floor((dataY - offsetY) / squareSize.value)

  // Check bounds
  if (cellX >= 0 && cellX < cols.value && cellY >= 0 && cellY < rows.value) {
    return { x: cellX, y: cellY }
  }

  return null
}

// Handle mask update with local state management
const handleMaskUpdate = (coordinates: { x: number; y: number }) => {
  const { x, y } = coordinates

  // Initialize local mask if needed
  if (localMask.value.length === 0) {
    localMask.value = Array(rows.value).fill(null).map(() => Array(cols.value).fill(false))
  }

  // Check if this cell is already masked to avoid unnecessary updates
  if (localMask.value[y] && localMask.value[y][x] !== undefined && !localMask.value[y][x]) {
    // Update local mask
    localMask.value[y][x] = true

    // Update only this cell's color
    updateCellColor(y, x)

    // Emit the update to parent
    emit('update:mask', coordinates)
  }
}

const createHeatmap = () => {
  if (!containerRef.value || !props.data.length) return
  // Get container dimensions
  const rect = containerRef.value.getBoundingClientRect()
  const containerWidth = rect.width
  const containerHeight = rect.height

  // Clear existing content
  containerRef.value.innerHTML = ''

  // Create SVG
  svg = d3.create("svg")
    .attr("width", containerWidth)
    .attr("height", containerHeight)

  // Create group for zooming
  g = svg.append("g")

  // Add global mouse and keyboard event listeners for shift + mouse press mode
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Shift') {
      isShiftPressed = true
    }
    if (event.key === 'Control' || event.key === 'Meta') {
      isCtrlPressed = true
    }
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Shift') {
      isShiftPressed = false
      isDragging = false
      lastMaskedCell = null
    }
    if (event.key === 'Control' || event.key === 'Meta') {
      isCtrlPressed = false
    }
  }

  const handleMouseDown = (event: MouseEvent) => {
    if (event.button === 0) { // Left mouse button
      isMousePressed = true
      isDragging = false
      lastMaskedCell = null
    }
  }

  const handleMouseUp = (event: MouseEvent) => {
    if (event.button === 0) { // Left mouse button
      isMousePressed = false
      isDragging = false
      lastMaskedCell = null
    }
  }

  const handleMouseMove = (event: MouseEvent) => {
    if (isShiftPressed && isMousePressed && props.state.mode === 'mask' && !isCtrlPressed) {
      const cell = getCellFromMousePosition(event)
      if (cell && (!lastMaskedCell || cell.x !== lastMaskedCell.x || cell.y !== lastMaskedCell.y)) {
        handleMaskUpdate(cell)
        lastMaskedCell = cell
        isDragging = true
      }
    }
  }

  // Add event listeners to the document
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)
  document.addEventListener('mousedown', handleMouseDown)
  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('mousemove', handleMouseMove)

  // Store cleanup function for later removal
  const cleanup = () => {
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
    document.removeEventListener('mousedown', handleMouseDown)
    document.removeEventListener('mouseup', handleMouseUp)
    document.removeEventListener('mousemove', handleMouseMove)
  }

  // Calculate centering offset to center the heatmap in the container
  const totalDataWidth = cols.value * squareSize.value
  const totalDataHeight = rows.value * squareSize.value
  const offsetX = (containerWidth - totalDataWidth) / 2
  const offsetY = (containerHeight - totalDataHeight) / 2

  g.append("rect")
    .attr("x", offsetX)
    .attr("y", offsetY)
    .attr("width", totalDataWidth)
    .attr("height", totalDataHeight)
    .attr("fill", "none")
    .attr("stroke", "#d3d3d3")
    .attr("stroke-width", 1)
    .attr("pointer-events", "none")

  // Create the heatmap rectangles
  g.selectAll("rect.heatmap-cell")
    .data(flattenedData.value)
    .join("rect")
    .attr("class", "heatmap-cell")
    .attr("x", (d: any) => offsetX + d.j * squareSize.value)
    .attr("y", (d: any) => offsetY + d.i * squareSize.value)
    .attr("width", squareSize.value - 0.5)
    .attr("height", squareSize.value - 0.5)
    .attr("fill", (d: any) => getSquareColor(d.value, d.i, d.j))
    .attr("stroke", "white")
    .attr("stroke-width", 0.1)
    .attr("title", (d: any) => `Row ${d.i}, Col ${d.j}: ${d.value === null ? 'null' : d.value}`)
    .style("cursor", props.state.mode === 'mask' ? "pointer" : "default")
    .on("mouseenter", function (this: SVGElement, event: any, d: any) {
      if (props.state.mode === 'mask') {
        d3.select(this)
          .attr("stroke", "#3b82f6")
          .attr("stroke-width", 1)
      }
    })
    .on("mouseleave", function (this: SVGElement, event: any, d: any) {
      if (props.state.mode === 'mask') {
        d3.select(this)
          .attr("stroke", "white")
          .attr("stroke-width", 0.1)
      }
    })
    .on("mousedown", function (event: any, d: any) {
      if (props.state.mode === 'mask' && !isCtrlPressed) {
        handleMaskUpdate({ x: d.j, y: d.i })
      }
    })

  // Add zoom behavior
  zoom = d3.zoom()
    .scaleExtent([0.1, 10])
    .on("zoom", (event) => {
      // Only update the visual transform, don't call zoom.transform
      g.attr("transform", event.transform)
      // Emit the transform for synchronization
      emit('update:transform', event.transform)
    })
    .filter((event) => {
      return event.ctrlKey || event.metaKey
    })

  svg.call(zoom)

  // Set initial transform based on props
  updateTransform(props.state.transform)

  // Append SVG to container
  containerRef.value.appendChild(svg.node())

  // Return cleanup function for later use
  return cleanup
}

// Watch for data changes and recreate heatmap
let cleanupFunction: (() => void) | null = null

watch([() => props.data], () => {
  if (cleanupFunction) {
    cleanupFunction()
  }
  const result = createHeatmap()
  cleanupFunction = result || null
}, { deep: true })


// Watch for transform changes and update
watch([() => props.state.transform], () => {
  updateTransform(props.state.transform)
}, { deep: true })

onMounted(() => {
  const result = createHeatmap()
  cleanupFunction = result || null

  // Add resize observer to handle container size changes
  // if (containerRef.value) {
  //   const resizeObserver = new ResizeObserver(() => {
  //     createHeatmap()
  //   })
  //   resizeObserver.observe(containerRef.value)

  //   // Clean up observer on unmount
  //   onUnmounted(() => {
  //     resizeObserver.disconnect()
  //   })
  // }
})

onUnmounted(() => {
  if (cleanupFunction) {
    cleanupFunction()
  }
  if (svg) {
    svg.remove()
  }
})
</script>

<template>
  <div class="w-full h-full" ref="containerRef">


  </div>
</template>

<style scoped></style>
