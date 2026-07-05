import { Theme } from '../types/theme';

/**
 * The single Velocity theme — evolved Soft Machine (design reset, plan_05 §2).
 * Warm neutrals, green-ink text, one sienna accent under a strict budget.
 * These values are mirrored statically in src/index.css `:root`; this object
 * exists for consumers that need theme constants outside CSS (exports).
 */
export const velocity: Theme = {
  id: 'velocity',
  name: 'Velocity',
  description: 'Calm, story-first: warm neutrals, green-ink text, sienna accent',
  mode: 'light',
  colors: {
    background: '#F1EFEA',
    foreground: '#24302A',
    card: '#FDFCFA',
    cardForeground: '#24302A',
    popover: '#FDFCFA',
    popoverForeground: '#24302A',
    primary: '#B54E33',
    primaryForeground: '#FFFDFB',
    secondary: '#ECE9E3',
    secondaryForeground: '#24302A',
    muted: '#F7F5F0',
    mutedForeground: '#67736C',
    accent: '#B54E33',
    accentForeground: '#FFFDFB',
    destructive: '#F9E8E4',
    destructiveForeground: '#B42318',
    border: '#E3DFD7',
    input: '#ECE8E1',
    ring: '#24302A',

    // Viz — sage carries single-series marks; the categorical slots are
    // chromatic enough to do identity work (validated: lightness band,
    // chroma floor, adjacent-pair CVD, 3:1 contrast on panel and ground).
    vizPrimary: '#6F8177',
    vizSecondary: '#AC562C',
    vizMuted: '#DAD5CB',
    vizStroke: '#B8B2A6',
    vizGrid: 'rgba(36, 48, 42, 0.06)',
    vizTextValue: '#24302A',
    vizTextAxis: '#67736C',
    vizPalette1: '#317A4A',
    vizPalette2: '#3577AB',
    vizPalette3: '#AC562C',
    vizPalette4: '#8A4976',
    vizPalette5: '#A68023',
    vizPalette6: '#5B62C0',
    vizDiverging1: '#56695E',
    vizDiverging2: '#6F8177',
    vizDiverging3: '#D8D3C8',
    vizDiverging4: '#C2876C',
    vizDiverging5: '#B54E33',
    vizDiverging6: '#9E3B22',
    // 10-point diverging scale (sienna → warm neutral → sage)
    vizScale1: '#B54E33',
    vizScale2: '#BC6B4F',
    vizScale3: '#C2876C',
    vizScale4: '#C9A28B',
    vizScale5: '#CDBBAC',
    vizScale6: '#A9B2A4',
    vizScale7: '#93A093',
    vizScale8: '#7E8E82',
    vizScale9: '#6F8177',
    vizScale10: '#56695E',
    // Significance is accent, both directions — the arrow carries direction,
    // the color carries "this is significant" (north-star rule).
    sigHigher: '#B54E33',
    sigLower: '#B54E33',
  },
  radius: 'md',
  shadow: 'sm',
  typography: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    headingFont: "'Fraunces', serif",
    monoFont: "'JetBrains Mono', monospace",
  },
};
