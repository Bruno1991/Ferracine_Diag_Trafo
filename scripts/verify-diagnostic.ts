import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getOfflineInmetroModels, parseSqliteData } from '../src/utils/sqliteAndSplitLoader';
import { getMissingMeasurementFields, performFullDiagnosticAnalysis, processSingleMeasurement } from '../src/utils/electricalCalculations';
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
  { id: 1, label: 'M1', timestamp: '02:25:34', isLocked: false, isRecorded: true, van: 100, vbn: 100, vcn: 100, vab: 200, vbc: 200, vca: 200, ia: 10, ib: 1, ic: 100, in: 1, powerFactor: 0.92, avgVoltagePhaseNeutral: 0, avgVoltagePhasePhase: 0, avgCurrent: 0, totalKva: 0, loadingPercent: 0, fdtpPercent: 0 },
  { id: 2, label: 'M2', timestamp: '02:25:33', isLocked: false, isRecorded: true, van: 100, vbn: 100, vcn: 100, vab: 200, vbc: 220, vca: 220, ia: 600, ib: 5, ic: 555, in: 5, powerFactor: 0.92, avgVoltagePhaseNeutral: 0, avgVoltagePhasePhase: 0, avgCurrent: 0, totalKva: 0, loadingPercent: 0, fdtpPercent: 0 },
  { id: 3, label: 'M3', timestamp: '02:24:13', isLocked: false, isRecorded: true, van: 100, vbn: 100, vcn: 100, vab: 200, vbc: 220, vca: 220, ia: 55, ib: 555, ic: 5, in: 555, powerFactor: 0.92, avgVoltagePhaseNeutral: 0, avgVoltagePhasePhase: 0, avgCurrent: 0, totalKva: 0, loadingPercent: 0, fdtpPercent: 0 }
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

const partialRaw: SingleMeasurement = {
  id: 1, label: 'Parcial', timestamp: '10:00:00', isLocked: false, isRecorded: true,
  van: 127, vbn: 0, vcn: 0, vab: 220, vbc: 0, vca: 0,
  ia: 0, ib: 0, ic: 0, in: 0, powerFactor: 0.92,
  avgVoltagePhaseNeutral: 0, avgVoltagePhasePhase: 0, avgCurrent: 0,
  totalKva: 0, loadingPercent: 0, fdtpPercent: 0
};
const partial = processSingleMeasurement(partialRaw, transformer);
const partialAnalysis = performFullDiagnosticAnalysis([
  partial,
  { ...partial, id: 2, label: 'M2', timestamp: '', isRecorded: false, isLocked: true },
  { ...partial, id: 3, label: 'M3', timestamp: '', isRecorded: false, isLocked: true }
], transformer, '5m');
assert(partial.avgVoltagePhaseNeutral === 0 && partial.avgVoltagePhasePhase === 0, 'Entrada parcial nao pode produzir media trifasica.');
assert(getMissingMeasurementFields(partial, transformer).includes('Vbn'), 'Campos ausentes da medicao parcial nao foram detectados.');
assert(partialAnalysis.prodist.voltageStatus === 'A MEDIR', 'Entrada parcial nao pode receber classificacao PRODIST.');
assert(partialAnalysis.iticAnalysis.classifications.length === 0, 'Entrada parcial nao pode aparecer como ponto PRODIST valido.');
assert(!partialAnalysis.dataQuality.canIssueTapRecommendation && !partialAnalysis.dataQuality.canIssueReport, 'Entrada parcial deve bloquear TAP e laudo.');

const healthyRaw: SingleMeasurement[] = ['10:00:00', '10:00:05', '10:00:10'].map((timestamp, index) => ({
  id: index + 1,
  label: `M${index + 1}`,
  timestamp,
  isLocked: false,
  isRecorded: true,
  van: 127, vbn: 127, vcn: 127,
  vab: 220, vbc: 220, vca: 220,
  ia: 100, ib: 100, ic: 100, in: 0,
  powerFactor: 0.92,
  avgVoltagePhaseNeutral: 0, avgVoltagePhasePhase: 0, avgCurrent: 0,
  totalKva: 0, loadingPercent: 0, fdtpPercent: 0
}));
const healthy = healthyRaw.map((measurement) => processSingleMeasurement(measurement, transformer));
const healthyAnalysis = performFullDiagnosticAnalysis(healthy, transformer, '5s');
assert(healthyAnalysis.dataQuality.status === 'VALIDO' && healthyAnalysis.dataQuality.canIssueReport, 'Tres medicoes coerentes deveriam liberar o laudo.');
assert(healthyAnalysis.prodist.voltageStatus === 'ADEQUADA', 'Cenario equilibrado deveria ser ADEQUADO no PRODIST.');
assert(healthyAnalysis.iticAnalysis.classifications.every((item) => item.status === 'ADEQUADA'), 'Tabela ponto a ponto deve concordar com o resumo PRODIST.');
assert(healthyAnalysis.recommendedTap.includes(`TAP ${transformer.activeTapIndex}`), 'Recomendacao deve usar o TAP real do transformador.');

const serviceWorker = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8');
assert(serviceWorker.includes('networkFirst') && serviceWorker.includes('ferracine-diag-trafo-v5'), 'Service worker deve atualizar navegacao sem perder o fallback offline.');

console.log(JSON.stringify({
  fdM2: measurements[1].fdtpPercent,
  inmetroModels: inmetroModels.length,
  fuse: analysis.recommendedFuse.fuseCode,
  dataQuality: analysis.dataQuality.status,
  issues: analysis.dataQuality.issues.map((issue) => `${issue.measurementId || 'bloco'}:${issue.code}:${issue.severity}`),
  tap: analysis.recommendedTap,
  pointStatuses: analysis.iticAnalysis.classifications.map((item) => `M${item.measurementId}:${item.status}`),
  healthyTap: healthyAnalysis.recommendedTap
}, null, 2));
