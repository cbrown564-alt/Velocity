import type { EngineWorkerRequest } from '../../types/engineWorker';

export type EngineMessageHandler = (request: EngineWorkerRequest) => Promise<void>;
