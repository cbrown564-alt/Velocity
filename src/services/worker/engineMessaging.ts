import type { EngineWorkerResponse } from '../../types/engineWorker';

/** Strip non-cloneable values before postMessage (BigInt, functions, etc.). */
export function toCloneSafePayload<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, nested) => {
      if (typeof nested === 'bigint') return nested.toString();
      return nested;
    }),
  );
}

export function postEngineResponse(response: EngineWorkerResponse): void {
  self.postMessage(toCloneSafePayload(response));
}

export function postEngineTransfer(response: EngineWorkerResponse, transfer: Transferable[]): void {
  (self as unknown as Worker).postMessage(toCloneSafePayload(response), transfer);
}
