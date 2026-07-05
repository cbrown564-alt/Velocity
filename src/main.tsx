import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerDuckDbWasmCache } from './services/duckdbWasmCache';
import { exposeEngineWarmUpForTests } from './services/engineWarmUp';

void registerDuckDbWasmCache();
exposeEngineWarmUpForTests();

if (import.meta.env.DEV) {
  void import('./devHarness');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
