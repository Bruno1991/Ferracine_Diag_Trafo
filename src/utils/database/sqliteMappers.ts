import { Database as SqlDatabase } from 'sql.js';
import type {
  FuseRecommendation,
  InmetroTransformerModel,
  InmetroValidationStatus,
  PhaseType,
  TransformerSpec,
  TransformerType
} from '../../types';
import { OilType, ProdistVoltageRange } from './types';

export function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function asOptionalNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function asCategory(value: unknown): TransformerType {
  const normalized = String(value || '').toUpperCase();
  return normalized === 'RECONDICIONADO' || normalized === 'USADO' ? normalized : 'NOVO';
}

export function asPhaseType(value: unknown): PhaseType {
  const normalized = String(value || '').toUpperCase();
  if (normalized.includes('MONO') || normalized.includes('BI')) return 'MONOFASICO';
  return 'TRIFASICO';
}

export function parseTapVoltages(value: unknown): Record<number, number> | undefined {
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

export function rowsAsObjects(db: SqlDatabase, query: string): Record<string, unknown>[] {
  const result = db.exec(query);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
}

export function mapTransformer(row: Record<string, unknown>): TransformerSpec {
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

export function mapInmetroModel(row: Record<string, unknown>): InmetroTransformerModel {
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

export function readAuxiliaryData(db: SqlDatabase): {
  fuses: FuseRecommendation[];
  voltageRanges: ProdistVoltageRange[];
  rules: Map<string, number>;
} {
  const fuses = rowsAsObjects(
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

  const voltageRanges = rowsAsObjects(
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

  const rules = new Map(
    rowsAsObjects(db, 'SELECT key, value FROM diagnostic_rules').map((row) => [String(row.key), asNumber(row.value)])
  );
  return { fuses, voltageRanges, rules };
}

const REQUIRED_RULES = [
  'prodist_fd_limit_bt_percent',
  'current_unbalance_alert_percent'
];

export function validateDatabaseContent(
  metadata: Map<string, string>,
  transformers: TransformerSpec[],
  inmetroModels: InmetroTransformerModel[],
  fuses: FuseRecommendation[],
  voltageRanges: ProdistVoltageRange[],
  rules: Map<string, number>
): void {
  if (metadata.get('database_id') !== 'ferracine-trafo-db') {
    throw new Error('Banco SQLite rejeitado: identificador oficial ausente ou invalido.');
  }
  const generatedAt = metadata.get('generated_at') || '';
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error('Banco SQLite rejeitado: data de geracao invalida.');
  }
  if (transformers.length === 0 || inmetroModels.length === 0 || fuses.length === 0 || voltageRanges.length === 0 || rules.size === 0) {
    throw new Error('Banco SQLite rejeitado: conteudo minimo obrigatorio ausente.');
  }
  const transformerIds = new Set(transformers.map((item) => item.id));
  const inmetroIds = new Set(inmetroModels.map((item) => item.id));
  if (transformerIds.size !== transformers.length || transformerIds.has('')) {
    throw new Error('Banco SQLite rejeitado: IDs de transformadores vazios ou duplicados.');
  }
  if (inmetroIds.size !== inmetroModels.length || inmetroIds.has('')) {
    throw new Error('Banco SQLite rejeitado: IDs INMETRO vazios ou duplicados.');
  }
  if (transformers.some((item) => item.powerKva <= 0 || item.primaryVoltageV <= 0 || item.secondaryVoltageV <= 0 || item.impedancePercent <= 0)) {
    throw new Error('Banco SQLite rejeitado: perfil ETU com grandeza nominal invalida.');
  }
  if (fuses.some((item) => item.powerKva <= 0 || item.primaryVoltageV <= 0 || item.fuseRatingA <= 0 || !item.fuseCode)) {
    throw new Error('Banco SQLite rejeitado: matriz de elos contem valores invalidos.');
  }
  if (voltageRanges.some((range) =>
    range.nominalV <= 0 ||
    range.criticalLowBelowV >= range.adequateMinV ||
    range.adequateMinV > range.adequateMaxV ||
    range.criticalHighAboveV <= range.adequateMaxV
  )) {
    throw new Error('Banco SQLite rejeitado: faixas PRODIST incoerentes.');
  }
  for (const key of REQUIRED_RULES) {
    if (!Number.isFinite(rules.get(key))) throw new Error(`Banco SQLite rejeitado: regra obrigatoria ${key} ausente.`);
  }
  const declaredInmetroCount = Number(metadata.get('inmetro_model_count'));
  if (Number.isFinite(declaredInmetroCount) && declaredInmetroCount !== inmetroModels.length) {
    throw new Error('Banco SQLite rejeitado: contagem INMETRO diverge do metadata.');
  }
}
