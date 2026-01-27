import React, { createContext, useContext, useEffect, useState } from 'react';
import { Theme } from '../types/theme';
import { softMachine, themes } from '../theme/themes';

interface ThemeContextType {
    theme: Theme;
    setTheme: (id: string) => void;
    toggleTheme: () => void;
    availableThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // initialize from local storage or default
    const [theme, setThemeState] = useState<Theme>(() => {
        const savedId = localStorage.getItem('velocity-theme');
        const found = themes.find(t => t.id === savedId);
        return found || softMachine;
    });

    const setTheme = (id: string) => {
        const newTheme = themes.find(t => t.id === id);
        if (newTheme) {
            setThemeState(newTheme);
            localStorage.setItem('velocity-theme', newTheme.id);
        }
    };

    const toggleTheme = () => {
        const currentIndex = themes.findIndex(t => t.id === theme.id);
        const nextIndex = (currentIndex + 1) % themes.length;
        setTheme(themes[nextIndex].id);
    };

    // Inject CSS variables
    useEffect(() => {
        const root = document.documentElement;

        // 1. Set data-theme for legacy selectors and component-specific overrides
        root.setAttribute('data-theme', theme.id);

        // 2. Inject Colors
        Object.entries(theme.colors).forEach(([key, value]) => {
            // Convert camelCase to kebab-case for CSS variables
            // e.g. vizPrimary -> --viz-primary, vizPalette1 -> --viz-palette-1
            const cssVarName = `--${key.replace(/([A-Z0-9])/g, '-$1').toLowerCase()}`;
            root.style.setProperty(cssVarName, value);
        });

        // 3. Inject Radius
        const radiusMap: Record<string, string> = {
            'none': '0',
            'sm': '0.125rem',
            'md': '0.375rem',
            'lg': '0.5rem',
            'xl': '0.75rem',
            '2xl': '1rem',
            'full': '9999px',
        };
        root.style.setProperty('--radius', radiusMap[theme.radius] || '0.5rem');

        // 4. Inject Typography
        root.style.setProperty('--font-body', theme.typography.fontFamily);
        root.style.setProperty('--font-display', theme.typography.headingFont);
        root.style.setProperty('--font-mono', theme.typography.monoFont);

        // 5. Inject Shadows (Simplified mapping)
        const shadowMap: Record<string, string> = {
            'none': 'none',
            'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
            'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
            '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
            'glow': `0 0 20px ${theme.colors.primary}80`,
        };
        root.style.setProperty('--shadow-theme', shadowMap[theme.shadow] || 'none');

    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, availableThemes: themes }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
