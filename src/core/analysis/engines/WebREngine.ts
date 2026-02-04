/**
 * WebREngine
 *
 * High-level abstraction for executing R code via the WebR worker.
 * Manages worker lifecycle, data transfer, and result extraction.
 *
 * Usage:
 *   const engine = new WebREngine();
 *   await engine.init();
 *   const result = await engine.executeR('mean(c(1,2,3))');
 */

import type {
  WebRWorkerRequest,
  WebRWorkerResponse,
  WebRStatus,
  RResult,
  SurveyDesignConfig,
  SurveyResult,
  MixedModelConfig,
  MixedModelResult,
} from '../../../types/webr';

export type WebREngineStatus = 'idle' | 'initializing' | 'ready' | 'busy' | 'error';

export interface WebREngineCallbacks {
  onStatusChange?: (status: WebREngineStatus) => void;
  onInitProgress?: (progress: number, message: string) => void;
  onPackageProgress?: (packageName: string, progress: number) => void;
  onError?: (error: string) => void;
}

export class WebREngine {
  private worker: Worker | null = null;
  private status: WebREngineStatus = 'idle';
  private loadedPackages: string[] = [];
  private initProgress: number = 0;
  private callbacks: WebREngineCallbacks = {};
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();
  private requestId: number = 0;

  constructor(callbacks?: WebREngineCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  /**
   * Initialize the WebR runtime
   */
  async init(): Promise<void> {
    if (this.status === 'ready' || this.status === 'initializing') {
      return;
    }

    this.setStatus('initializing');

    return new Promise((resolve, reject) => {
      try {
        // Create worker from the webRWorker module
        this.worker = new Worker(
          new URL('../../../services/webRWorker.ts', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (event: MessageEvent<WebRWorkerResponse>) => {
          this.handleWorkerMessage(event.data);
        };

        this.worker.onerror = (error) => {
          console.error('🔬 [WebREngine] Worker error:', error);
          this.setStatus('error');
          reject(new Error('WebR worker failed to start'));
        };

        // Set up init completion handler
        const initHandler = (response: WebRWorkerResponse) => {
          if (response.type === 'ready') {
            this.setStatus('ready');
            resolve();
          } else if (response.type === 'error') {
            this.setStatus('error');
            reject(new Error(response.message));
          }
        };

        const originalHandler = this.worker.onmessage;
        this.worker.onmessage = (event: MessageEvent<WebRWorkerResponse>) => {
          if (originalHandler) {
            originalHandler.call(this.worker, event);
          }
          initHandler(event.data);
          if (event.data.type === 'ready' || event.data.type === 'error') {
            this.worker!.onmessage = originalHandler;
          }
        };

        // Send init message
        this.postMessage({ type: 'init' });
      } catch (error: any) {
        this.setStatus('error');
        reject(error);
      }
    });
  }

  /**
   * Execute arbitrary R code
   */
  async executeR(code: string, data?: Uint8Array): Promise<RResult> {
    this.ensureReady();

    return this.sendRequest<RResult>('rResult', {
      type: 'executeR',
      code,
      data,
    });
  }

  /**
   * Run survey analysis with design effects
   */
  async runSurveyAnalysis(
    config: SurveyDesignConfig,
    data: Uint8Array
  ): Promise<SurveyResult> {
    this.ensureReady();

    // Ensure survey package is loaded
    if (!this.loadedPackages.includes('survey')) {
      await this.loadPackage('survey');
    }

    return this.sendRequest<SurveyResult>('surveyResult', {
      type: 'runSurveyAnalysis',
      config,
      data,
    });
  }

  /**
   * Run mixed effects model
   */
  async runMixedModel(
    config: MixedModelConfig,
    data: Uint8Array
  ): Promise<MixedModelResult> {
    this.ensureReady();

    // Ensure lme4 package is loaded
    if (!this.loadedPackages.includes('lme4')) {
      await this.loadPackage('lme4');
    }

    return this.sendRequest<MixedModelResult>('mixedModelResult', {
      type: 'runMixedModel',
      config,
      data,
    });
  }

  /**
   * Load an R package
   */
  async loadPackage(packageName: string): Promise<void> {
    this.ensureReady();

    if (this.loadedPackages.includes(packageName)) {
      return;
    }

    return new Promise((resolve, reject) => {
      const handler = (response: WebRWorkerResponse) => {
        if (response.type === 'packageLoaded' && response.packageName === packageName) {
          this.loadedPackages.push(packageName);
          resolve();
        } else if (response.type === 'error') {
          reject(new Error(response.message));
        }
      };

      // Temporarily add handler
      const originalHandler = this.worker!.onmessage;
      this.worker!.onmessage = (event: MessageEvent<WebRWorkerResponse>) => {
        if (originalHandler) {
          originalHandler.call(this.worker, event);
        }
        handler(event.data);
        if (
          (event.data.type === 'packageLoaded' && event.data.packageName === packageName) ||
          event.data.type === 'error'
        ) {
          this.worker!.onmessage = originalHandler;
        }
      };

      this.postMessage({ type: 'loadPackage', packageName });
    });
  }

  /**
   * Get current status
   */
  getStatus(): WebREngineStatus {
    return this.status;
  }

  /**
   * Get list of loaded packages
   */
  getLoadedPackages(): string[] {
    return [...this.loadedPackages];
  }

  /**
   * Get initialization progress (0-100)
   */
  getInitProgress(): number {
    return this.initProgress;
  }

  /**
   * Check if engine is ready for use
   */
  isReady(): boolean {
    return this.status === 'ready';
  }

  /**
   * Terminate the WebR worker
   */
  terminate(): void {
    if (this.worker) {
      this.postMessage({ type: 'terminate' });
      this.worker.terminate();
      this.worker = null;
    }
    this.setStatus('idle');
    this.loadedPackages = [];
    this.initProgress = 0;
    this.pendingRequests.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private ensureReady(): void {
    if (this.status !== 'ready' && this.status !== 'busy') {
      throw new Error(`WebR engine not ready (status: ${this.status})`);
    }
    if (!this.worker) {
      throw new Error('WebR worker not initialized');
    }
  }

  private setStatus(newStatus: WebREngineStatus): void {
    this.status = newStatus;
    this.callbacks.onStatusChange?.(newStatus);
  }

  private postMessage(request: WebRWorkerRequest): void {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    // If request has data (Uint8Array), transfer it
    if ('data' in request && request.data) {
      this.worker.postMessage(request, [request.data.buffer]);
    } else {
      this.worker.postMessage(request);
    }
  }

  private handleWorkerMessage(response: WebRWorkerResponse): void {
    switch (response.type) {
      case 'initProgress':
        this.initProgress = response.progress;
        this.callbacks.onInitProgress?.(response.progress, response.message);
        break;

      case 'packageProgress':
        this.callbacks.onPackageProgress?.(response.packageName, response.progress);
        break;

      case 'packageLoaded':
        if (!this.loadedPackages.includes(response.packageName)) {
          this.loadedPackages.push(response.packageName);
        }
        break;

      case 'status':
        this.status = response.status.status as WebREngineStatus;
        this.loadedPackages = response.status.loadedPackages;
        this.initProgress = response.status.initProgress;
        break;

      case 'error':
        this.callbacks.onError?.(response.message);
        // Reject any pending requests
        this.pendingRequests.forEach(({ reject }) => {
          reject(new Error(response.message));
        });
        this.pendingRequests.clear();
        break;

      case 'rResult':
      case 'surveyResult':
      case 'mixedModelResult':
        // These are handled by sendRequest
        break;
    }
  }

  private async sendRequest<T>(
    expectedType: 'rResult' | 'surveyResult' | 'mixedModelResult',
    request: WebRWorkerRequest
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `${++this.requestId}`;

      const handler = (event: MessageEvent<WebRWorkerResponse>) => {
        const response = event.data;

        if (response.type === expectedType) {
          this.worker!.removeEventListener('message', handler);
          this.setStatus('ready');
          resolve((response as any).result as T);
        } else if (response.type === 'error') {
          this.worker!.removeEventListener('message', handler);
          this.setStatus('ready');
          reject(new Error(response.message));
        }
      };

      this.worker!.addEventListener('message', handler);
      this.setStatus('busy');
      this.postMessage(request);
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let sharedEngine: WebREngine | null = null;

/**
 * Get the shared WebREngine instance
 */
export function getWebREngine(callbacks?: WebREngineCallbacks): WebREngine {
  if (!sharedEngine) {
    sharedEngine = new WebREngine(callbacks);
  }
  return sharedEngine;
}

/**
 * Reset the shared WebREngine instance
 */
export function resetWebREngine(): void {
  if (sharedEngine) {
    sharedEngine.terminate();
    sharedEngine = null;
  }
}
