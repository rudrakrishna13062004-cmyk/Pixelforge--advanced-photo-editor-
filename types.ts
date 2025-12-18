export interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale: number;
  sepia: number;
  hueRotate: number;
  blur: number;
  invert: number;
  exposure: number;
  gamma: number;
  vignette: number;
  noise: number;
  grain: number;
  perspectiveH: number;
  perspectiveV: number;
  duotoneEnabled: boolean;
  duotoneLight: string;
  duotoneDark: string;
}

export type EditorTool = 'adjust' | 'filter' | 'transform' | 'overlay' | 'draw' | 'text' | 'layers' | 'presets' | 'canvas';

export interface OverlayState {
  image: HTMLImageElement | null;
  opacity: number;
  blendMode: GlobalCompositeOperation;
}

export interface DrawingStroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  mode: 'pencil' | 'glow' | 'eraser';
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  fontWeight: string;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
}

export interface EditorState {
  adjustments: Adjustments;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  strokes: DrawingStroke[];
  texts: TextOverlay[];
  canvasBg: string;
}
