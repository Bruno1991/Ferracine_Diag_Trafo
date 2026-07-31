export interface FuseMatrixEntry {
  primaryVoltageV: number;
  powerKva: number;
  fuseH: string;
  fuseK: string;
  fuseT: string;
  notes: string;
}

export interface NormativeBaseConfig {
  lastSyncIso: string;
  version: string;
  source: string;
  prodist: {
    title: string;
    summary: string;
    voltageAdequateMinRatio: number; // 0.93
    voltageAdequateMaxRatio: number; // 1.05
    voltagePrecariousMinRatio: number; // 0.90
    voltagePrecariousMaxRatio: number; // 1.07
    fdtpLimitPercent: number; // 2.0%
    currentUnbalanceLimitPercent: number; // 15.0%
  };
  nduEtu: {
    title: string;
    summary: string;
    maxContinuousLoadPercent: number; // 100
    maxEmergencyLoadPercent: number; // 120
    fuseTable: FuseMatrixEntry[];
  };
  abntCalculations: {
    title: string;
    tkCopper: number; // 234.5
    tkAluminum: number; // 225.0
    refTempC: number; // 75
    impedanceTolerancePercent: number; // 10
    formulas: Array<{ name: string; formula: string; description: string }>;
  };
  iticCbema: {
    title: string;
    summary: string;
  };
}

export const DEFAULT_NORMATIVE_BASE: NormativeBaseConfig = {
  lastSyncIso: new Date().toISOString(),
  version: '2026.2 — ANEEL / Energisa NDU-001 / ABNT NBR 5440',
  source: 'Banco de Dados Oficial de Normas ANEEL PRODIST Mód. 8, Especificações Energisa ETU/NDU e NBR 5440/5356',
  prodist: {
    title: 'PRODIST Módulo 8 - Qualidade da Energia Elétrica (ANEEL)',
    summary: 'Define os limites regulatórios de variação da tensão em regime permanente e limites de desbalanço para sistemas de distribuição.',
    voltageAdequateMinRatio: 0.93,
    voltageAdequateMaxRatio: 1.05,
    voltagePrecariousMinRatio: 0.90,
    voltagePrecariousMaxRatio: 1.07,
    fdtpLimitPercent: 2.0,
    currentUnbalanceLimitPercent: 15.0
  },
  nduEtu: {
    title: 'Normas Concessionária Energisa - NDUs e ETUs',
    summary: 'Parametrização técnica para proteção e dimensionamento de elos fusíveis e curvas de suportabilidade de transformadores de distribuição.',
    maxContinuousLoadPercent: 100,
    maxEmergencyLoadPercent: 120,
    fuseTable: [
      { primaryVoltageV: 13800, powerKva: 15, fuseH: '0.5H', fuseK: '1K', fuseT: '1T', notes: 'Monofásico ou Trifásico de baixa potência' },
      { primaryVoltageV: 13800, powerKva: 30, fuseH: '1H', fuseK: '2K', fuseT: '2T', notes: 'Trifásico Padrão NDU' },
      { primaryVoltageV: 13800, powerKva: 45, fuseH: '2H', fuseK: '3K', fuseT: '3T', notes: 'Trifásico Padrão NDU' },
      { primaryVoltageV: 13800, powerKva: 75, fuseH: '3H', fuseK: '5K', fuseT: '5T', notes: 'Trifásico Padrão NDU / ETU' },
      { primaryVoltageV: 13800, powerKva: 112.5, fuseH: '5H', fuseK: '6K', fuseT: '6T', notes: 'Trifásico Padrão NDU / ETU' },
      { primaryVoltageV: 13800, powerKva: 150, fuseH: '5H', fuseK: '8K', fuseT: '8T', notes: 'Trifásico Padrão NDU / ETU' },
      { primaryVoltageV: 13800, powerKva: 225, fuseH: '8H', fuseK: '10K', fuseT: '10T', notes: 'Trifásico Proteção Especial' },
      { primaryVoltageV: 13800, powerKva: 300, fuseH: '10H', fuseK: '15K', fuseT: '15T', notes: 'Trifásico Proteção Especial' },
      { primaryVoltageV: 34500, powerKva: 15, fuseH: '0.5H', fuseK: '0.5K', fuseT: '0.5T', notes: '34.5 kV Monofásico/Trifásico' },
      { primaryVoltageV: 34500, powerKva: 30, fuseH: '0.5H', fuseK: '1K', fuseT: '1T', notes: '34.5 kV Trifásico' },
      { primaryVoltageV: 34500, powerKva: 45, fuseH: '1H', fuseK: '2K', fuseT: '2T', notes: '34.5 kV Trifásico' },
      { primaryVoltageV: 34500, powerKva: 75, fuseH: '2H', fuseK: '3K', fuseT: '3T', notes: '34.5 kV Trifásico' },
      { primaryVoltageV: 34500, powerKva: 112.5, fuseH: '2H', fuseK: '3K', fuseT: '3T', notes: '34.5 kV Trifásico' },
      { primaryVoltageV: 34500, powerKva: 150, fuseH: '3H', fuseK: '5K', fuseT: '5T', notes: '34.5 kV Trifásico' },
      { primaryVoltageV: 34500, powerKva: 225, fuseH: '5H', fuseK: '6K', fuseT: '6T', notes: '34.5 kV Proteção Especial' },
      { primaryVoltageV: 34500, powerKva: 300, fuseH: '5H', fuseK: '8K', fuseT: '8T', notes: '34.5 kV Proteção Especial' }
    ]
  },
  abntCalculations: {
    title: 'ABNT NBR 5440 / NBR 5356 — Regras de Cálculo Elétrico',
    tkCopper: 234.5,
    tkAluminum: 225.0,
    refTempC: 75.0,
    impedanceTolerancePercent: 10.0,
    formulas: [
      { name: 'Potência Aparente Medida (kVA)', formula: 'S (kVA) = √3 × V_fase-fase_média × I_média / 1000', description: 'Calcula a potência operacional instantânea no secundário.' },
      { name: 'Carregamento do Transformador (%)', formula: 'Carregamento (%) = (S_medida / S_nominal) × 100', description: 'Avalia a ocupação da capacidade nominal do equipamento.' },
      { name: 'Fator de Desbalanço de Tensão (FDTP %)', formula: 'FDTP (%) = (Máx. Desvio de V em relação à Média / V_média) × 100', description: 'Mede a assimetria entre as tensões das fases (Limite PRODIST: 2.0%).' },
      { name: 'Fator de Correção Térmica de Enrolamento (Kt)', formula: 'Kt = (Tk + T_óleo) / (Tk + 75°C)', description: 'Ajusta a resistência do enrolamento (Cobre: Tk = 234,5°C | Alumínio: Tk = 225,0°C).' },
      { name: 'Perdas em Carga Ajustadas (Pk_calc)', formula: 'Pk_calc (W) = Pk_75°C × (I_medida / I_nominal)² × Kt', description: 'Simula as perdas Joule sob a corrente e temperatura atuais.' },
      { name: 'Rendimento Operacional Calculado (η %)', formula: 'η (%) = [ P_ativa / (P_ativa + P0 + Pk_calc) ] × 100', description: 'Mede a eficiência energética global do transformador sob carga real.' }
    ]
  },
  iticCbema: {
    title: 'Curva ITIC (Information Technology Industry Council) / CBEMA',
    summary: 'Define a zona de operação segura para variações de tensão transitórias (afundamentos e elevações) em função da duração temporal.'
  }
};

const STORAGE_KEY = 'tx_normative_base_config';

export function getNormativeBaseConfig(): NormativeBaseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_NORMATIVE_BASE, ...parsed };
    }
  } catch (e) {
    console.error('Erro ao carregar base normativa do localStorage', e);
  }
  return DEFAULT_NORMATIVE_BASE;
}

export function syncNormativeBaseConfig(): NormativeBaseConfig {
  const updated: NormativeBaseConfig = {
    ...DEFAULT_NORMATIVE_BASE,
    lastSyncIso: new Date().toISOString()
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Erro ao salvar base normativa no localStorage', e);
  }
  return updated;
}
