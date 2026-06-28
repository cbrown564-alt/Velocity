import React from 'react';
import { MonitorSmartphone } from 'lucide-react';

export const MIN_DESKTOP_RECOMMENDED_WIDTH = 1280;

export interface DesktopRecommendationBannerProps {
  minWidth?: number;
}

export const DesktopRecommendationBanner: React.FC<DesktopRecommendationBannerProps> = ({
  minWidth = MIN_DESKTOP_RECOMMENDED_WIDTH,
}) => {
  const [isNarrow, setIsNarrow] = React.useState(() => window.innerWidth < minWidth);

  React.useEffect(() => {
    const handleResize = () => {
      setIsNarrow(window.innerWidth < minWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [minWidth]);

  if (!isNarrow) return null;

  return (
    <div
      className="fixed top-3 left-1/2 z-[60] w-[min(92vw,640px)] -translate-x-1/2 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] px-3 py-2 text-xs text-[var(--status-warning-text)] shadow-lg"
      role="status"
      aria-live="polite"
      data-testid="desktop-recommendation-banner"
    >
      <div className="flex items-center gap-2">
        <MonitorSmartphone size={14} className="shrink-0" />
        <span>Desktop view recommended: expand to at least {minWidth}px for full Workspace and Canvas controls.</span>
      </div>
    </div>
  );
};
