import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 24 }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size} className={className}>
      <defs>
        <linearGradient id="logoWave1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--viz-palette-1)" />
          <stop offset="100%" stopColor="var(--color-accent)" />
        </linearGradient>
        <linearGradient id="logoWave2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--viz-palette-2)" />
          <stop offset="100%" stopColor="var(--color-accent)" />
        </linearGradient>
      </defs>
      <path
        d="M15,20 C35,40 45,80 50,90 C55,80 65,40 85,20 C70,35 55,65 50,75 C45,65 30,35 15,20 Z"
        fill="url(#logoWave1)"
      />
      <path
        d="M25,25 C40,40 48,70 50,80 C52,70 60,40 75,25 C65,35 55,55 50,65 C45,55 35,35 25,25 Z"
        fill="url(#logoWave2)"
        opacity="0.8"
      />
    </svg>
  );
};
