import type { Theme } from '../../types/theme';
import type { ExportBranding } from './types';

/**
 * Extract the viz palette from a theme as hex strings without '#' prefix.
 * PptxGenJS requires hex colors without the '#' (e.g., 'E07860').
 */
export function resolveExportPalette(theme: Theme): string[] {
  return [
    theme.colors.vizPalette1,
    theme.colors.vizPalette2,
    theme.colors.vizPalette3,
    theme.colors.vizPalette4,
    theme.colors.vizPalette5,
    theme.colors.vizPalette6,
  ].map(stripHash);
}

/**
 * Build a complete ExportBranding object from the active theme.
 */
export function resolveExportBranding(theme: Theme): ExportBranding {
  return {
    primaryColor: stripHash(theme.colors.foreground),
    headerColor: stripHash(theme.colors.accent),
    fontFamily: theme.typography.fontFamily.split(',')[0].replace(/'/g, '').trim(),
    chartColors: resolveExportPalette(theme),
  };
}

/** Strip '#' prefix and resolve rgba() colors to solid hex for PPTX compatibility. */
function stripHash(color: string): string {
  if (color.startsWith('#')) {
    return color.slice(1);
  }
  // Handle rgba() — extract RGB and ignore alpha for PPTX
  const rgbaMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(rgbaMatch[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(rgbaMatch[3], 10).toString(16).padStart(2, '0');
    return `${r}${g}${b}`;
  }
  // Fallback: return as-is (shouldn't happen with well-formed themes)
  return color;
}
