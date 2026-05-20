/** @type {import('tailwindcss').Config} */
module.exports = {

    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // 1. Surface & Backgrounds
                bg: {
                    app: 'var(--bg-app)',       // #0D0D0D
                    panel: 'var(--bg-panel)',   // #141619
                    surface: 'var(--bg-surface)', // #1C1F24
                    active: 'var(--bg-active)',
                },
                // 2. Typography
                text: {
                    primary: 'var(--text-primary)', // #E8EAED
                    secondary: 'var(--text-secondary)',
                    accent: 'var(--text-accent)',   // #00D4FF
                    inverse: 'var(--text-inverse)',
                },
                // 3. Borders & Dividers
                border: {
                    DEFAULT: 'var(--border-color)',
                    muted: 'var(--border-color-muted)',
                    active: 'var(--border-color-active)',
                    grid: 'var(--border-grid)',
                    subtle: 'var(--border-subtle)',
                },
                // 4. Data Visualization Palette (The Holographic System)
                viz: {
                    fill: {
                        primary: 'var(--viz-fill-primary)',   // Transparent Cyan
                        secondary: 'var(--viz-fill-secondary)', // Solid Cyan
                        muted: 'var(--viz-fill-muted)',
                    },
                    stroke: {
                        main: 'var(--viz-stroke-main)',
                        bar: 'var(--viz-stroke-bar)',         // Solid Cyan Stroke
                    },
                    grid: 'var(--viz-grid-line)',
                    text: {
                        value: 'var(--viz-text-value)',
                        axis: 'var(--viz-text-axis)',
                    }
                },
                // 5. Functional Status
                status: {
                    error: { bg: 'var(--status-error-bg)', text: 'var(--status-error-text)' },
                    warning: { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)' },
                    success: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)' },
                },
                // Legacy/Generic (Mapped to new system)
                gray: {
                    800: '#1E1E1E', // Dark Grey for manual overrides if needed
                    900: '#0D0D0D', // Deep Charcoal
                }
            },
            fontFamily: {
                // Mission Control Fonts
                sans: ['var(--font-body)', 'sans-serif'],    // DM Sans
                display: ['var(--font-display)', 'serif'],   // Using serif fallback as per original
                mono: ['var(--font-mono)', 'monospace'],     // JetBrains Mono
            },
            spacing: {
                1: 'var(--space-1)',
                2: 'var(--space-2)',
                3: 'var(--space-3)',
                4: 'var(--space-4)',
                6: 'var(--space-6)',
                8: 'var(--space-8)',
                12: 'var(--space-12)',
                16: 'var(--space-16)',
            },
            borderRadius: {
                sm: 'var(--border-radius-sm)',
                md: 'var(--border-radius-md)',
                lg: 'var(--border-radius-lg)',
            },
            boxShadow: {
                xs: 'var(--shadow-xs)',
                sm: 'var(--shadow-sm)',
                md: 'var(--shadow-md)',
                lg: 'var(--shadow-lg)',
                xl: 'var(--shadow-xl)',
                '2xl': 'var(--shadow-2xl)',
                inset: 'var(--shadow-inset)',
                'inset-lg': 'inset 0 2px 10px 0 rgb(0 0 0 / 0.05)',
                float: 'var(--shadow-float)',
                drag: 'var(--shadow-drag)',
                up: 'var(--shadow-up)',
                text: 'var(--shadow-text)',
            }
        },
    },
    plugins: [],
}
