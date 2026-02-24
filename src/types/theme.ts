export interface ThemeColors {
    // Base functionality
    background: string
    foreground: string
    card: string
    cardForeground: string
    popover: string
    popoverForeground: string
    primary: string
    primaryForeground: string
    secondary: string
    secondaryForeground: string
    muted: string
    mutedForeground: string
    accent: string
    accentForeground: string
    destructive: string
    destructiveForeground: string
    border: string
    input: string
    ring: string

    // Viz specific (extended from standard registry)
    vizPrimary: string
    vizSecondary: string
    vizMuted: string
    vizStroke: string
    vizGrid: string
    vizTextValue: string
    vizTextAxis: string
    vizPalette1: string
    vizPalette2: string
    vizPalette3: string
    vizPalette4: string
    vizPalette5: string
    vizPalette6: string
    vizDiverging1: string
    vizDiverging2: string
    vizDiverging3: string
    vizDiverging4: string
    vizDiverging5: string
    vizDiverging6: string
    vizScale1?: string
    vizScale2?: string
    vizScale3?: string
    vizScale4?: string
    vizScale5?: string
    vizScale6?: string
    vizScale7?: string
    vizScale8?: string
    vizScale9?: string
    vizScale10?: string
    // Significance markers (explicitly chosen per theme for legibility at small sizes)
    sigHigher?: string   // "significantly higher" arrow — green/positive per theme
    sigLower?: string    // "significantly lower" arrow — red/negative per theme
}

export type ThemeRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface ThemeTypography {
    fontFamily: string
    headingFont: string
    monoFont: string
}

export interface ThemeMaterial {
    background: string
    backdropFilter?: string
    border?: string
    noiseOpacity?: number
}

export interface Theme {
    id: string
    name: string
    description: string
    mode: 'dark' | 'light'
    colors: ThemeColors
    materials?: {
        surface: ThemeMaterial
        panel: ThemeMaterial
        overlay: ThemeMaterial
    }
    radius: ThemeRadius
    shadow: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'glow'
    typography: ThemeTypography
}
