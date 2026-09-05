import type {
  InitialDiagnosticData,
  MeasurementCycleMode,
  SingleMeasurement,
  TransformerSpec
} from '../types';

export interface DiagnosticDraft {
  version: 1;
  savedAt: string;
  initialData: InitialDiagnosticData;
  transformer: TransformerSpec;
  measurements: SingleMeasurement[];
  cycleMode: MeasurementCycleMode;
  photos: string[];
}

const DB_NAME = 'ferracine-diag-trafo-drafts';
const STORE_NAME = 'drafts';
const DRAFT_KEY = 'active-diagnostic';

function openDraftStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponivel.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha ao abrir os rascunhos.'));
  });
}

export async function loadDiagnosticDraft(): Promise<DiagnosticDraft | null> {
  const db = await openDraftStore();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(DRAFT_KEY);
    request.onsuccess = () => {
      db.close();
      const value = request.result as DiagnosticDraft | undefined;
      if (
        !value ||
        value.version !== 1 ||
        !Array.isArray(value.measurements) ||
        value.measurements.length < 1 ||
        value.measurements.length > 3 ||
        !Array.isArray(value.photos)
      ) {
        resolve(null);
        return;
      }
      resolve(value);
    };
    request.onerror = () => {
      db.close();
      reject(request.error || new Error('Falha ao carregar o rascunho.'));
    };
  });
}

export async function saveDiagnosticDraft(draft: DiagnosticDraft): Promise<void> {
  const db = await openDraftStore();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(draft, DRAFT_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error('Falha ao salvar o rascunho.'));
    };
  });
}

export async function clearDiagnosticDraft(): Promise<void> {
  const db = await openDraftStore();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(DRAFT_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error('Falha ao remover o rascunho.'));
    };
  });
}
