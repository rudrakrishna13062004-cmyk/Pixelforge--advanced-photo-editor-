import { Adjustments } from './types';

export const INITIAL_ADJUSTMENTS: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0,
  sepia: 0,
  hueRotate: 0,
  blur: 0,
  invert: 0,
  exposure: 100,
  gamma: 100,
  vignette: 0,
  noise: 0,
  grain: 0,
  perspectiveH: 0,
  perspectiveV: 0,
  duotoneEnabled: false,
  duotoneLight: '#ffffff',
  duotoneDark: '#000000',
};

export const ULTRA_PRESETS = [
  { name: 'Original', id: 'orig', adj: INITIAL_ADJUSTMENTS },
  { name: 'Cyberpunk', id: 'cyber', adj: { ...INITIAL_ADJUSTMENTS, hueRotate: 280, saturation: 160, contrast: 120 } },
  { name: 'Midnight', id: 'mid', adj: { ...INITIAL_ADJUSTMENTS, brightness: 70, contrast: 140, exposure: 80, sepia: 20 } },
  { name: 'Golden Hour', id: 'gold', adj: { ...INITIAL_ADJUSTMENTS, sepia: 40, saturation: 140, brightness: 110 } },
  { name: 'Noir 400', id: 'noir', adj: { ...INITIAL_ADJUSTMENTS, grayscale: 100, contrast: 180, grain: 2000 } },
  { name: 'Faded Film', id: 'fade', adj: { ...INITIAL_ADJUSTMENTS, exposure: 120, saturation: 80, contrast: 90, sepia: 15 } },
];

export const BLEND_MODES: GlobalCompositeOperation[] = [
  'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light'
];
