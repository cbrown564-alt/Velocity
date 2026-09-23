import { Theme } from '../types/theme';

/**
 * The single Velocity theme — neutral application baseline.
 * Colors are mirrored statically in src/index.css `:root`. This object exists
 * for exports, which use Arial for portable PowerPoint rendering.
 */
export const velocity: Theme = {
  id: 'velocity',
  name: 'Velocity',
  description: 'Clear, professional surfaces with restrained blue actions',
  mode: 'light',
  colors: {
    background: '#F6F8FA',
    foreground: '#17212B',
    card: '#FFFFFF',
    cardForeground: '#17212B',
    popover: '#FFFFFF',
    popoverForeground: '#17212B',
    primary: '#245FA7',
    primaryForeground: '#FFFFFF',
    secondary: '#EEF2F5',
    secondaryForeground: '#17212B',
    muted: '#F7F9FB',
    mutedForeground: '#52606D',
    accent: '#245FA7',
    accentForeground: '#FFFFFF',
    destructive: '#F9E8E4',
    destructiveForeground: '#B42318',
    border: '#D9E1E7',
    input: '#E5EBEF',
    ring: '#245FA7',

    // Viz — sage carries single-series marks; the categorical slots are
    // chromatic enough to do identity work (validated: lightness band,
    // chroma floor, adjacent-pair CVD, 3:1 contrast on panel and ground).
    vizPrimary: '#6F8177',
    vizSecondary: '#AC562C',
    vizMuted: '#DCE3E8',
    vizStroke: '#ABB8C2',
    vizGrid: 'rgba(23, 33, 43, 0.08)',
    vizTextValue: '#17212B',
    vizTextAxis: '#52606D',
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
    sigHigher: '#245FA7',
    sigLower: '#245FA7',
  },
  radius: 'md',
  shadow: 'sm',
  typography: {
    fontFamily: "'Arial', sans-serif",
    headingFont: "'Arial', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
  },
};
