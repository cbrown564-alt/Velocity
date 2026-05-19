import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeSwitcher } from './ThemeSwitcher';
import { ThemeProvider } from '../../context/ThemeContext';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ThemeProvider>{children}</ThemeProvider>
);

describe('ThemeSwitcher', () => {
    beforeEach(() => {
        localStorage.removeItem('velocity-theme');
    });

    it('renders the palette trigger button', () => {
        render(<ThemeSwitcher />, { wrapper: Wrapper });
        expect(screen.getByTitle('Change theme')).toBeInTheDocument();
    });

    it('opens dropdown when trigger is clicked', () => {
        render(<ThemeSwitcher />, { wrapper: Wrapper });
        fireEvent.click(screen.getByTitle('Change theme'));
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(screen.getByText('Choose Theme')).toBeInTheDocument();
    });

    it('renders all three theme preview cards', () => {
        render(<ThemeSwitcher />, { wrapper: Wrapper });
        fireEvent.click(screen.getByTitle('Change theme'));
        expect(screen.getByText('Soft Machine')).toBeInTheDocument();
        expect(screen.getByText('Mission Control')).toBeInTheDocument();
        expect(screen.getByText('Liquid Glass')).toBeInTheDocument();
    });

    it('marks the active theme with a check', () => {
        render(<ThemeSwitcher />, { wrapper: Wrapper });
        fireEvent.click(screen.getByTitle('Change theme'));
        const active = screen.getAllByRole('button', { pressed: true });
        expect(active.length).toBeGreaterThanOrEqual(1);
    });

    it('closes dropdown after selecting a theme', () => {
        render(<ThemeSwitcher />, { wrapper: Wrapper });
        fireEvent.click(screen.getByTitle('Change theme'));
        fireEvent.click(screen.getByText('Mission Control'));
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
});
