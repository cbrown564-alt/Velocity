import type { StateStorage } from 'zustand/middleware';

const memoryStore = new Map<string, string>();

const memoryStorage: StateStorage = {
  getItem: (name) => memoryStore.get(name) ?? null,
  setItem: (name, value) => {
    memoryStore.set(name, value);
  },
  removeItem: (name) => {
    memoryStore.delete(name);
  },
};

function isStorageLike(value: unknown): value is Storage {
  if (!value || typeof value !== 'object') return false;
  const storage = value as Partial<Storage>;
  return (
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function' &&
    typeof storage.removeItem === 'function'
  );
}

export function getSafeLocalStorage(): StateStorage {
  try {
    if (typeof window !== 'undefined' && isStorageLike(window.localStorage)) {
      return window.localStorage;
    }
  } catch {
    // Fall through to other candidates.
  }

  try {
    const candidate = (globalThis as { localStorage?: unknown }).localStorage;
    if (isStorageLike(candidate)) {
      return candidate;
    }
  } catch {
    // Fall through to in-memory storage.
  }

  return memoryStorage;
}
