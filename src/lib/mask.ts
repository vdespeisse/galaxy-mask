// Helper functions for coordinate conversion
export const coordToKey = (i: number, j: number): string => `${i},${j}`
export const keyToCoord = (key: string): [number, number] =>
  key.split(',').map(Number) as [number, number]

// Convert 2D boolean array to Set
export const arrayToSet = (mask: boolean[][]): Set<string> => {
  const set = new Set<string>()
  for (let i = 0; i < mask.length; i++) {
    for (let j = 0; j < mask[i].length; j++) {
      if (mask[i][j]) {
        set.add(coordToKey(i, j))
      }
    }
  }
  return set
}

// Convert Set to 2D boolean array
export const setToArray = (
  maskSet: Set<string>,
  rows: number,
  cols: number
): boolean[][] => {
  const array = Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(false))
  for (const key of maskSet) {
    const [i, j] = keyToCoord(key)
    if (i >= 0 && i < rows && j >= 0 && j < cols) {
      array[i][j] = true
    }
  }
  return array
}

// Helper function to compare two masks (comparing Sets)
export const areMasksEqual = (
  mask1: Set<string> | undefined,
  mask2: Set<string>
): boolean => {
  if (!mask1 || mask1.size !== mask2.size) return false

  for (const key of mask1) {
    if (!mask2.has(key)) return false
  }
  return true
}
