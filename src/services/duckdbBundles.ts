import * as duckdb from '@duckdb/duckdb-wasm';
import duckdbWasmMvp from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import duckdbWasmEh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import duckdbWasmCoi from '@duckdb/duckdb-wasm/dist/duckdb-coi.wasm?url';
import duckdbWorkerMvp from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdbWorkerEh from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import duckdbWorkerCoi from '@duckdb/duckdb-wasm/dist/duckdb-browser-coi.worker.js?url';
import duckdbWorkerCoiPthread from '@duckdb/duckdb-wasm/dist/duckdb-browser-coi.pthread.worker.js?url';

export function getLocalDuckDbBundles(): duckdb.DuckDBBundles {
  return {
    mvp: {
      mainModule: duckdbWasmMvp,
      mainWorker: duckdbWorkerMvp,
    },
    eh: {
      mainModule: duckdbWasmEh,
      mainWorker: duckdbWorkerEh,
    },
    coi: {
      mainModule: duckdbWasmCoi,
      mainWorker: duckdbWorkerCoi,
      pthreadWorker: duckdbWorkerCoiPthread,
    },
  };
}

export function resolveDuckDbBundleUrls(bundle: duckdb.DuckDBBundle): duckdb.DuckDBBundle {
  const origin = (() => {
    if (typeof self !== 'undefined' && (self as any).location?.origin) {
      const value = (self as any).location.origin;
      return value && value !== 'null' ? value : null;
    }
    if (typeof location !== 'undefined' && location.origin) {
      return location.origin !== 'null' ? location.origin : null;
    }
    return null;
  })();

  const resolveUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    try {
      return new URL(url).toString();
    } catch {
      if (!origin) return url;
      return new URL(url, origin).toString();
    }
  };

  return {
    mainModule: resolveUrl(bundle.mainModule) || bundle.mainModule,
    mainWorker: resolveUrl(bundle.mainWorker) || bundle.mainWorker,
    pthreadWorker: resolveUrl(bundle.pthreadWorker) || bundle.pthreadWorker || null,
  };
}
