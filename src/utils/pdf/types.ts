import { InitialDiagnosticData, TransformerSpec, SingleMeasurement, DiagnosticAnalysis, MeasurementCycleMode } from '../../types';

export interface PdfExportOptions {
  initialData: InitialDiagnosticData;
  transformer: TransformerSpec;
  measurements: SingleMeasurement[];
  analysis: DiagnosticAnalysis;
  cycleMode: MeasurementCycleMode;
  hexDataUrl?: string;
  photos?: string[];
}

export const PDF_COLORS = {
  primary: [15, 23, 42] as [number, number, number],      // slate-900
  secondary: [30, 58, 138] as [number, number, number],   // blue-900
  accent: [2, 132, 199] as [number, number, number],      // sky-600
  slate50: [248, 250, 252] as [number, number, number],
  slate100: [241, 245, 249] as [number, number, number],
  slate200: [226, 232, 240] as [number, number, number],
  slate300: [203, 213, 225] as [number, number, number],
  slate500: [100, 116, 139] as [number, number, number],
  slate800: [30, 41, 59] as [number, number, number]
};

export const PDF_PAGE_MARGIN = 14;

export function formatKv(voltageV: number): string {
  if (!voltageV || voltageV <= 0) return '0 kV';
  const kv = voltageV / 1000;
  const formatted = parseFloat(kv.toFixed(3)).toString();
  return `${formatted} kV`;
}
