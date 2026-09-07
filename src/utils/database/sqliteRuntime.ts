import initSqlJs, { SqlJsStatic } from 'sql.js';
import { OFFLINE_WASM_FILE } from './types';

let sqlRuntimePromise: Promise<SqlJsStatic> | null = null;

const IDB_NAME = 'ferracine-diag-trafo';
const IDB_STORE = 'offline-database';
const IDB_KEY = 'active-sqlite';

export function openOfflineStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponivel neste dispositivo.'));
      return;
    }
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha ao abrir o armazenamento offline.'));
  });
}

export async function readPersistedDatabase(): Promise<Uint8Array | null> {
  try {
    const db = await openOfflineStore();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE, 'readonly');
      const request = transaction.objectStore(IDB_STORE).get(IDB_KEY);
      request.onsuccess = () => {
        db.close();
        const value = request.result;
        if (value instanceof ArrayBuffer) resolve(new Uint8Array(value));
        else if (value instanceof Uint8Array) resolve(value);
        else resolve(null);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch {
    return null;
  }
}

export async function persistDatabase(sqliteBuffer: Uint8Array): Promise<void> {
  const db = await openOfflineStore();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IDB_STORE, 'readwrite');
    transaction.objectStore(IDB_STORE).put(sqliteBuffer.slice().buffer, IDB_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error('Falha ao persistir o banco offline.'));
    };
  });
}

export function localAssetUrl(file: string): string {
  let base = '/';
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.BASE_URL) {
      base = (import.meta as any).env.BASE_URL;
    }
  } catch {
    base = '/';
  }
  return `${base.endsWith('/') ? base : `${base}/`}${file}`;
}

export function getSqlRuntime(): Promise<SqlJsStatic> {
  if (!sqlRuntimePromise) {
    sqlRuntimePromise = typeof window === 'undefined'
      ? initSqlJs()
      : initSqlJs({ locateFile: () => localAssetUrl(OFFLINE_WASM_FILE) });
  }
  return sqlRuntimePromise;
}
