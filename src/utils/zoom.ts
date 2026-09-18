export const ZOOM_PRESETS = [80, 90, 100, 110, 125, 150] as const

export function normalizeZoomPercent(value: number): number {
  if (!Number.isFinite(value)) return 100

  return ZOOM_PRESETS.reduce((closest, preset) =>
    Math.abs(preset - value) < Math.abs(closest - value) ? preset : closest,
  )
}
