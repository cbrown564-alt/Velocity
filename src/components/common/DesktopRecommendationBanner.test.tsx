import React from 'react';
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { DesktopRecommendationBanner, MIN_DESKTOP_RECOMMENDED_WIDTH } from './DesktopRecommendationBanner';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

describe('DesktopRecommendationBanner', () => {
  it('shows guidance below minimum width and hides after resize', () => {
    setViewportWidth(MIN_DESKTOP_RECOMMENDED_WIDTH - 1);
    render(<DesktopRecommendationBanner />);

    expect(screen.getByTestId('desktop-recommendation-banner')).toBeInTheDocument();

    act(() => {
      setViewportWidth(MIN_DESKTOP_RECOMMENDED_WIDTH + 120);
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.queryByTestId('desktop-recommendation-banner')).not.toBeInTheDocument();
  });
});
