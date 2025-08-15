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
    for (const key of newMaskSet) {
      if (!localMask.value.has(key)) {
        const [i, j] = keyToCoord(key)
        cellsToUpdate.push({ x: j, y: i })
        localMask.value.add(key)
      }
    }
    for (const key of localMask.value) {
      if (!newMaskSet.has(key)) {
        const [i, j] = keyToCoord(key)
        cellsToUpdate.push({ x: j, y: i })
        localMask.value.delete(key)
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
  // For now, we assume additions (the parent component should handle the add/remove logic)
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

// State for shape mode
let shapeNodes: { x: number; y: number }[] = []
let shapeLines: any[] = []
let shapePolygon: any = null

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

// Remove multiple coordinates from mask and return array of newly removed coordinates
const removeMaskCoordinates = (coordinates: { x: number; y: number }[]): { x: number; y: number }[] => {
  const removedCoordinates: { x: number; y: number }[] = []

  coordinates.forEach(({ x, y }) => {
    // Check if this cell is masked to avoid unnecessary updates
    if (localMask.value.has(coordToKey(y, x))) {
      // Update local mask
      localMask.value.delete(coordToKey(y, x))
      removedCoordinates.push({ x, y })
    }
  })

  // Note if batch is big, it's faster to just update all colors rather than filter
  if (removedCoordinates.length > 10) {
    updateColors()
  } else if (removedCoordinates.length > 0) {
    updateCellColors(removedCoordinates)
  }

  return removedCoordinates
}

// Handle single mask update with local state management
const handleMaskUpdate = (coordinates: { x: number; y: number }) => {
  if (props.state.mode === 'mask') {
    const addedCoordinates = addMaskCoordinates([coordinates])
    if (addedCoordinates.length > 0) {
      // Emit the update to parent
      emit('update:mask', { values: addedCoordinates, add: true })
    }
  } else if (props.state.mode === 'erase') {
    const removedCoordinates = removeMaskCoordinates([coordinates])
    if (removedCoordinates.length > 0) {
      // Emit the update to parent
      emit('update:mask', { values: removedCoordinates, add: false })
    }
  }
}

// Handle multiple mask updates efficiently
const handleMaskUpdates = (coordinates: { x: number; y: number }[]) => {
  if (props.state.mode === 'mask') {
    const addedCoordinates = addMaskCoordinates(coordinates)

    // Emit all updates at once if any were added
    if (addedCoordinates.length > 0) {
      emit('update:mask', { values: addedCoordinates, add: true })
    }
  } else if (props.state.mode === 'erase') {
    const removedCoordinates = removeMaskCoordinates(coordinates)

    // Emit all updates at once if any were removed
    if (removedCoordinates.length > 0) {
      emit('update:mask', { values: removedCoordinates, add: false })
    }
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

// Shape tool functions
const clearShape = () => {
  // Remove all shape visual elements
  shapeLines.forEach(line => line.remove())
  shapeLines = []
  if (shapePolygon) {
    shapePolygon.remove()
    shapePolygon = null
  }
  shapeNodes = []
}

const addShapeNode = (cell: { x: number; y: number }) => {
  // Check if this is the same as the starting node (first node in the shape)
  if (shapeNodes.length > 0 && shapeNodes[0].x === cell.x && shapeNodes[0].y === cell.y) {
    // End shape selection without closing the shape
    closeShape()
    return
  }

  shapeNodes.push(cell)
  updateShapeVisual()
}


const updateShapeVisual = () => {
  if (!svg || shapeNodes.length === 0) return

  // Clear existing shape elements
  shapeLines.forEach(line => line.remove())
  shapeLines = []
  if (shapePolygon) {
    shapePolygon.remove()
    shapePolygon = null
  }

  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return

  const transform = d3.zoomTransform(svg.node())

  // Calculate centering offset
  const totalDataWidth = cols.value * squareSize.value
  const totalDataHeight = rows.value * squareSize.value
  const offsetX = (rect.width - totalDataWidth) / 2
  const offsetY = (rect.height - totalDataHeight) / 2

  // Convert cell coordinates to screen coordinates
  const screenCoords = shapeNodes.map(node => ({
    x: offsetX + node.x * squareSize.value + squareSize.value / 2,
    y: offsetY + node.y * squareSize.value + squareSize.value / 2
  }))

  // Apply transform
  const transformedCoords = screenCoords.map(coord => ({
    x: coord.x * transform.k + transform.x,
    y: coord.y * transform.k + transform.y
  }))

  // Draw lines between nodes
  for (let i = 0; i < shapeNodes.length - 1; i++) {
    const line = svg.append("line")
      .attr("x1", transformedCoords[i].x)
      .attr("y1", transformedCoords[i].y)
      .attr("x2", transformedCoords[i + 1].x)
      .attr("y2", transformedCoords[i + 1].y)
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5")
      .style("pointer-events", "none")

    shapeLines.push(line)
  }

  // Draw nodes
  transformedCoords.forEach(coord => {
    const circle = svg.append("circle")
      .attr("cx", coord.x)
      .attr("cy", coord.y)
      .attr("r", 4)
      .attr("fill", "#3b82f6")
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .style("pointer-events", "none")

    shapeLines.push(circle)
  })
}

// Update shape visual when zoom/pan changes
const updateShapeVisualOnTransform = () => {
  if (shapeNodes.length > 0) {
    updateShapeVisual()
  }
}

const closeShape = () => {
  if (shapeNodes.length < 3) {
    clearShape()
    return
  }

  // Create polygon points for point-in-polygon test
  const polygonPoints = shapeNodes.map(node => [node.x, node.y])

  // Find all cells that intersect with the polygon
  const cellsInShape: { x: number; y: number }[] = []

  for (let y = 0; y < rows.value; y++) {
    for (let x = 0; x < cols.value; x++) {
      if (isCellIntersectingPolygon(x, y, polygonPoints)) {
        cellsInShape.push({ x, y })
      }
    }
  }

  // Add all cells in the shape to the mask
  if (cellsInShape.length > 0) {
    handleMaskUpdates(cellsInShape)
  }

  // Clear the shape
  clearShape()
}

// Test if a cell rectangle intersects with a polygon
const isCellIntersectingPolygon = (x: number, y: number, polygon: number[][]): boolean => {
  // Test if the center of the cell is inside the polygon
  const centerX = x + 0.5
  const centerY = y + 0.5

  if (isPointInPolygon(centerX, centerY, polygon)) {
    return true
  }

  // Also test if any polygon edge intersects with the cell rectangle
  const cellRect = { x, y, width: 0.5, height: 0.5 }
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length
    const edgeStart = polygon[i]
    const edgeEnd = polygon[j]

    if (lineIntersectsRect(edgeStart, edgeEnd, cellRect)) {
      return true
    }
  }

  return false
}

// Test if a line segment intersects with a rectangle
const lineIntersectsRect = (lineStart: number[], lineEnd: number[], rect: { x: number, y: number, width: number, height: number }): boolean => {
  const rectLeft = rect.x
  const rectRight = rect.x + rect.width
  const rectTop = rect.y
  const rectBottom = rect.y + rect.height

  // Check if line is completely outside the rectangle
  if (Math.max(lineStart[0], lineEnd[0]) < rectLeft ||
    Math.min(lineStart[0], lineEnd[0]) > rectRight ||
    Math.max(lineStart[1], lineEnd[1]) < rectTop ||
    Math.min(lineStart[1], lineEnd[1]) > rectBottom) {
    return false
  }

  // Check if line crosses any of the rectangle's edges
  const edges = [
    [[rectLeft, rectTop], [rectRight, rectTop]],     // top edge
    [[rectRight, rectTop], [rectRight, rectBottom]], // right edge
    [[rectRight, rectBottom], [rectLeft, rectBottom]], // bottom edge
    [[rectLeft, rectBottom], [rectLeft, rectTop]]    // left edge
  ]

  for (const edge of edges) {
    if (linesIntersect(lineStart, lineEnd, edge[0], edge[1])) {
      return true
    }
  }

  return false
}

// Test if two line segments intersect
const linesIntersect = (a1: number[], a2: number[], b1: number[], b2: number[]): boolean => {
  const det = (a: number[], b: number[]) => a[0] * b[1] - a[1] * b[0]

  const delta = [a2[0] - a1[0], a2[1] - a1[1]]
  const delta1 = [b1[0] - a1[0], b1[1] - a1[1]]
  const delta2 = [b2[0] - a1[0], b2[1] - a1[1]]

  const d = det(delta, delta1)
  const d1 = det(delta, delta2)

  if (d * d1 > 0) return false

  const delta3 = [b2[0] - b1[0], b2[1] - b1[1]]
  const delta4 = [a1[0] - b1[0], a1[1] - b1[1]]
  const delta5 = [a2[0] - b1[0], a2[1] - b1[1]]

  const d2 = det(delta3, delta4)
  const d3 = det(delta3, delta5)

  if (d2 * d3 > 0) return false

  return true
}

// Point-in-polygon test using ray casting algorithm
const isPointInPolygon = (x: number, y: number, polygon: number[][]): boolean => {
  let inside = false
  const n = polygon.length

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0]
    const yi = polygon[i][1]
    const xj = polygon[j][0]
    const yj = polygon[j][1]

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }

  return inside
}

const cursorStyle = computed(() => {
  if (props.state.tool === 'hand') {
    return 'grab'
  }
  if (props.state.tool === 'select') {
    return 'crosshair'
  }
  if (props.state.tool === 'shape') {
    return 'crosshair'
  }
  if (props.state.mode === 'mask' || props.state.mode === 'erase') {
    return 'pointer'
  }
  return 'default'
})

// Computed property for shape tool status
const shapeStatus = computed(() => {
  if (props.state.tool === 'shape' && (props.state.mode === 'mask' || props.state.mode === 'erase')) {
    if (shapeNodes.length === 0) {
      return 'Click to add shape nodes'
    } else if (shapeNodes.length < 3) {
      return `Shape: ${shapeNodes.length} nodes (need at least 3)`
    } else {
      return `Shape: ${shapeNodes.length} nodes - Press Enter to close, Escape to cancel`
    }
  }
  return ''
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

    // Handle shape tool keyboard events
    if (props.state.tool === 'shape' && (props.state.mode === 'mask' || props.state.mode === 'erase')) {
      if (event.key === 'Escape') {
        clearShape()
      } else if (event.key === 'Enter') {
        closeShape()
      }
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
      if (props.state.tool === 'select' && (props.state.mode === 'mask' || props.state.mode === 'erase')) {
        const cell = getCellFromMousePosition(event)
        if (cell) {
          isSelecting = true
          selectionStart = cell
          selectionEnd = cell
          createSelectionRect()
          updateSelectionRect()
        }
      }

      // Add shape node if in shape mode
      // Note: Shape nodes are now handled by rectangle-specific events for better precision
      // This global handler is kept for other tools but shape tool uses the rectangle events
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

    // Handle shift + drag for masking/erasing
    if (isShiftPressed && isMousePressed && (props.state.mode === 'mask' || props.state.mode === 'erase') && !isCtrlPressed && props.state.tool !== 'hand') {
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

    // Clean up shape elements
    clearShape()
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
      if ((props.state.mode === 'mask' || props.state.mode === 'erase') && props.state.tool !== 'hand') {
        d3.select(this)
          .attr("stroke", "#3b82f6")
          .attr("stroke-width", 1)
      }
    })
    .on("mouseleave", function (this: SVGElement, event: any, d: any) {
      if ((props.state.mode === 'mask' || props.state.mode === 'erase') && props.state.tool !== 'hand') {
        d3.select(this)
          .attr("stroke", "white")
          .attr("stroke-width", 0.1)
      }
    })
    .on("mousedown", function (event: any, d: any) {
      if ((props.state.mode === 'mask' || props.state.mode === 'erase') && !isCtrlPressed && props.state.tool === 'point') {
        handleMaskUpdate({ x: d.j, y: d.i })
      }
      if ((props.state.mode === 'mask' || props.state.mode === 'erase') && !isCtrlPressed && props.state.tool === 'shape') {
        addShapeNode({ x: d.j, y: d.i })
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
      // Update shape visual if needed
      updateShapeVisualOnTransform()
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

// Watch for tool changes and clear shape if switching away from shape tool
watch([() => props.state.tool, () => props.state.mode], ([newTool, newMode], [oldTool, oldMode]) => {
  if ((oldTool === 'shape' && newTool !== 'shape') ||
    (oldTool === 'shape' && oldMode === 'mask' && newMode !== 'mask' && newMode !== 'erase')) {
    clearShape()
  }
})


// Watch for transform changes and update
watch([() => props.state.transform], () => {
  updateTransform(props.state.transform)
  // Update shape visual when transform changes
  if (shapeNodes.length > 0) {
    updateShapeVisual()
  }
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
  <div class="w-full h-full relative" ref="containerRef" :style="{ cursor: cursorStyle }">
    <!-- Shape tool status -->
    <div v-if="shapeStatus"
      class="absolute top-2 left-2 bg-blue-100 border border-blue-300 rounded px-2 py-1 text-xs text-blue-800 z-10">
      {{ shapeStatus }}
    </div>
  </div>
</template>

<style scoped></style>
