export interface Settings {
  colorScheme: string
  interpolationType: 'absolute' | 'percentile'
  interpolationRangeAbsolute: [number, number]
  interpolationRangePercentile: [number, number]
  maskDisplay: 'show' | 'hide' | 'transparent'
}
