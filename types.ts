
export type VariableType = 'categorical' | 'numeric' | 'ordinal';

export interface Variable {
  id: string;
  label: string;
  type: VariableType;
  options?: string[]; // For categorical order
}

export interface Respondent {
  id: string;
  [key: string]: string | number;
}

export interface DataSet {
  variables: Variable[];
  data: Respondent[];
}

export type DragItem = {
  id: string;
  label: string;
};

export type DropZoneType = 'row' | 'column';

export interface TableConfig {
  rowVar: string | null;
  colVar: string | null;
}

// New type for SQL result sets
export interface AggregatedRow {
  rowKey: string;
  colKey: string;
  count: number;
}

// -- COLLABORATION TYPES --
export interface Collaborator {
  id: string;
  name: string;
  color: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  activeAction?: string; // e.g., "Dragging Gender..."
}
