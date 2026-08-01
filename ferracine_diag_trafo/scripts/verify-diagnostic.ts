import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getOfflineInmetroModels, parseSqliteData } from '../src/utils/sqliteAndSplitLoader';
import { performFullDiagnosticAnalysis, processSingleMeasurement } from '../src/utils/electricalCalculations';
import type { SingleMeasurement } from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const databasePath = join(process.cwd(), 'public', 'database', 'ferracine-trafo.sqlite');
const transformers = await parseSqliteData(new Uint8Array(readFileSync(databasePath)), 'BUNDLED');
const inmetroModels = getOfflineInmetroModels();
assert(inmetroModels.length === 1183, `Esperados 1.183 modelos INMETRO; obtidos ${inmetroModels.length}.`);
assert(inmetroModels.filter((item) => item.category === 'NOVO').length === 613, 'A lista INMETRO de novos está incompleta.');
assert(inmetroModels.filter((item) => item.category === 'RECONDICIONADO').length === 570, 'A lista INMETRO de recondicionados está incompleta.');
assert(inmetroModels.every((item) => !('labelNumber' in item)), 'O número de etiqueta não deve integrar o banco do app.');
assert(
  inmetroModels.filter((item) => item.category === 'RECONDICIONADO').every((item) => !item.diagnosticReady),
  'Linhas recondicionadas sem perdas não podem alimentar cálculos de diagnóstico.'
);
const transformer = transformers.find((item) =>
  item.phaseType === 'TRIFASICO' &&
  item.oilType === 'VEGETAL' &&
  item.powerKva === 300 &&
  item.primaryVoltageV === 13800 &&
  item.secondaryVoltageV === 220
);
assert(transformer, 'Transformador de teste 300 kVA / 13,8 kV / 220 V não encontrado.');

const raw: SingleMeasurement[] = [
  { id: 1, label: 'M1', timestamp: '02:25:34', isLocked: false, van: 100, vbn: 100, vcn: 100, vab: 200, vbc: 200, vca: 200, ia: 10, ib: 1, ic: 100, in: 1, powerFactor: 0.92, avgVoltagePhaseNeutral: 0, avgVoltagePhasePhase: 0, avgCurrent: 0, totalKva: 0, loadingPercent: 0, fdtpPercent: 0 },
  { id: 2, label: 'M2', timestamp: '02:25:33', isLocked: false, van: 100, vbn: 100, vcn: 100, vab: 200, vbc: 220, vca: 220, ia: 600, ib: 5, ic: 555, in: 5, powerFactor: 0.92, avgVoltagePhaseNeutral: 0, avgVoltagePhasePhase: 0, avgCurrent: 0, totalKva: 0, loadingPercent: 0, fdtpPercent: 0 },
  { id: 3, label: 'M3', timestamp: '02:24:13', isLocked: false, van: 100, vbn: 100, vcn: 100, vab: 200, vbc: 220, vca: 220, ia: 55, ib: 555, ic: 5, in: 555, powerFactor: 0.92, avgVoltagePhaseNeutral: 0, avgVoltagePhasePhase: 0, avgCurrent: 0, totalKva: 0, loadingPercent: 0, fdtpPercent: 0 }
];
const measurements = raw.map((measurement) => processSingleMeasurement(measurement, transformer));
const analysis = performFullDiagnosticAnalysis(measurements, transformer, '5s');

assert(measurements[1].fdtpPercent === 6.16, `FDTP esperado 6,16%; obtido ${measurements[1].fdtpPercent}%.`);
assert(analysis.recommendedFuse?.fuseCode === '12K', `Elo esperado 12K; obtido ${analysis.recommendedFuse?.fuseCode || 'nenhum'}.`);
assert(analysis.dataQuality.status === 'INCONSISTENTE', `Qualidade esperada INCONSISTENTE; obtida ${analysis.dataQuality.status}.`);
assert(analysis.dataQuality.issues.some((issue) => issue.code === 'RELACAO_TENSAO'), 'A inconsistência F-N/F-F não foi detectada.');
assert(analysis.dataQuality.issues.some((issue) => issue.code === 'DESEQUILIBRIO_CORRENTE' && issue.severity === 'CRITICAL'), 'O desbalanceamento crítico de corrente não foi detectado.');
assert(analysis.dataQuality.issues.some((issue) => issue.code === 'CRONOLOGIA'), 'A cronologia invertida não foi detectada.');
assert(!analysis.dataQuality.canIssueTapRecommendation && analysis.recommendedTap.includes('BLOQUEADA'), 'A recomendação de TAP deveria estar bloqueada.');
assert(analysis.iticAnalysis.classifications[0]?.status === 'PRECARIA', `M1 deveria ser PRECÁRIA; obtido ${analysis.iticAnalysis.classifications[0]?.status}.`);
assert(analysis.iticAnalysis.classifications.every((item) => item.status === 'PRECARIA'), 'Cada etapa deveria refletir o pior valor F-F (200 V, faixa precária).');

console.log(JSON.stringify({
  fdM2: measurements[1].fdtpPercent,
  inmetroModels: inmetroModels.length,
  fuse: analysis.recommendedFuse.fuseCode,
  dataQuality: analysis.dataQuality.status,
  issues: analysis.dataQuality.issues.map((issue) => `${issue.measurementId || 'bloco'}:${issue.code}:${issue.severity}`),
  tap: analysis.recommendedTap,
  pointStatuses: analysis.iticAnalysis.classifications.map((item) => `M${item.measurementId}:${item.status}`)
}, null, 2));
