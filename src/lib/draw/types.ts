export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export type Dash = 'solid' | 'dashed' | 'dotted'
export type Side = 't' | 'r' | 'b' | 'l'
export type ArrowKind = 'none' | 'arrow' | 'triangle' | 'open' | 'diamond' | 'dot' | 'bar'
export type FontKey = 'sans' | 'serif' | 'mono' | 'hand'
export type Align = 'left' | 'center' | 'right'
export type Route = 'straight' | 'orth' | 'curve'

export interface Style {
  fill: string // 'none' or a color
  stroke: string // 'none' or a color
  sw: number
  dash: Dash
  opacity: number
  radius: number
  shadow: boolean
  sketch: boolean
  fs: number
  color: string
  bold: boolean
  italic: boolean
  align: Align
  font: FontKey
}

export type ShapeKind =
  | 'rect' | 'ellipse' | 'diamond' | 'triangle' | 'hexagon' | 'parallelogram' | 'trapezoid' | 'cylinder' | 'cloud'
  | 'document' | 'process' | 'callout' | 'star' | 'actor' | 'class' | 'package' | 'note' | 'text' | 'icon' | 'chevron'

interface Base { id: string; g?: string; lock?: boolean }
export interface ShapeEl extends Base { t: 'shape'; kind: ShapeKind; x: number; y: number; w: number; h: number; text: string; s: Style; ic?: string }
export interface End { id?: string; side?: Side; x?: number; y?: number }
export interface EdgeEl extends Base { t: 'edge'; a: End; b: End; route: Route; bend: number; text: string; s: Style; tail: ArrowKind; head: ArrowKind }
export interface StrokeEl extends Base { t: 'stroke'; pts: number[]; s: Style; hl?: boolean }
export interface ImageEl extends Base { t: 'image'; x: number; y: number; w: number; h: number; src: string; s: Style }
export type El = ShapeEl | EdgeEl | StrokeEl | ImageEl
export type Node = ShapeEl | ImageEl

export interface Doc { v: 1; els: El[]; bg: string; grid: boolean; gridSize: number; snap: boolean }

export const FONTS: Record<FontKey, string> = {
  sans: 'Inter, "Segoe UI", Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  hand: '"Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Sans MS", cursive',
}
export const DEFAULT_INK = '#1f2937'
export const defaultStyle = (): Style => ({ fill: '#ffffff', stroke: '#1f2937', sw: 2, dash: 'solid', opacity: 1, radius: 0, shadow: false, sketch: false, fs: 16, color: '#1f2937', bold: false, italic: false, align: 'center', font: 'sans' })
export const emptyDoc = (): Doc => ({ v: 1, els: [], bg: '#ffffff', grid: true, gridSize: 20, snap: true })
export const isNode = (e: El): e is Node => e.t === 'shape' || e.t === 'image'
