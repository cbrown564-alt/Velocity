/**
 * useEngineProxy
 *
 * React hook that creates and manages the EngineProxy lifecycle.
 * Creates a Web Worker, wraps it in an EngineProxy, initializes the engine,
 * and provides the proxy to components via Zustand store injection.
 *
 * Returns `true` when the engine is ready for use.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { EngineProxy } from '../services/EngineProxy';
import type { EngineProxyOptions } from '../services/EngineProxy';
import type { EngineResponseByType } from '../types/engineWorker';

export interface UseEngineProxyResult {
  engineProxy: EngineProxy | null;
  isReady: boolean;
  error: string | null;
  opfsAvailable: boolean;
  persistenceMode: 'opfs' | 'memory' | 'disabled';
  persistenceError: string | null;
  activeDbPath: string | null;
  corruptionDetected: boolean;
}

export function useEngineProxy(datasetId?: string): UseEngineProxyResult {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opfsAvailable, setOpfsAvailable] = useState(false);
  const [persistenceMode, setPersistenceMode] = useState<'opfs' | 'memory' | 'disabled'>('memory');
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [activeDbPath, setActiveDbPath] = useState<string | null>(null);
  const [corruptionDetected, setCorruptionDetected] = useState(false);
  const proxyRef = useRef<EngineProxy | null>(null);

  const onPersistenceStatus = useCallback((msg: EngineResponseByType<'engine.persistenceStatus'>) => {
    setOpfsAvailable(msg.opfsAvailable);
    setPersistenceMode(msg.mode);
    setPersistenceError(msg.lastError ?? null);
    setActiveDbPath(msg.dbPath);
  }, []);

  const onCorruption = useCallback((msg: EngineResponseByType<'engine.corruptionDetected'>) => {
    setCorruptionDetected(true);
    setPersistenceError(msg.message);
  }, []);

  useEffect(() => {
    let disposed = false;

    async function initEngine() {
      try {
        const worker = new Worker(
          new URL('../services/analysisWorker.ts', import.meta.url),
          { type: 'module' },
        );

        const options: EngineProxyOptions = {
          onPersistenceStatus,
          onCorruption,
        };

        const proxy = new EngineProxy(worker, options);
        proxyRef.current = proxy;

        const result = await proxy.init({
          datasetId,
          schemaVersion: 1,
        });

        if (disposed) {
          proxy.terminate();
          return;
        }

        setOpfsAvailable(result.opfsAvailable);
        setIsReady(true);
      } catch (err: any) {
        if (!disposed) {
          setError(err.message ?? 'Failed to initialize engine');
        }
      }
    }

    initEngine();

    return () => {
      disposed = true;
      if (proxyRef.current) {
        proxyRef.current.terminate();
        proxyRef.current = null;
      }
      setIsReady(false);
    };
  }, [datasetId, onPersistenceStatus, onCorruption]);

  return {
    engineProxy: proxyRef.current,
    isReady,
    error,
    opfsAvailable,
    persistenceMode,
    persistenceError,
    activeDbPath,
    corruptionDetected,
  };
}
