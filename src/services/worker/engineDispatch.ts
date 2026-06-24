import type { EngineWorkerRequest } from '../../types/engineWorker';
import { isEngineMessage } from '../../types/engineWorker';
import {
  isFatalDatabaseRuntimeError,
  recoverFromFatalDatabaseError,
} from './duckdbPersistence';
import { engineHandlers } from './engineHandlers';
import { postEngineResponse } from './engineMessaging';

export async function handleEngineMessage(request: EngineWorkerRequest): Promise<void> {
  const { requestId } = request;

  try {
    const handler = engineHandlers[request.type];
    if (handler) {
      await handler(request);
      return;
    }

    postEngineResponse({
      type: 'engine.error',
      requestId,
      message: `Unknown engine message type: ${(request as { type: string }).type}`,
    });
  } catch (error: any) {
    console.error('[Worker/Engine] Error:', error);
    if (isFatalDatabaseRuntimeError(error)) {
      try {
        await recoverFromFatalDatabaseError(error, requestId);
      } catch (recoveryError: any) {
        console.error('[Worker/Engine] Fatal recovery failed:', recoveryError);
      }
    }
    postEngineResponse({
      type: 'engine.error',
      requestId,
      message: error.message || 'Unknown error',
      code: error.code,
    });
  }
}

let engineRequestQueue: Promise<void> = Promise.resolve();

async function runQueuedEngineMessage(request: EngineWorkerRequest): Promise<void> {
  try {
    await handleEngineMessage(request);
  } catch (error: any) {
    console.error('[Worker/Engine] Unhandled queued request failure:', error);
    postEngineResponse({
      type: 'engine.error',
      requestId: request.requestId,
      message: error?.message || 'Unhandled worker request failure',
      code: error?.code,
    });
  }
}

self.onmessage = (event: MessageEvent<EngineWorkerRequest>) => {
  const request = event.data;

  if (!isEngineMessage(request as { type: string })) {
    console.warn(`🦆 [Worker] Ignoring unrecognized message type: ${(request as { type: string }).type}`);
    return;
  }

  engineRequestQueue = engineRequestQueue.then(() => runQueuedEngineMessage(request));
};
