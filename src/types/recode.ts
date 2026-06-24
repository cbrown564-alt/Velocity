export type RecodeMode = 'categorical' | 'binning';

export interface RecodeRule {
  min?: number;
  max?: number;
  label: string;
}

export interface RecodeConfig {
  mode: RecodeMode;
  mappings?: Record<string, string>;
  rules?: RecodeRule[];
}
