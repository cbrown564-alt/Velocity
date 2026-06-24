import type { RecodeConfig } from '../../types';
import { buildCaseSql } from '../../core/transforms/recodeSql';
import { workerDbState } from './workerDbState';

export async function getSchema(): Promise<{ name: string; type: string }[]> {
  const { conn } = workerDbState;
  if (!conn) throw new Error('DB not initialized');

  const result = await conn.query(`PRAGMA table_info('main')`);
  return result.toArray().map((row: any) => ({
    name: row.name,
    type: row.type,
  }));
}

export async function runQuery(sql: string): Promise<{ data: any[]; durationMs: number }> {
  const { conn } = workerDbState;
  if (!conn) throw new Error('DB not initialized');

  const start = performance.now();
  const result = await conn.query(sql);
  const durationMs = performance.now() - start;

  return {
    data: result.toArray().map((row) => row.toJSON()),
    durationMs,
  };
}

export async function getUniqueValues(column: string): Promise<string[]> {
  const { conn } = workerDbState;
  if (!conn) throw new Error('DB not initialized');

  const result = await conn.query(`SELECT DISTINCT "${column}" as val FROM main ORDER BY val LIMIT 50`);
  return result.toArray().map((row) => String(row.val));
}

export async function recodeVariable(
  sourceCol: string,
  newColName: string,
  config: RecodeConfig,
): Promise<string> {
  const { conn } = workerDbState;
  if (!conn) throw new Error('DB not initialized');

  const safeNewCol = newColName.replace(/[^a-zA-Z0-9_]/g, '_');

  await conn.query(`ALTER TABLE main ADD COLUMN "${safeNewCol}" VARCHAR`);
  await conn.query(`UPDATE main SET "${safeNewCol}" = ${buildCaseSql(sourceCol, config)}`);

  return safeNewCol;
}

export async function fillSystemMissing(column: string, value: number | string): Promise<void> {
  const { conn } = workerDbState;
  if (!conn) throw new Error('DB not initialized');
  const escapedCol = column.replace(/"/g, '""');
  const valueSql = typeof value === 'number'
    ? `${value}`
    : `'${String(value).replace(/'/g, "''")}'`;
  await conn.query(`UPDATE main SET "${escapedCol}" = ${valueSql} WHERE "${escapedCol}" IS NULL`);
}
