import initSqlJs, { Database as SqlDatabase, SqlJsStatic } from 'sql.js';
import type {
  FuseRecommendation,
  InmetroTransformerModel,
  InmetroValidationStatus,
  PhaseType,
  TransformerSpec,
  TransformerType
} from '../types';

export const OFFLINE_DATABASE_FILE = 'database/ferracine-trafo.sqlite?schema=3';
export const OFFLINE_WASM_FILE = 'vendor/sql-wasm.wasm';

type OilType = 'MINERAL' | 'VEGETAL';

export interface ProdistVoltageRange {
  system: string;
  connection: 'FF' | 'FN';
  nominalV: number;
  adequateMinV: number;
  adequateMaxV: number;
  precariousLowMinV: number;
  precariousHighMaxV: number;
  criticalLowBelowV: number;
  criticalHighAboveV: number;
  sourcePage: number;
}

export interface OfflineDatabaseStatus {
  loaded: boolean;
  schemaVersion: number;
  transformerCount: number;
  inmetroModelCount: number;
  fuseCount: number;
  voltageRangeCount: number;
  generatedAt: string;
  source: 'BUNDLED' | 'REMOTE' | 'IMPORTED';
}

let sqlRuntimePromise: Promise<SqlJsStatic> | null = null;
let cachedFuses: FuseRecommendation[] = [];
let cachedInmetroModels: InmetroTransformerModel[] = [];
let cachedVoltageRanges: ProdistVoltageRange[] = [];
let cachedRules = new Map<string, number>();
let cachedStatus: OfflineDatabaseStatus = {
  loaded: false,
  schemaVersion: 0,
  transformerCount: 0,
  inmetroModelCount: 0,
  fuseCount: 0,
  voltageRangeCount: 0,
  generatedAt: '',
  source: 'BUNDLED'
};

const IDB_NAME = 'ferracine-diag-trafo';
const IDB_STORE = 'offline-database';
const IDB_KEY = 'active-sqlite';

function openOfflineStore(): Promise<IDBDatabase> {
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

async function readPersistedDatabase(): Promise<Uint8Array | null> {
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

async function persistDatabase(sqliteBuffer: Uint8Array): Promise<void> {
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

function localAssetUrl(file: string): string {
  const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}${file}`;
}

function getSqlRuntime(): Promise<SqlJsStatic> {
  if (!sqlRuntimePromise) {
    sqlRuntimePromise = typeof window === 'undefined'
      ? initSqlJs()
      : initSqlJs({ locateFile: () => localAssetUrl(OFFLINE_WASM_FILE) });
  }
  return sqlRuntimePromise;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asCategory(value: unknown): TransformerType {
  const normalized = String(value || '').toUpperCase();
  return normalized === 'RECONDICIONADO' || normalized === 'USADO' ? normalized : 'NOVO';
}

function asPhaseType(value: unknown): PhaseType {
  const normalized = String(value || '').toUpperCase();
  if (normalized.includes('MONO')) return 'MONOFASICO';
  if (normalized.includes('BI')) return 'BIFASICO';
  return 'TRIFASICO';
}

function parseTapVoltages(value: unknown): Record<number, number> | undefined {
  if (!value) return undefined;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object') return undefined;
    const taps: Record<number, number> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([key, tapVoltage]) => {
      const index = Number(key);
      const voltage = Number(tapVoltage);
      if (Number.isInteger(index) && Number.isFinite(voltage)) taps[index] = voltage;
    });
    return Object.keys(taps).length > 0 ? taps : undefined;
  } catch {
    return undefined;
  }
}

function rowsAsObjects(db: SqlDatabase, query: string): Record<string, unknown>[] {
  const result = db.exec(query);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
}

function mapTransformer(row: Record<string, unknown>): TransformerSpec {
  return {
    id: String(row.id || ''),
    category: asCategory(row.category),
    state: row.state ? String(row.state) : undefined,
    phaseType: asPhaseType(row.phaseType),
    powerKva: asNumber(row.powerKva),
    primaryVoltageV: asNumber(row.primaryVoltageV),
    secondaryVoltageV: asNumber(row.secondaryVoltageV),
    secondaryNeutralV: asNumber(row.secondaryNeutralV),
    impedancePercent: asNumber(row.impedancePercent),
    windingMaterial: String(row.windingMaterial || 'ALUMINIO').toUpperCase().includes('COBRE') ? 'COBRE' : 'ALUMINIO',
    oilType: String(row.oilType || 'MINERAL').toUpperCase().includes('VEGETAL') ? 'VEGETAL' : 'MINERAL',
    efficiencyLevel: row.efficiencyLevel ? String(row.efficiencyLevel) : undefined,
    noLoadLossW: asNumber(row.noLoadLossW),
    loadLoss75cW: asNumber(row.loadLoss75cW),
    totalLossW: asNumber(row.totalLossW),
    efficiencyPercent: asNumber(row.efficiencyPercent),
    noLoadCurrentPercent: row.noLoadCurrentPercent == null ? undefined : asNumber(row.noLoadCurrentPercent),
    standardReference: String(row.standardReference || ''),
    dateAdded: String(row.dateAdded || ''),
    tapCount: row.tapCount == null ? undefined : asNumber(row.tapCount),
    activeTapIndex: row.activeTapIndex == null ? undefined : asNumber(row.activeTapIndex),
    tapVoltages: parseTapVoltages(row.tapVoltages),
    dataOrigin: 'NORMATIVE'
  };
}

function mapInmetroModel(row: Record<string, unknown>): InmetroTransformerModel {
  return {
    id: String(row.id || ''),
    category: String(row.category) === 'RECONDICIONADO' ? 'RECONDICIONADO' : 'NOVO',
    manufacturer: String(row.manufacturer || 'FABRICANTE NÃO IDENTIFICADO'),
    phaseType: asPhaseType(row.phaseType) === 'MONOFASICO' ? 'MONOFASICO' : 'TRIFASICO',
    model: row.model ? String(row.model) : undefined,
    powerKva: asNumber(row.powerKva),
    voltageClassKv: asNumber(row.voltageClassKv),
    pedestal: row.pedestal == null ? undefined : Boolean(asNumber(row.pedestal)),
    nominalConventionalNoLoadW: asOptionalNumber(row.nominalConventionalNoLoadW),
    nominalConventionalTotalW: asOptionalNumber(row.nominalConventionalTotalW),
    nominalReliableNoLoadW: asOptionalNumber(row.nominalReliableNoLoadW),
    nominalReliableTotalW: asOptionalNumber(row.nominalReliableTotalW),
    criticalConventionalNoLoadW: asOptionalNumber(row.criticalConventionalNoLoadW),
    criticalConventionalTotalW: asOptionalNumber(row.criticalConventionalTotalW),
    criticalReliableNoLoadW: asOptionalNumber(row.criticalReliableNoLoadW),
    criticalReliableTotalW: asOptionalNumber(row.criticalReliableTotalW),
    temperatureRise55C: Boolean(asNumber(row.temperatureRise55C)),
    temperatureRise65C: Boolean(asNumber(row.temperatureRise65C)),
    temperatureRise75C: Boolean(asNumber(row.temperatureRise75C)),
    windingCopper: Boolean(asNumber(row.windingCopper)),
    windingAluminum: Boolean(asNumber(row.windingAluminum)),
    nbiKv: row.nbiKv ? String(row.nbiKv) : undefined,
    derivedLoadLossW: asOptionalNumber(row.derivedLoadLossW),
    efficiencyPercent: asOptionalNumber(row.efficiencyPercent),
    validationStatus: String(row.validationStatus) as InmetroValidationStatus,
    validationNote: String(row.validationNote || ''),
    diagnosticReady: Boolean(asNumber(row.diagnosticReady)),
    sourceDocument: String(row.sourceDocument || ''),
    sourcePage: asNumber(row.sourcePage)
  };
}

function hydrateAuxiliaryData(db: SqlDatabase): void {
  cachedFuses = rowsAsObjects(
    db,
    'SELECT oilType, phaseType, powerKva, primaryVoltageV, fuseRatingA, fuseType, fuseCode, sourceDocument, sourcePage, sourceTable FROM fuse_recommendations'
  ).map((row) => ({
    oilType: String(row.oilType) as OilType,
    phaseType: asPhaseType(row.phaseType),
    powerKva: asNumber(row.powerKva),
    primaryVoltageV: asNumber(row.primaryVoltageV),
    fuseRatingA: asNumber(row.fuseRatingA),
    fuseType: String(row.fuseType) as 'H' | 'K',
    fuseCode: String(row.fuseCode),
    sourceDocument: String(row.sourceDocument),
    sourcePage: asNumber(row.sourcePage),
    sourceTable: String(row.sourceTable),
    notes: `${String(row.sourceDocument)}, ${String(row.sourceTable)}, página ${asNumber(row.sourcePage)}`
  }));

  cachedVoltageRanges = rowsAsObjects(
    db,
    'SELECT system, connection, nominalV, adequateMinV, adequateMaxV, precariousLowMinV, precariousHighMaxV, criticalLowBelowV, criticalHighAboveV, sourcePage FROM prodist_voltage_ranges'
  ).map((row) => ({
    system: String(row.system),
    connection: String(row.connection) as 'FF' | 'FN',
    nominalV: asNumber(row.nominalV),
    adequateMinV: asNumber(row.adequateMinV),
    adequateMaxV: asNumber(row.adequateMaxV),
    precariousLowMinV: asNumber(row.precariousLowMinV),
    precariousHighMaxV: asNumber(row.precariousHighMaxV),
    criticalLowBelowV: asNumber(row.criticalLowBelowV),
    criticalHighAboveV: asNumber(row.criticalHighAboveV),
    sourcePage: asNumber(row.sourcePage)
  }));

  cachedRules = new Map(
    rowsAsObjects(db, 'SELECT key, value FROM diagnostic_rules').map((row) => [String(row.key), asNumber(row.value)])
  );
}

export async function parseSqliteData(
  sqliteBuffer: Uint8Array,
  source: OfflineDatabaseStatus['source'] = 'IMPORTED'
): Promise<TransformerSpec[]> {
  const SQL = await getSqlRuntime();
  const db = new SQL.Database(sqliteBuffer);
  try {
    const tables = new Set(
      rowsAsObjects(db, "SELECT name FROM sqlite_master WHERE type='table'").map((row) => String(row.name))
    );
    for (const required of ['database_metadata', 'transformers', 'inmetro_models', 'fuse_recommendations', 'prodist_voltage_ranges', 'diagnostic_rules']) {
      if (!tables.has(required)) throw new Error(`Banco SQLite incompatível: tabela ${required} ausente.`);
    }

    const metadata = new Map(
      rowsAsObjects(db, 'SELECT key, value FROM database_metadata').map((row) => [String(row.key), String(row.value)])
    );
    const schemaVersion = asNumber(metadata.get('schema_version'));
    if (schemaVersion < 3) throw new Error(`Versão de banco não suportada: ${schemaVersion}.`);

    const transformers = rowsAsObjects(db, 'SELECT * FROM transformers ORDER BY oilType, phaseType, voltageClassKv, powerKva').map(mapTransformer);
    cachedInmetroModels = rowsAsObjects(
      db,
      'SELECT * FROM inmetro_models ORDER BY category, manufacturer, phaseType, voltageClassKv, powerKva, model'
    ).map(mapInmetroModel);
    hydrateAuxiliaryData(db);
    cachedStatus = {
      loaded: true,
      schemaVersion,
      transformerCount: transformers.length,
      inmetroModelCount: cachedInmetroModels.length,
      fuseCount: cachedFuses.length,
      voltageRangeCount: cachedVoltageRanges.length,
      generatedAt: metadata.get('generated_at') || '',
      source
    };
    return transformers;
  } finally {
    db.close();
  }
}

export async function loadBundledOfflineDatabase(): Promise<TransformerSpec[]> {
  const persisted = await readPersistedDatabase();
  if (persisted) {
    try {
      return await parseSqliteData(persisted, 'REMOTE');
    } catch (error) {
      console.warn('Banco remoto persistido invalido; usando a copia empacotada.', error);
    }
  }
  const response = await fetch(localAssetUrl(OFFLINE_DATABASE_FILE));
  if (!response.ok) throw new Error(`Banco offline indisponível (HTTP ${response.status}).`);
  return parseSqliteData(new Uint8Array(await response.arrayBuffer()), 'BUNDLED');
}

async function restoreInstalledDatabaseState(): Promise<void> {
  const persisted = await readPersistedDatabase();
  if (persisted) {
    await parseSqliteData(persisted, 'REMOTE');
    return;
  }
  const response = await fetch(localAssetUrl(OFFLINE_DATABASE_FILE));
  if (!response.ok) throw new Error('Nao foi possivel restaurar o banco offline instalado.');
  await parseSqliteData(new Uint8Array(await response.arrayBuffer()), 'BUNDLED');
}

/** Valida e instala uma atualizacao oficial. A gravacao ocorre somente apos a validacao completa. */
export async function installRemoteOfflineDatabase(sqliteBuffer: Uint8Array): Promise<TransformerSpec[]> {
  const previousStatus = { ...cachedStatus };
  const transformers = await parseSqliteData(sqliteBuffer, 'REMOTE');
  const candidateStatus = { ...cachedStatus };

  if (previousStatus.loaded && candidateStatus.schemaVersion < previousStatus.schemaVersion) {
    await restoreInstalledDatabaseState();
    throw new Error(
      `Atualizacao recusada: esquema remoto ${candidateStatus.schemaVersion} e inferior ao local ${previousStatus.schemaVersion}.`
    );
  }

  const candidateDate = Date.parse(candidateStatus.generatedAt);
  const currentDate = Date.parse(previousStatus.generatedAt);
  if (
    previousStatus.loaded &&
    candidateStatus.schemaVersion === previousStatus.schemaVersion &&
    Number.isFinite(candidateDate) &&
    Number.isFinite(currentDate) &&
    candidateDate < currentDate
  ) {
    await restoreInstalledDatabaseState();
    throw new Error('Atualizacao recusada: o banco remoto e mais antigo que o banco instalado.');
  }

  try {
    await persistDatabase(sqliteBuffer);
  } catch (error) {
    await restoreInstalledDatabaseState();
    throw error;
  }
  return transformers;
}

export async function processDatabaseFile(file: File): Promise<TransformerSpec[]> {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.sqlite') && !lowerName.endsWith('.db')) {
    throw new Error('Selecione um único arquivo SQLite (.sqlite ou .db).');
  }
  return parseSqliteData(new Uint8Array(await file.arrayBuffer()), 'IMPORTED');
}

export function getOfflineDatabaseStatus(): OfflineDatabaseStatus {
  return { ...cachedStatus };
}

/** Modelos PBE/INMETRO sem o número de etiqueta, que não é necessário ao diagnóstico. */
export function getOfflineInmetroModels(): InmetroTransformerModel[] {
  return cachedInmetroModels.map((item) => ({ ...item }));
}

/** Cópia somente-leitura da Tabela 16 carregada do SQLite ativo. */
export function getOfflineFuseRecommendations(): FuseRecommendation[] {
  return cachedFuses.map((item) => ({ ...item }));
}

/** Faixas nominais exatas do PRODIST carregadas do SQLite ativo. */
export function getOfflineProdistVoltageRanges(): ProdistVoltageRange[] {
  return cachedVoltageRanges.map((item) => ({ ...item }));
}

export function getDiagnosticRuleValue(key: string, fallback: number): number {
  return cachedRules.get(key) ?? fallback;
}

export function classifyProdistVoltage(
  measuredVoltageV: number,
  nominalVoltageV: number,
  connection: 'FF' | 'FN' = 'FF'
): { status: 'ADEQUADA' | 'PRECARIA' | 'CRITICA'; range: ProdistVoltageRange } | null {
  const range = cachedVoltageRanges.find(
    (candidate) => candidate.connection === connection && Math.abs(candidate.nominalV - nominalVoltageV) < 0.01
  );
  if (!range || measuredVoltageV <= 0) return null;
  if (measuredVoltageV >= range.adequateMinV && measuredVoltageV <= range.adequateMaxV) {
    return { status: 'ADEQUADA', range };
  }
  if (measuredVoltageV >= range.precariousLowMinV && measuredVoltageV <= range.precariousHighMaxV) {
    return { status: 'PRECARIA', range };
  }
  return { status: 'CRITICA', range };
}

export function findFuseInOfflineDatabase(
  primaryVoltageV: number,
  powerKva: number,
  phaseType: PhaseType,
  oilType: OilType
): FuseRecommendation | null {
  const candidates = cachedFuses
    .filter((item) => item.phaseType === phaseType && item.oilType === oilType && Math.abs(item.powerKva - powerKva) < 0.001)
    .sort((a, b) => Math.abs(a.primaryVoltageV - primaryVoltageV) - Math.abs(b.primaryVoltageV - primaryVoltageV));
  const selected = candidates[0];
  if (!selected) return null;
  const relativeDistance = Math.abs(selected.primaryVoltageV - primaryVoltageV) / selected.primaryVoltageV;
  if (relativeDistance > 0.25) return null;
  return { ...selected };
}
