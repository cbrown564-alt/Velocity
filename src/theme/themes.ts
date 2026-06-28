import { Theme } from '../types/theme';

export const softMachine: Theme = {
  id: 'soft-machine',
  name: 'Soft Machine',
  description: 'Warm, organic, human-centric interface',
  mode: 'light',
  colors: {
    background: '#F0EDE8',
    foreground: '#2D4A3E',
    card: '#FAF8F5',
    cardForeground: '#2D4A3E',
    popover: '#FFFFFF',
    popoverForeground: '#2D4A3E',
    primary: '#E07860',
    primaryForeground: '#FFFFFF',
    secondary: '#E6E2DC',
    secondaryForeground: '#2D4A3E',
    muted: '#F0EDE8',
    mutedForeground: '#6B8BA4',
    accent: '#E07860',
    accentForeground: '#FFFFFF',
    destructive: '#FBEAEA',
    destructiveForeground: '#D32F2F',
    border: '#E0DCD6',
    input: '#E0DCD6',
    ring: '#E07860',

    // Viz
    vizPrimary: '#2D4A3E',
    vizSecondary: '#E07860',
    vizMuted: '#E0DCD6',
    vizStroke: '#B0A8A0',
    vizGrid: 'rgba(45, 74, 62, 0.05)',
    vizTextValue: '#2D4A3E',
    vizTextAxis: '#6B8BA4',
    vizPalette1: '#2D4A3E',
    vizPalette2: '#E07860',
    vizPalette3: '#E8B468',
    vizPalette4: '#6B8BA4',
    vizPalette5: '#A45D5D',
    vizPalette6: '#5C7065',
    vizDiverging1: '#2D4A3E',
    vizDiverging2: '#6B8BA4',
    vizDiverging3: '#E0DCD6',
    vizDiverging4: '#E8B468',
    vizDiverging5: '#E07860',
    vizDiverging6: '#D32F2F', // Defaulting 6 to destructive/red just in case
    // 10-Point Diverging Scale (Orange -> Neutral -> Green)
    vizScale1: '#E07860', // Most Negative (Dark Orange)
    vizScale2: '#E8A86E',
    vizScale3: '#E4B486',
    vizScale4: '#E0C09E',
    vizScale5: '#DBCBB6', // Muted Orange/Beige
    vizScale6: '#719A8E', // Muted Green
    vizScale7: '#547A6E',
    vizScale8: '#476A5E',
    vizScale9: '#3A5A4E',
    vizScale10: '#2D4A3E', // Most Positive (Dark Green)
    // Significance markers — chosen for contrast on Soft Machine's warm cream bg
    sigHigher: '#547A6E', // mid sage-teal: reads clearly as green at small sizes
    sigLower: '#D32F2F', // same as destructiveForeground: clear red
  },
  radius: 'lg',
  shadow: 'sm',
  typography: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    headingFont: "'Fraunces', serif",
    monoFont: "'JetBrains Mono', monospace",
  },
};

export const missionControl: Theme = {
  id: 'mission-control',
  name: 'Mission Control',
  description: 'High-contrast dark mode for data-intensive work',
  mode: 'dark',
  colors: {
    background: '#141414',
    foreground: '#E0E0E0',
    card: '#1A1D21',
    cardForeground: '#E0E0E0',
    popover: '#22252A',
    popoverForeground: '#E0E0E0',
    primary: '#00D4FF',
    primaryForeground: '#000000',
    secondary: '#2A2D35',
    secondaryForeground: '#00D4FF',
    muted: '#22252A',
    mutedForeground: '#B0B8C1',
    accent: '#00D4FF',
    accentForeground: '#000000',
    destructive: 'rgba(255, 82, 82, 0.15)',
    destructiveForeground: '#FF8A80',
    border: '#2A2A2A',
    input: '#2A2A2A',
    ring: '#00D4FF',

    // Viz
    vizPrimary: 'rgba(0, 212, 255, 0.2)',
    vizSecondary: '#00D4FF',
    vizMuted: '#2A2D35',
    vizStroke: '#3C4043',
    vizGrid: '#303134',
    vizTextValue: '#E0E0E0',
    vizTextAxis: '#9AA0A6',
    // Sequential cyan ramp — one coherent instrument panel (UXP-033)
    vizPalette1: '#00D4FF',
    vizPalette2: '#00BFE6',
    vizPalette3: '#2096BD',
    vizPalette4: '#406D94',
    vizPalette5: '#605870',
    vizPalette6: '#347A8B',
    vizDiverging1: '#00D4FF',
    vizDiverging2: '#347A8B',
    vizDiverging3: '#3C4043',
    vizDiverging4: '#9A4E4E',
    vizDiverging5: '#FF5252',
    vizDiverging6: '#FF5252', // Fallback
    // 10-Point Diverging Scale (Cyan -> Grey -> Red)
    vizScale1: '#00D4FF', // Cyan
    vizScale2: '#00BFE6',
    vizScale3: '#2096BD',
    vizScale4: '#406D94',
    vizScale5: '#605870', // Greyish
    vizScale6: '#805060',
    vizScale7: '#9F4858',
    vizScale8: '#BF4050',
    vizScale9: '#DF3848',
    vizScale10: '#FF5252', // Red
    // Significance markers — chosen for contrast on Mission Control's dark bg
    sigHigher: '#00E5A0', // bright teal-green: pops on dark background
    sigLower: '#FF5252', // same as vizDiverging6: bright red
  },
  radius: 'sm',
  shadow: 'lg',
  typography: {
    fontFamily: "'DM Sans', -apple-system, sans-serif",
    headingFont: "'DM Sans', sans-serif",
    monoFont: "'JetBrains Mono', monospace",
  },
};

export const liquidGlass: Theme = {
  id: 'liquid-glass',
  name: 'Liquid Glass',
  description: 'Translucent, biomorphic interface inspired by spatial computing',
  mode: 'light',
  colors: {
    background: '#e0e5ec', // Neu/Glass base
    foreground: '#1d1d1f', // Apple text gray/black
    card: 'rgba(255, 255, 255, 0.3)', // Much lighter
    cardForeground: '#1d1d1f',
    popover: 'rgba(255, 255, 255, 0.4)', // Lighter overlay
    popoverForeground: '#1d1d1f',
    primary: '#007AFF', // System Blue
    primaryForeground: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.2)',
    secondaryForeground: '#007AFF',
    muted: 'rgba(0, 0, 0, 0.05)',
    mutedForeground: '#86868b',
    accent: '#007AFF',
    accentForeground: '#FFFFFF',
    destructive: '#FF3B30',
    destructiveForeground: '#FFFFFF',
    border: 'rgba(255, 255, 255, 0.3)', // Subtle borders
    input: 'rgba(0, 0, 0, 0.1)',
    ring: '#007AFF',

    // Viz
    vizPrimary: '#007AFF',
    vizSecondary: '#1D6FDB',
    vizMuted: 'rgba(255, 255, 255, 0.5)',
    vizStroke: 'rgba(0, 0, 0, 0.2)',
    vizGrid: 'rgba(0, 0, 0, 0.05)',
    vizTextValue: '#1d1d1f',
    vizTextAxis: '#4E5563',
    vizPalette1: '#0058CC',
    vizPalette2: '#1F7A36',
    vizPalette3: '#B84A00',
    vizPalette4: '#B0003B',
    vizPalette5: '#6C36A0',
    vizPalette6: '#2E3F9E',
    vizDiverging1: '#007AFF',
    vizDiverging2: '#5AC8FA',
    vizDiverging3: '#e0e5ec',
    vizDiverging4: '#FF9500',
    vizDiverging5: '#FF3B30',
    vizDiverging6: '#FF2D55',
    // 10-Point Diverging Scale (Blue -> Grey -> Red)
    vizScale1: '#007AFF', // Blue
    vizScale2: '#1C86FF',
    vizScale3: '#3992FF',
    vizScale4: '#559EFF',
    vizScale5: '#8CB4E0', // Pale Blue
    vizScale6: '#E0A09C', // Pale Red
    vizScale7: '#FF7D75',
    vizScale8: '#FF5E54',
    vizScale9: '#FF3F33',
    vizScale10: '#FF3B30', // Red
    // Significance markers — iOS system semantic colors
    sigHigher: '#34C759', // iOS system green
    sigLower: '#FF2D55', // iOS system red/pink
  },
  radius: '2xl',
  shadow: 'xl', // We will augment this with CSS
  materials: {
    surface: {
      background: 'rgba(240, 245, 255, 0.22)',
      backdropFilter: 'blur(34px) saturate(155%)',
      border: 'rgba(255, 255, 255, 0.28)',
    },
    panel: {
      background: 'rgba(255, 255, 255, 0.4)',
      backdropFilter: 'blur(32px) saturate(190%)',
      border: 'rgba(255, 255, 255, 0.45)',
    },
    overlay: {
      background: 'rgba(255, 255, 255, 0.48)',
      backdropFilter: 'blur(42px) saturate(210%)',
      border: 'rgba(255, 255, 255, 0.5)',
    },
  },
  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    headingFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
    monoFont: "'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
  },
};

export const themes = [softMachine, missionControl, liquidGlass];
