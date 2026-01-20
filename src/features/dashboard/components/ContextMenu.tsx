import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ContextMenuAction {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    actions: ContextMenuAction[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, actions, onClose }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('scroll', onClose, true);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('scroll', onClose, true);
        };
    }, [onClose]);

    // Adjust position to stay in viewport
    // Simple clamping for MVP
    const style: React.CSSProperties = {
        top: Math.min(y, window.innerHeight - (actions.length * 40)),
        left: Math.min(x, window.innerWidth - 200),
    };

    return (
        <AnimatePresence>
            <motion.div
                ref={ref}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.1 }}
                className="fixed z-[9999] min-w-[180px] bg-white rounded-lg shadow-lg border border-gray-200 py-1 overflow-hidden"
                style={style}
            >
                {actions.map((action, index) => (
                    <button
                        key={index}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!action.disabled) {
                                action.onClick();
                                onClose();
                            }
                        }}
                        disabled={action.disabled}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors
              ${action.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              ${action.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'}
            `}
                    >
                        {action.icon && <span className="text-gray-400">{action.icon}</span>}
                        {action.label}
                    </button>
                ))}
            </motion.div>
        </AnimatePresence>
    );
};
