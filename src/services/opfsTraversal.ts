export type OpfsEntry = {
  path: string;
  name: string;
  handle: FileSystemHandle;
  parent: FileSystemDirectoryHandle;
};

export function normalizeOpfsPath(input: string): string {
  return input.replace(/^opfs:\/\//, '').replace(/^\/+/, '');
}

export async function* walkOpfs(dir: FileSystemDirectoryHandle, prefix: string = ''): AsyncIterable<OpfsEntry> {
  // @ts-expect-error - entries() returns an async iterator
  for await (const [name, handle] of dir.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    yield { path, name, handle, parent: dir };
    if (handle.kind === 'directory') {
      yield* walkOpfs(handle as FileSystemDirectoryHandle, path);
    }
  }
}

export async function resolveOpfsPath(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<{ parent: FileSystemDirectoryHandle; name: string } | null> {
  const normalized = normalizeOpfsPath(path);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const name = parts[parts.length - 1];
  const dirParts = parts.slice(0, -1);
  let current = root;
  for (const part of dirParts) {
    try {
      current = await current.getDirectoryHandle(part);
    } catch {
      return null;
    }
  }
  return { parent: current, name };
}

export async function findOpfsFile(
  root: FileSystemDirectoryHandle,
  targetPath: string,
): Promise<{ path: string; name: string; parent: FileSystemDirectoryHandle; handle: FileSystemFileHandle } | null> {
  const normalized = normalizeOpfsPath(targetPath);
  if (normalized.includes('/')) {
    const resolved = await resolveOpfsPath(root, normalized);
    if (!resolved) return null;
    try {
      const handle = await resolved.parent.getFileHandle(resolved.name);
      return { path: normalized, name: resolved.name, parent: resolved.parent, handle };
    } catch {
      return null;
    }
  }

  for await (const entry of walkOpfs(root)) {
    if (entry.handle.kind !== 'file') continue;
    if (entry.name !== normalized) continue;
    return {
      path: entry.path,
      name: entry.name,
      parent: entry.parent,
      handle: entry.handle as FileSystemFileHandle,
    };
  }

  return null;
}
