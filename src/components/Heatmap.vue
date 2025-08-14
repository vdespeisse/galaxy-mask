<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch, ref } from 'vue'
import * as d3 from 'd3'

interface Props {
  data: (number | null)[][]
  transform?: d3.ZoomTransform
}

const props = withDefaults(defineProps<Props>(), {
  transform: () => d3.zoomIdentity
})

const emit = defineEmits<{
  'update:transform': [transform: d3.ZoomTransform]
}>()

const containerRef = ref<HTMLDivElement>()

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
const getSquareColor = (value: number | null): string => {
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

const updateTransform = (transform: d3.ZoomTransform) => {
  if (g) {
    g.attr("transform", transform)
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

  // Calculate centering offset to center the heatmap in the container
  const totalDataWidth = cols.value * squareSize.value
  const totalDataHeight = rows.value * squareSize.value
  const offsetX = (containerWidth - totalDataWidth) / 2
  const offsetY = (containerHeight - totalDataHeight) / 2

  // Create the heatmap rectangles
  g.selectAll("rect")
    .data(flattenedData.value)
    .join("rect")
    .attr("x", (d: any) => offsetX + d.j * squareSize.value)
    .attr("y", (d: any) => offsetY + d.i * squareSize.value)
    .attr("width", squareSize.value - 0.5)
    .attr("height", squareSize.value - 0.5)
    .attr("fill", (d: any) => getSquareColor(d.value))
    .attr("stroke", "white")
    .attr("stroke-width", 0.1)
    .attr("title", (d: any) => `Row ${d.i}, Col ${d.j}: ${d.value === null ? 'null' : d.value}`)

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
  updateTransform(props.transform)

  // Append SVG to container
  containerRef.value.appendChild(svg.node())
}

// Watch for data changes and recreate heatmap
watch([() => props.data], () => {
  createHeatmap()
}, { deep: true })

// Watch for transform changes and update
watch([() => props.transform], () => {
  updateTransform(props.transform)
}, { deep: true })

onMounted(() => {
  createHeatmap()

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
  if (svg) {
    svg.remove()
  }
})
</script>

<template>
  <div class="border border-gray-300 w-full h-full" ref="containerRef">


  </div>
</template>

<style scoped></style>
