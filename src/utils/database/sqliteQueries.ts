import type {
  FuseRecommendation,
  InmetroTransformerModel,
  PhaseType,
  TransformerSpec
} from '../../types';
import {
  ENERGISA_DEFAULT_VOLTAGE_RANGES,
  ENERGISA_STANDARD_SYSTEMS,
  OFFLINE_DATABASE_FILE,
  OfflineDatabaseStatus,
  OilType,
  ProdistVoltageRange,
  SUPPORTED_SCHEMA_VERSION
} from './types';
import {
  getSqlRuntime,
  localAssetUrl,
  persistDatabase,
  readPersistedDatabase
} from './sqliteRuntime';
import {
  asNumber,
  mapInmetroModel,
  mapTransformer,
  readAuxiliaryData,
  rowsAsObjects,
  validateDatabaseContent
} from './sqliteMappers';

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
    if (schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
      throw new Error(`Versao de banco nao suportada: ${schemaVersion}. Esperada: ${SUPPORTED_SCHEMA_VERSION}.`);
    }

    const transformers = rowsAsObjects(db, 'SELECT * FROM transformers ORDER BY oilType, phaseType, voltageClassKv, powerKva').map(mapTransformer);
    const inmetroModels = rowsAsObjects(
      db,
      'SELECT * FROM inmetro_models ORDER BY category, manufacturer, phaseType, voltageClassKv, powerKva, model'
    ).map(mapInmetroModel);
    const { fuses, voltageRanges, rules } = readAuxiliaryData(db);
    validateDatabaseContent(metadata, transformers, inmetroModels, fuses, voltageRanges, rules);

    cachedInmetroModels = inmetroModels;
    cachedFuses = fuses;
    cachedVoltageRanges = voltageRanges;
    cachedRules = rules;
    cachedStatus = {
      loaded: true,
      schemaVersion,
      transformerCount: transformers.length,
      inmetroModelCount: inmetroModels.length,
      fuseCount: fuses.length,
      voltageRangeCount: voltageRanges.length,
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
  let persistedStatus: OfflineDatabaseStatus | null = null;
  if (persisted) {
    try {
      await parseSqliteData(persisted, 'REMOTE');
      persistedStatus = { ...cachedStatus };
    } catch (error) {
      console.warn('Banco remoto persistido invalido; ignorando a copia persistida.', error);
    }
  }

  let bundledBytes: Uint8Array | null = null;
  try {
    const response = await fetch(localAssetUrl(OFFLINE_DATABASE_FILE), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    bundledBytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (persisted && persistedStatus) return parseSqliteData(persisted, 'REMOTE');
    throw new Error(`Banco offline indisponivel: ${error instanceof Error ? error.message : 'falha de leitura'}.`);
  }

  const bundledTransformers = await parseSqliteData(bundledBytes, 'BUNDLED');
  const bundledStatus = { ...cachedStatus };
  if (persisted && persistedStatus) {
    const persistedDate = Date.parse(persistedStatus.generatedAt);
    const bundledDate = Date.parse(bundledStatus.generatedAt);
    const persistedIsCurrent =
      persistedStatus.schemaVersion === bundledStatus.schemaVersion &&
      Number.isFinite(persistedDate) &&
      Number.isFinite(bundledDate) &&
      persistedDate >= bundledDate;
    if (persistedIsCurrent) return parseSqliteData(persisted, 'REMOTE');
  }
  return bundledTransformers;
}

export async function restoreInstalledDatabaseState(): Promise<void> {
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

/** Faixas nominais exatas do PRODIST para os padrões operacionais do Grupo Energisa. */
export function getOfflineProdistVoltageRanges(): ProdistVoltageRange[] {
  const map = new Map<string, ProdistVoltageRange>();
  ENERGISA_DEFAULT_VOLTAGE_RANGES.forEach((item) => {
    map.set(`${item.system}_${item.connection}`, { ...item });
  });
  cachedVoltageRanges.forEach((item) => {
    if (ENERGISA_STANDARD_SYSTEMS.includes(item.system)) {
      map.set(`${item.system}_${item.connection}`, { ...item });
    }
  });
  return Array.from(map.values());
}

export function getDiagnosticRuleValue(key: string, fallback: number): number {
  if (cachedRules.has(key)) return cachedRules.get(key)!;
  if (key === 'current_unbalance_limit_percent' && cachedRules.has('current_unbalance_alert_percent')) {
    return cachedRules.get('current_unbalance_alert_percent')!;
  }
  if (key === 'current_unbalance_alert_percent' && cachedRules.has('current_unbalance_limit_percent')) {
    return cachedRules.get('current_unbalance_limit_percent')!;
  }
  return fallback;
}

export function classifyProdistVoltage(
  measuredVoltageV: number,
  nominalVoltageV: number,
  connection: 'FF' | 'FN' = 'FF'
): { status: 'ADEQUADA' | 'PRECARIA' | 'CRITICA'; range: ProdistVoltageRange } | null {
  if (measuredVoltageV <= 0 || nominalVoltageV <= 0) return null;

  const validRanges = getOfflineProdistVoltageRanges();
  let range: ProdistVoltageRange | undefined = validRanges.find(
    (candidate) => candidate.connection === connection && Math.abs(candidate.nominalV - nominalVoltageV) < 1.0
  );

  if (!range) {
    range = cachedVoltageRanges.find(
      (candidate) => candidate.connection === connection && Math.abs(candidate.nominalV - nominalVoltageV) < 1.0
    );
  }

  // Fallback analítico oficial PRODIST Módulo 8 da ANEEL (0.92 a 1.05 = Adequada; 0.87 a 1.06 = Precária)
  if (!range) {
    const adequateMinV = Math.round(nominalVoltageV * 0.92);
    const adequateMaxV = Math.round(nominalVoltageV * 1.05);
    const precariousLowMinV = Math.round(nominalVoltageV * 0.87);
    const precariousHighMaxV = Math.round(nominalVoltageV * 1.06);

    range = {
      system: `${nominalVoltageV}V ${connection}`,
      connection,
      nominalV: nominalVoltageV,
      adequateMinV,
      adequateMaxV,
      precariousLowMinV,
      precariousHighMaxV,
      criticalLowBelowV: precariousLowMinV,
      criticalHighAboveV: precariousHighMaxV,
      sourcePage: 1
    };
  }

  const effectiveRange: ProdistVoltageRange = range;

  if (measuredVoltageV >= effectiveRange.adequateMinV && measuredVoltageV <= effectiveRange.adequateMaxV) {
    return { status: 'ADEQUADA', range: effectiveRange };
  }
  if (measuredVoltageV >= effectiveRange.precariousLowMinV && measuredVoltageV <= effectiveRange.precariousHighMaxV) {
    return { status: 'PRECARIA', range: effectiveRange };
  }
  return { status: 'CRITICA', range: effectiveRange };
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
