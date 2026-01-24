import React, { useEffect, useRef } from 'react';
import styles from './ChartContextMenu.module.css';

export interface ContextMenuOption {
    label: string;
    onClick: () => void;
    danger?: boolean;
}

export interface ChartContextMenuProps {
    isOpen: boolean;
    position: { x: number; y: number };
    title?: string;
    subtitle?: string;
    options: ContextMenuOption[];
    onClose: () => void;
}

export const ChartContextMenu: React.FC<ChartContextMenuProps> = ({
    isOpen,
    position,
    title,
    subtitle,
    options,
    onClose,
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            const handleClick = (e: MouseEvent) => {
                if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                    onClose();
                }
            };
            // Use capture to handle clicks outside immediately
            document.addEventListener('click', handleClick, true);
            return () => document.removeEventListener('click', handleClick, true);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={menuRef}
            className={styles.menu}
            style={{
                top: position.y,
                left: position.x,
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {(title || subtitle) && (
                <div className={styles.header}>
                    {title && <div className={styles.title}>{title}</div>}
                    {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
                </div>
            )}
            <div className={styles.options}>
                {options.map((option, index) => (
                    <button
                        key={index}
                        className={`${styles.option} ${option.danger ? styles.danger : ''}`}
                        onClick={() => {
                            option.onClick();
                            onClose();
                        }}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
};
