<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch, ref } from 'vue'
import * as d3 from 'd3'
import { coordToKey, keyToCoord, arrayToSet, setToArray, areMasksEqual } from '../lib/mask'

interface State {
  transform: d3.ZoomTransform
  mode: string
  tool: string
}

interface Props {
  data: (number | null)[][]
  state: State
  mask?: Set<string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:transform': [transform: d3.ZoomTransform]
  'update:mask': [maskUpdate: { values: { x: number; y: number }[], add: boolean }]
}>()

const containerRef = ref<HTMLDivElement>()

// Local mask state using Set for efficient operations
const localMask = ref<Set<string>>(new Set())

function updateMask(newMaskSet: Set<string>) {
  if (newMaskSet.size > 0) {
    const cellsToUpdate: Array<{ x: number; y: number }> = []

    // Find cells that are in newMask but not in localMask
    for (const key of newMaskSet) {
      if (!localMask.value.has(key)) {
        const [i, j] = keyToCoord(key)
        cellsToUpdate.push({ x: j, y: i })
        localMask.value.add(key)
      }
    }

    // Update colors for all changed cells in one batch
    if (cellsToUpdate.length > 10) {
      updateColors()
    } else if (cellsToUpdate.length > 0) {
      updateCellColors(cellsToUpdate)
    }
  }
}

// Initialize local mask when props.mask changes
watch(() => props.mask, (newMask) => {
  if (!newMask || newMask.size === 0) {
    localMask.value.clear()
    return
  }

  if (areMasksEqual(newMask, localMask.value)) {
    return
  }

  // Find cells that differ and update them incrementally
  updateMask(newMask)

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
  if (localMask.value.has(coordToKey(i, j))) {
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

// State for select mode
let isSelecting = false
let selectionStart: { x: number; y: number } | null = null
let selectionEnd: { x: number; y: number } | null = null
let selectionRect: any = null

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

// Batch update colors for multiple cells - optimized version
const updateCellColors = (cells: Array<{ x: number; y: number }>) => {
  if (!g) return

  // Get all rectangles at once
  const rects = g.selectAll("rect.heatmap-cell")

  cells.forEach(({ x, y }) => {
    const rect = rects.filter((d: any) => d.i === y && d.j === x)

    if (!rect.empty()) {
      const value = props.data[y]?.[x]
      rect.attr("fill", getSquareColor(value, y, x))
    }
  })
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

// Add multiple coordinates to mask and return array of newly added coordinates
const addMaskCoordinates = (coordinates: { x: number; y: number }[]): { x: number; y: number }[] => {
  // Initialize local mask if needed
  if (localMask.value.size === 0) {
    localMask.value = new Set()
  }

  const addedCoordinates: { x: number; y: number }[] = []

  coordinates.forEach(({ x, y }) => {
    // Check if this cell is already masked to avoid unnecessary updates
    if (!localMask.value.has(coordToKey(y, x))) {
      // Update local mask
      localMask.value.add(coordToKey(y, x))
      addedCoordinates.push({ x, y })
    }
  })

  // Note if batch is big, it's faster to juste update all colors rather than filter
  if (addedCoordinates.length > 10) {
    updateColors()
  } else if (addedCoordinates.length > 0) {
    updateCellColors(addedCoordinates)
  }

  return addedCoordinates
}

// Handle single mask update with local state management
const handleMaskUpdate = (coordinates: { x: number; y: number }) => {
  const addedCoordinates = addMaskCoordinates([coordinates])
  if (addedCoordinates.length > 0) {
    // Emit the update to parent
    emit('update:mask', { values: addedCoordinates, add: true })
  }
}

// Handle multiple mask updates efficiently
const handleMaskUpdates = (coordinates: { x: number; y: number }[]) => {
  const addedCoordinates = addMaskCoordinates(coordinates)

  // Emit all updates at once if any were added
  if (addedCoordinates.length > 0) {
    emit('update:mask', { values: addedCoordinates, add: true })
  }
}

// Handle selection rectangle creation
const createSelectionRect = () => {
  if (!svg) return

  // Remove existing selection rectangle
  if (selectionRect) {
    selectionRect.remove()
  }

  // Create new selection rectangle
  selectionRect = svg.append("rect")
    .attr("class", "selection-rect")
    .attr("fill", "rgba(59, 130, 246, 0.2)")
    .attr("stroke", "#3b82f6")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "5,5")
    .style("pointer-events", "none")
}

// Update selection rectangle position and size
const updateSelectionRect = () => {
  if (!selectionRect || !selectionStart || !selectionEnd || !containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  const transform = d3.zoomTransform(svg.node())

  // Calculate centering offset
  const totalDataWidth = cols.value * squareSize.value
  const totalDataHeight = rows.value * squareSize.value
  const offsetX = (rect.width - totalDataWidth) / 2
  const offsetY = (rect.height - totalDataHeight) / 2

  // Convert cell coordinates to screen coordinates
  const startX = offsetX + selectionStart.x * squareSize.value
  const startY = offsetY + selectionStart.y * squareSize.value
  const endX = offsetX + selectionEnd.x * squareSize.value
  const endY = offsetY + selectionEnd.y * squareSize.value

  // Apply transform
  const transformedStartX = startX * transform.k + transform.x
  const transformedStartY = startY * transform.k + transform.y
  const transformedEndX = endX * transform.k + transform.x
  const transformedEndY = endY * transform.k + transform.y

  // Calculate rectangle dimensions
  const rectX = Math.min(transformedStartX, transformedEndX)
  const rectY = Math.min(transformedStartY, transformedEndY)
  const rectWidth = Math.abs(transformedEndX - transformedStartX)
  const rectHeight = Math.abs(transformedEndY - transformedStartY)

  selectionRect
    .attr("x", rectX)
    .attr("y", rectY)
    .attr("width", rectWidth)
    .attr("height", rectHeight)
}

// Handle selection completion
const handleSelectionComplete = () => {
  if (!selectionStart || !selectionEnd) return

  // Calculate selection bounds
  const minX = Math.min(selectionStart.x, selectionEnd.x)
  const maxX = Math.max(selectionStart.x, selectionEnd.x)
  const minY = Math.min(selectionStart.y, selectionEnd.y)
  const maxY = Math.max(selectionStart.y, selectionEnd.y)

  // Collect all cells in the selection
  const selectedCells: { x: number; y: number }[] = []
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (x >= 0 && x < cols.value && y >= 0 && y < rows.value) {
        selectedCells.push({ x, y })
      }
    }
  }

  // Add all cells in the selection to the mask in one batch
  handleMaskUpdates(selectedCells)
  // alert('done')

  // Clean up selection
  if (selectionRect) {
    selectionRect.remove()
    selectionRect = null
  }
  selectionStart = null
  selectionEnd = null
  isSelecting = false
}

const cursorStyle = computed(() => {
  if (props.state.tool === 'hand') {
    return 'grab'
  }
  if (props.state.tool === 'select') {
    return 'crosshair'
  }
  if (props.state.mode === 'mask') {
    return 'pointer'
  }
  return 'default'
})

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

      // Start selection if in select mode
      if (props.state.tool === 'select' && props.state.mode === 'mask') {
        const cell = getCellFromMousePosition(event)
        if (cell) {
          isSelecting = true
          selectionStart = cell
          selectionEnd = cell
          createSelectionRect()
          updateSelectionRect()
        }
      }
    }
  }

  const handleMouseUp = (event: MouseEvent) => {
    if (event.button === 0) { // Left mouse button
      isMousePressed = false
      isDragging = false
      lastMaskedCell = null

      // Complete selection if in select mode
      if (isSelecting && props.state.tool === 'select') {
        const cell = getCellFromMousePosition(event)
        if (cell) {
          selectionEnd = cell
          updateSelectionRect()
        }
        handleSelectionComplete()
      }
    }
  }

  const handleMouseMove = (event: MouseEvent) => {
    // Handle selection rectangle update
    if (isSelecting && props.state.tool === 'select') {
      const cell = getCellFromMousePosition(event)
      if (cell) {
        selectionEnd = cell
        updateSelectionRect()
      }
      return
    }

    // Handle shift + drag for masking
    if (isShiftPressed && isMousePressed && props.state.mode === 'mask' && !isCtrlPressed && props.state.tool !== 'hand') {
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

    // Clean up selection rectangle
    if (selectionRect) {
      selectionRect.remove()
      selectionRect = null
    }
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
    .on("mouseenter", function (this: SVGElement, event: any, d: any) {
      if (props.state.mode === 'mask' && props.state.tool !== 'hand') {
        d3.select(this)
          .attr("stroke", "#3b82f6")
          .attr("stroke-width", 1)
      }
    })
    .on("mouseleave", function (this: SVGElement, event: any, d: any) {
      if (props.state.mode === 'mask' && props.state.tool !== 'hand') {
        d3.select(this)
          .attr("stroke", "white")
          .attr("stroke-width", 0.1)
      }
    })
    .on("mousedown", function (event: any, d: any) {
      if (props.state.mode === 'mask' && !isCtrlPressed && props.state.tool === 'point') {
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
      // In hand mode, allow all interactions without Ctrl key
      if (props.state.tool === 'hand') {
        return true
      }
      // In other modes, require Ctrl/Cmd key for zoom/pan
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
  <div class="w-full h-full" ref="containerRef" :style="{ cursor: cursorStyle }">


  </div>
</template>

<style scoped></style>
