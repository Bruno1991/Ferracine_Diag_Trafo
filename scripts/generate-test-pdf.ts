import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTransformerDiagnosticPdfDoc } from '../src/utils/pdfGenerator';
import { performFullDiagnosticAnalysis, processSingleMeasurement } from '../src/utils/electricalCalculations';
import { parseSqliteData } from '../src/utils/sqliteAndSplitLoader';
import type { SingleMeasurement, TransformerSpec, InitialDiagnosticData } from '../src/types';

async function main() {
  const databasePath = join(process.cwd(), 'public', 'database', 'ferracine-trafo.sqlite');
  const transformers = await parseSqliteData(new Uint8Array(readFileSync(databasePath)), 'BUNDLED');
  const transformer = transformers.find((item) =>
    item.phaseType === 'TRIFASICO' &&
    item.powerKva === 112.5 &&
    item.primaryVoltageV === 13800 &&
    item.secondaryVoltageV === 220
  ) || {
    id: 'trafo-112',
    category: 'NOVO',
    phaseType: 'TRIFASICO',
    powerKva: 112.5,
    primaryVoltageV: 13800,
    secondaryVoltageV: 220,
    secondaryNeutralV: 127,
    impedancePercent: 4.5,
    oilTempC: 65,
    noLoadLossW: 366,
    loadLoss75cW: 2215,
    totalLossW: 2581,
    efficiencyPercent: 97.92,
    standardReference: 'Energisa ETU-109.2',
    dateAdded: '2026-09-06'
  } as TransformerSpec;

  const initialData: InitialDiagnosticData = {
    concessionaria: 'Energisa',
    equipe: 'CACPL84',
    locationName: 'CAC-03',
    cityState: 'CACOAL - RO',
    dateTime: '05/09/2026 13:47',
    utm: null,
    authors: [{ id: '1', role: 'ELETRICISTA', name: 'ELIAS BRUNO SILVA', matricula: '3092345' }],
    electrician1Name: 'ELIAS BRUNO SILVA',
    electrician1Matricula: '3092345',
    electrician2Name: '',
    electrician2Matricula: '',
    transformerTag: 'PTCA0121',
    technicalNotes: 'OCORRÊNCIA: Inspeção periódica\nFASE ATUADA: Normal\nCAUSA: N/A\nELO INSERIDO: 5H\nELO REMOVIDO: 5H\nOBSERVAÇÕES: Transformador operando com sobrecarga na fase B.'
  };

  const rawMeas: SingleMeasurement[] = [
    {
      id: 1, label: 'M1', timestamp: '13:19:08', isLocked: false, isRecorded: true,
      van: 120, vbn: 120, vcn: 120, vab: 207, vbc: 207, vca: 207,
      ia: 300, ib: 420, ic: 380, in: 45, powerFactor: 0.92,
      avgVoltagePhaseNeutral: 120, avgVoltagePhasePhase: 207, avgCurrent: 366.7,
      totalKva: 132, loadingPercent: 124.2, fdtpPercent: 0, criticalPhase: 'B', maxPhaseLoadingPercent: 142.3
    },
    {
      id: 2, label: 'M2', timestamp: '13:00:25', isLocked: false, isRecorded: true,
      van: 121, vbn: 120, vcn: 121, vab: 207, vbc: 206, vca: 207,
      ia: 300, ib: 420, ic: 380, in: 44, powerFactor: 0.92,
      avgVoltagePhaseNeutral: 120.7, avgVoltagePhasePhase: 206.7, avgCurrent: 366.7,
      totalKva: 132.68, loadingPercent: 124.2, fdtpPercent: 0.32, criticalPhase: 'B', maxPhaseLoadingPercent: 142.3
    }
  ];

  const measurements = rawMeas.map((m) => processSingleMeasurement(m, transformer));
  const analysis = performFullDiagnosticAnalysis(measurements, transformer, '5s');

  const doc = await buildTransformerDiagnosticPdfDoc({
    initialData,
    transformer,
    measurements,
    analysis,
    cycleMode: '5s'
  });

  const arrayBuffer = doc.output('arraybuffer');
  const buffer = Buffer.from(arrayBuffer);
  const outPath = join(process.cwd(), 'dist', 'test-laudo.pdf');
  writeFileSync(outPath, buffer);
  console.log('PDF gerado com sucesso em:', outPath, 'Tamanho:', buffer.length, 'bytes');
}

main().catch((err) => {
  console.error('Erro ao gerar PDF:', err);
  process.exit(1);
});
