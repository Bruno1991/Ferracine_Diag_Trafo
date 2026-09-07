export const OFFLINE_DATABASE_FILE = 'database/ferracine-trafo.sqlite?schema=3';
export const OFFLINE_WASM_FILE = 'vendor/sql-wasm.wasm';
export const SUPPORTED_SCHEMA_VERSION = 3;

export type OilType = 'MINERAL' | 'VEGETAL';

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

export const ENERGISA_STANDARD_SYSTEMS = [
  '220/127',
  '230/115',
  '240/120',
  '254/127',
  '380/220',
  '440/220'
];

export const ENERGISA_DEFAULT_VOLTAGE_RANGES: ProdistVoltageRange[] = [
  { system: '220/127', connection: 'FF', nominalV: 220, adequateMinV: 202, adequateMaxV: 231, precariousLowMinV: 191, precariousHighMaxV: 233, criticalLowBelowV: 191, criticalHighAboveV: 233, sourcePage: 1 },
  { system: '220/127', connection: 'FN', nominalV: 127, adequateMinV: 117, adequateMaxV: 133, precariousLowMinV: 110, precariousHighMaxV: 135, criticalLowBelowV: 110, criticalHighAboveV: 135, sourcePage: 1 },
  { system: '230/115', connection: 'FF', nominalV: 230, adequateMinV: 212, adequateMaxV: 242, precariousLowMinV: 200, precariousHighMaxV: 244, criticalLowBelowV: 200, criticalHighAboveV: 244, sourcePage: 1 },
  { system: '230/115', connection: 'FN', nominalV: 115, adequateMinV: 106, adequateMaxV: 121, precariousLowMinV: 100, precariousHighMaxV: 122, criticalLowBelowV: 100, criticalHighAboveV: 122, sourcePage: 1 },
  { system: '240/120', connection: 'FF', nominalV: 240, adequateMinV: 221, adequateMaxV: 252, precariousLowMinV: 209, precariousHighMaxV: 254, criticalLowBelowV: 209, criticalHighAboveV: 254, sourcePage: 1 },
  { system: '240/120', connection: 'FN', nominalV: 120, adequateMinV: 110, adequateMaxV: 126, precariousLowMinV: 104, precariousHighMaxV: 127, criticalLowBelowV: 104, criticalHighAboveV: 127, sourcePage: 1 },
  { system: '254/127', connection: 'FF', nominalV: 254, adequateMinV: 234, adequateMaxV: 267, precariousLowMinV: 221, precariousHighMaxV: 269, criticalLowBelowV: 221, criticalHighAboveV: 269, sourcePage: 1 },
  { system: '254/127', connection: 'FN', nominalV: 127, adequateMinV: 117, adequateMaxV: 133, precariousLowMinV: 110, precariousHighMaxV: 135, criticalLowBelowV: 110, criticalHighAboveV: 135, sourcePage: 1 },
  { system: '380/220', connection: 'FF', nominalV: 380, adequateMinV: 350, adequateMaxV: 399, precariousLowMinV: 331, precariousHighMaxV: 403, criticalLowBelowV: 331, criticalHighAboveV: 403, sourcePage: 1 },
  { system: '380/220', connection: 'FN', nominalV: 220, adequateMinV: 202, adequateMaxV: 231, precariousLowMinV: 191, precariousHighMaxV: 233, criticalLowBelowV: 191, criticalHighAboveV: 233, sourcePage: 1 },
  { system: '440/220', connection: 'FF', nominalV: 440, adequateMinV: 405, adequateMaxV: 462, precariousLowMinV: 383, precariousHighMaxV: 466, criticalLowBelowV: 383, criticalHighAboveV: 466, sourcePage: 1 },
  { system: '440/220', connection: 'FN', nominalV: 220, adequateMinV: 202, adequateMaxV: 231, precariousLowMinV: 191, precariousHighMaxV: 233, criticalLowBelowV: 191, criticalHighAboveV: 233, sourcePage: 1 }
];
