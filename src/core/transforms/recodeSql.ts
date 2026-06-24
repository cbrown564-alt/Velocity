import type { RecodeConfig } from '../../types';

export function buildCaseSql(sourceCol: string, config: RecodeConfig): string {
  let caseSql = 'CASE ';

  if (config.mode === 'categorical' && config.mappings) {
    for (const [oldValue, newValue] of Object.entries(config.mappings)) {
      caseSql += `WHEN "${sourceCol}" = '${oldValue.replace(/'/g, "''")}' THEN '${newValue.replace(/'/g, "''")}' `;
    }
  } else if (config.mode === 'binning' && config.rules) {
    for (const rule of config.rules) {
      const parts: string[] = [];
      if (rule.min !== undefined) parts.push(`"${sourceCol}" >= ${rule.min}`);
      if (rule.max !== undefined) parts.push(`"${sourceCol}" < ${rule.max}`);
      if (parts.length > 0) {
        caseSql += `WHEN ${parts.join(' AND ')} THEN '${rule.label.replace(/'/g, "''")}' `;
      }
    }
  }

  return `${caseSql}ELSE CAST("${sourceCol}" AS VARCHAR) END`;
}
