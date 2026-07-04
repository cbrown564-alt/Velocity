import React from 'react';
import { CheckCircle, SlidersHorizontal, Hash, Type, Calendar, Grid3X3, SquareCheck } from 'lucide-react';

export interface VariableTypeIconProps {
  type?: string;
  structure?: 'single' | 'multiple' | 'grid';
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const MONOCHROME_BOX =
  'inline-flex items-center justify-center shrink-0 rounded border border-[var(--border-color)] text-[var(--text-tertiary)]';

export const VariableTypeIcon: React.FC<VariableTypeIconProps> = ({
  type,
  structure = 'single',
  size = 14,
  className = '',
  style,
}) => {
  const boxClass = `${MONOCHROME_BOX} ${className}`.trim();
  const iconSize = Math.max(10, size - 4);
  const renderIcon = (icon: React.ReactNode) => (
    <span className={boxClass} style={{ width: size + 6, height: size + 6, ...style }}>
      {icon}
    </span>
  );
  if (structure === 'grid') return renderIcon(<Grid3X3 size={iconSize} />);
  if (structure === 'multiple') return renderIcon(<SquareCheck size={iconSize} />);
  switch (type) {
    case 'categorical':
    case 'nominal':
      return renderIcon(<CheckCircle size={iconSize} />);
    case 'ordered':
    case 'ordinal':
    case 'scale':
      return renderIcon(<SlidersHorizontal size={iconSize} />);
    case 'numeric':
      return renderIcon(<Hash size={iconSize} />);
    case 'text':
      return renderIcon(<Type size={iconSize} />);
    case 'date':
      return renderIcon(<Calendar size={iconSize} />);
    default:
      return renderIcon(<CheckCircle size={iconSize} />);
  }
};
