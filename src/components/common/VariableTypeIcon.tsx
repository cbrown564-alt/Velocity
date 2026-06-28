import React from 'react';
import { CheckCircle, SlidersHorizontal, Hash, Type, Calendar, Grid3X3, SquareCheck } from 'lucide-react';

export interface VariableTypeIconProps {
  type?: string;
  structure?: 'single' | 'multiple' | 'grid';
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const VariableTypeIcon: React.FC<VariableTypeIconProps> = ({
  type,
  structure = 'single',
  size = 14,
  className,
  style,
}) => {
  // Handle structure-based icons (from VariableSetColumn)
  if (structure === 'grid') {
    return <Grid3X3 size={size} className={className} style={style} />;
  }

  if (structure === 'multiple') {
    return <SquareCheck size={size} className={className} style={style} />;
  }

  // Handle type-based icons
  switch (type) {
    case 'categorical':
      return <CheckCircle size={size} className={className} style={style} />;
    case 'ordered':
      return <SlidersHorizontal size={size} className={className} style={style} />;
    case 'nominal':
      return <CheckCircle size={size} className={className} style={style} />;
    case 'ordinal':
    case 'scale':
      return <SlidersHorizontal size={size} className={className} style={style} />;
    case 'numeric':
      return <Hash size={size} className={className} style={style} />;
    case 'text':
      return <Type size={size} className={className} style={style} />;
    case 'date':
      return <Calendar size={size} className={className} style={style} />;
    default:
      return <CheckCircle size={size} className={className} style={style} />;
  }
};
