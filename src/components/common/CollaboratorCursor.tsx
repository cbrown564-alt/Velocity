
import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion, DURATIONS } from '../../lib/motion';
import { MousePointer2 } from 'lucide-react';
import { Collaborator } from '../../types';

export const CollaboratorCursor: React.FC<{ user: Collaborator }> = ({ user }) => {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: 1,
        scale: 1,
        left: `${user.x}%`,
        top: `${user.y}%`
      }}
      transition={{
        duration: reducedMotion ? DURATIONS.instant : 1.5,
        ease: "easeInOut" // Smooth floating movement
      }}
      className="absolute pointer-events-none z-50 flex flex-col items-start font-body"
      style={{ color: user.color }}
    >
      <MousePointer2 size={16} fill={user.color} className="relative z-10" />

      <div className="ml-3 -mt-1 bg-[var(--bg-surface)] border shadow-sm rounded-lg px-2 py-1 flex flex-col min-w-max" style={{ borderColor: user.color }}>
        <span className="text-[10px] font-bold leading-none" style={{ color: user.color }}>
          {user.name}
        </span>
        {user.activeAction && (
          <span className="text-[10px] text-[var(--text-secondary)] font-medium whitespace-nowrap mt-0.5">
            {user.activeAction}
          </span>
        )}
      </div>
    </motion.div>
  );
};
