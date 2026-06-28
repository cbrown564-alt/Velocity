/**
 * WebR Slice
 *
 * Manages WebR runtime state including loading status, progress, and loaded packages.
 * WebR is loaded lazily only when advanced analysis features are requested.
 */

import type { StateCreator } from 'zustand';
import { getWebREngine, resetWebREngine, WebREngine } from '../../engine/webr/WebREngine';
import type {
  WebRWorkerResponse,
  SurveyDesignConfig,
  SurveyResult,
  MixedModelConfig,
  MixedModelResult,
  RResult,
} from '../../types/webr';

// ============================================================================
// Types
// ============================================================================

export type WebRStatus = 'idle' | 'initializing' | 'ready' | 'busy' | 'error';

export interface WebRSlice {
  // State
  webrStatus: WebRStatus;
  webrInitProgress: number;
  webrInitMessage: string;
  webrLoadedPackages: string[];
  webrLastError: string | null;

  // Actions
  initWebR: () => Promise<void>;
  loadWebRPackage: (packageName: string) => Promise<void>;
  executeR: (code: string, data?: Uint8Array) => Promise<RResult>;
  runSurveyAnalysis: (config: SurveyDesignConfig, data: Uint8Array) => Promise<SurveyResult>;
  runMixedModel: (config: MixedModelConfig, data: Uint8Array) => Promise<MixedModelResult>;
  terminateWebR: () => void;
  resetWebRState: () => void;
}

// ============================================================================
// Slice Creator
// ============================================================================

export const createWebRSlice: StateCreator<WebRSlice, [], [], WebRSlice> = (set, get) => {
  // Engine instance (managed outside React state for better memory management)
  let engine: WebREngine | null = null;

  const getOrCreateEngine = (): WebREngine => {
    if (!engine) {
      engine = getWebREngine({
        onStatusChange: (status) => {
          set({ webrStatus: status as WebRStatus });
        },
        onInitProgress: (progress, message) => {
          set({ webrInitProgress: progress, webrInitMessage: message });
        },
        onPackageProgress: (packageName, progress) => {
          // Could add per-package progress tracking if needed
          console.log(`📦 Loading ${packageName}: ${progress}%`);
        },
        onError: (error) => {
          set({ webrLastError: error, webrStatus: 'error' });
        },
      });
    }
    return engine;
  };

  return {
    // Initial state
    webrStatus: 'idle',
    webrInitProgress: 0,
    webrInitMessage: '',
    webrLoadedPackages: [],
    webrLastError: null,

    // Actions
    initWebR: async () => {
      const { webrStatus } = get();

      if (webrStatus === 'ready' || webrStatus === 'initializing') {
        return;
      }

      set({
        webrStatus: 'initializing',
        webrInitProgress: 0,
        webrInitMessage: 'Loading WebR runtime...',
        webrLastError: null,
      });

      try {
        const eng = getOrCreateEngine();
        await eng.init();

        set({
          webrStatus: 'ready',
          webrInitProgress: 100,
          webrInitMessage: 'WebR ready',
          webrLoadedPackages: eng.getLoadedPackages(),
        });
      } catch (error: any) {
        set({
          webrStatus: 'error',
          webrLastError: error.message || 'Failed to initialize WebR',
        });
        throw error;
      }
    },

    loadWebRPackage: async (packageName: string) => {
      const { webrStatus, webrLoadedPackages } = get();

      if (webrStatus !== 'ready') {
        throw new Error('WebR not ready');
      }

      if (webrLoadedPackages.includes(packageName)) {
        return;
      }

      const eng = getOrCreateEngine();
      await eng.loadPackage(packageName);

      set({
        webrLoadedPackages: [...get().webrLoadedPackages, packageName],
      });
    },

    executeR: async (code: string, data?: Uint8Array) => {
      const { webrStatus } = get();

      if (webrStatus !== 'ready') {
        // Auto-initialize if not ready
        await get().initWebR();
      }

      set({ webrStatus: 'busy' });

      try {
        const eng = getOrCreateEngine();
        const result = await eng.executeR(code, data);
        set({ webrStatus: 'ready' });
        return result;
      } catch (error: any) {
        set({ webrStatus: 'ready', webrLastError: error.message });
        throw error;
      }
    },

    runSurveyAnalysis: async (config: SurveyDesignConfig, data: Uint8Array) => {
      const { webrStatus } = get();

      if (webrStatus !== 'ready') {
        await get().initWebR();
      }

      set({ webrStatus: 'busy' });

      try {
        const eng = getOrCreateEngine();
        const result = await eng.runSurveyAnalysis(config, data);
        set({ webrStatus: 'ready' });
        return result;
      } catch (error: any) {
        set({ webrStatus: 'ready', webrLastError: error.message });
        throw error;
      }
    },

    runMixedModel: async (config: MixedModelConfig, data: Uint8Array) => {
      const { webrStatus } = get();

      if (webrStatus !== 'ready') {
        await get().initWebR();
      }

      set({ webrStatus: 'busy' });

      try {
        const eng = getOrCreateEngine();
        const result = await eng.runMixedModel(config, data);
        set({ webrStatus: 'ready' });
        return result;
      } catch (error: any) {
        set({ webrStatus: 'ready', webrLastError: error.message });
        throw error;
      }
    },

    terminateWebR: () => {
      if (engine) {
        engine.terminate();
        engine = null;
      }
      resetWebREngine();

      set({
        webrStatus: 'idle',
        webrInitProgress: 0,
        webrInitMessage: '',
        webrLoadedPackages: [],
        webrLastError: null,
      });
    },

    resetWebRState: () => {
      set({
        webrStatus: 'idle',
        webrInitProgress: 0,
        webrInitMessage: '',
        webrLoadedPackages: [],
        webrLastError: null,
      });
    },
  };
};
