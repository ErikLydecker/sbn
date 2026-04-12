/**
 * Monochrome + single accent (violet #7170ff) tokens for Canvas 2D rendering.
 * Canvas does not support CSS custom properties directly.
 */
export const CANVAS_COLORS = {
  accent: '#7170ff',
  rising: '#7170ff',
  peak: '#d0d6e0',
  falling: '#8a8f98',
  trough: '#62666d',
  amber: '#8a8f98',
  gold: '#d0d6e0',
  dim: '#191a1b',
  border: '#23252a',
  bg: '#08090a',
  gridLine: '#0f1011',
  mutedText: '#34343a',
  labelText: '#28282c',
  tickMark: '#191a1b',
  majorTick: '#34343a',
  ring25: '#0f1011',
  ring100: '#23252a',
  centre: '#191a1b',
  dottedLine: 'rgba(255,255,255,0.05)',
} as const

export const CYCLE_COLORS = {
  rising: 'var(--cycle-rising)',
  peak: 'var(--cycle-peak)',
  falling: 'var(--cycle-falling)',
  trough: 'var(--cycle-trough)',
  coherent: 'var(--cycle-coherent)',
  incoherent: 'var(--cycle-incoherent)',
} as const

export type CycleState = keyof typeof CYCLE_COLORS
