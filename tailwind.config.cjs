/** @type {import('tailwindcss').Config} */
module.exports = {

    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                ink: 'var(--color-ink)',
                paper: 'var(--color-paper)',
                terracotta: 'var(--color-terracotta)',
                charcoal: 'var(--color-charcoal)',
                parchment: 'var(--color-parchment)',
                success: 'var(--color-success)',
                warning: 'var(--color-warning)',
                error: 'var(--color-error)',
                info: 'var(--color-info)',
                gray: {
                    50: 'var(--gray-50)',
                    100: 'var(--gray-100)',
                    200: 'var(--gray-200)',
                    300: 'var(--gray-300)',
                    400: 'var(--gray-400)',
                    500: 'var(--gray-500)',
                    600: 'var(--gray-600)',
                    700: 'var(--gray-700)',
                    800: 'var(--gray-800)',
                    900: 'var(--gray-900)',
                }
            },
            fontFamily: {
                display: ['var(--font-display)', 'serif'],
                body: ['var(--font-body)', 'sans-serif'],
                mono: ['var(--font-mono)', 'monospace'],
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
                inset: 'var(--shadow-inset)',
                float: 'var(--shadow-float)',
                drag: 'var(--shadow-drag)',
            }
        },
    },
    plugins: [],
}
