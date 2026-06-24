import type { EngineWorkerResponse } from '../../types/engineWorker';

export function postEngineResponse(response: EngineWorkerResponse): void {
  self.postMessage(response);
}

export function postEngineTransfer(response: EngineWorkerResponse, transfer: Transferable[]): void {
  (self as unknown as Worker).postMessage(response, transfer);
}
