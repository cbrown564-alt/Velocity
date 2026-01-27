import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'soft-machine' | 'mission-control';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem('velocity-theme');
        if (saved === 'mission-control') return saved;
        if (saved === 'soft-machine') return saved;
        // Legacy or default fallback
        return 'soft-machine';
    });

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('velocity-theme', newTheme);
    };

    const toggleTheme = () => {
        setTheme(theme === 'soft-machine' ? 'mission-control' : 'soft-machine');
    };

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
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
