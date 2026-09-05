export type TransformerType = 'NOVO' | 'RECONDICIONADO' | 'USADO';
export type PhaseType = 'TRIFASICO' | 'MONOFASICO';
export type MeasurementCycleMode = '5s' | '10m';
export type TransformerCatalogSource = 'INMETRO' | 'ETU' | 'FIELD';
export type InmetroValidationStatus =
  | 'COERENTE_ETU'
  | 'COERENTE_SEM_REFERENCIA_ETU'
  | 'ACIMA_LIMITE_ETU'
  | 'DADOS_INCONSISTENTES'
  | 'SEM_DADOS_DE_PERDAS';

export interface InmetroTransformerModel {
  id: string;
  category: 'NOVO' | 'RECONDICIONADO';
  manufacturer: string;
  phaseType: PhaseType;
  model?: string;
  powerKva: number;
  voltageClassKv: number;
  pedestal?: boolean;
  nominalConventionalNoLoadW?: number;
  nominalConventionalTotalW?: number;
  nominalReliableNoLoadW?: number;
  nominalReliableTotalW?: number;
  criticalConventionalNoLoadW?: number;
  criticalConventionalTotalW?: number;
  criticalReliableNoLoadW?: number;
  criticalReliableTotalW?: number;
  temperatureRise55C: boolean;
  temperatureRise65C: boolean;
  temperatureRise75C: boolean;
  windingCopper: boolean;
  windingAluminum: boolean;
  nbiKv?: string;
  derivedLoadLossW?: number;
  efficiencyPercent?: number;
  validationStatus: InmetroValidationStatus;
  validationNote: string;
  diagnosticReady: boolean;
  sourceDocument: string;
  sourcePage: number;
}

export interface TransformerSpec {
  id: string;
  category: TransformerType;
  state?: string;
  phaseType: PhaseType;
  powerKva: number; // e.g. 15, 30, 45, 75, 112.5, 150, 225, 300, 500
  primaryVoltageV: number; // e.g. 13800, 34500, 23100, 7960
  secondaryVoltageV: number; // e.g. 220 (phase-phase) or 380, etc.
  secondaryNeutralV: number; // e.g. 127, 220, 254, 115
  impedancePercent: number; // %Z e.g. 3.5, 4.0, 4.5, 5.0
  oilTempC?: number; // Temperatura do Óleo (°C) e.g. 55, 65, 75
  windingMaterial?: 'ALUMINIO' | 'COBRE'; // Material dos enrolamentos (Alumínio ou Cobre)
  oilType?: 'MINERAL' | 'VEGETAL'; // Tipo de óleo isolante (Mineral ou Vegetal)
  manufacturingDate?: string; // Data/Ano de fabricação (ex: 05/2021)
  efficiencyLevel?: number | string; // Nível de Eficiência da Placa (%) ex: 98.80
  brand?: string; // Marca / Fabricante
  serialNumber?: string; // N° de Série
  noLoadLossW: number; // P0 (Perdas em vazio W)
  loadLoss75cW: number; // Pk (Perdas em carga W)
  totalLossW: number; // P0 + Pk
  efficiencyPercent: number; // Eficiência nominal %
  noLoadCurrentPercent?: number; // %I0
  standardReference: string; // e.g. "ABNT NBR 5440 - Placa Trafo"
  dateAdded: string;
  tapCount?: number;
  activeTapIndex?: number;
  tapVoltages?: { [pos: number]: number };
  /** Origem do registro. A base normativa nunca e enviada como cadastro comunitario. */
  dataOrigin?: 'NORMATIVE' | 'COMMUNITY';
  /** Data usada para resolver conflitos durante a sincronizacao entre dispositivos. */
  updatedAt?: string;
}

export interface FuseRecommendation {
  oilType?: 'MINERAL' | 'VEGETAL';
  phaseType?: PhaseType;
  primaryVoltageV: number;
  powerKva: number;
  fuseRatingA: number; // 1 to 5 = Tipo H; 6 to 100 = Tipo K
  fuseType: 'H' | 'K';
  fuseCode: string; // e.g. "1H", "3H", "5H", "6K", "10K", "15K"
  fuseTypeH?: string;
  fuseTypeK?: string;
  fuseTypeT?: string;
  sourceDocument?: string;
  sourcePage?: number;
  sourceTable?: string;
  notes: string;
}

export interface UtmCoordinates {
  easting: number;
  northing: number;
  zone: string;
  hemisphere: 'N' | 'S';
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

export type AuthorRole = 'ELETRICISTA' | 'TÉCNICO' | 'ENGENHEIRO' | string;

export interface ReportAuthor {
  id: string;
  role: AuthorRole;
  name: string;
  matricula: string;
}

export interface InitialDiagnosticData {
  concessionaria: string;
  equipe?: string;
  locationName: string;
  cityState: string;
  dateTime: string;
  utm: UtmCoordinates | null;
  authors?: ReportAuthor[];
  electrician1Name: string;
  electrician1Matricula: string;
  electrician2Name?: string;
  electrician2Matricula?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  transformerTag: string;
  transformerBrand?: string;
  serialNumber?: string;
  technicalNotes?: string;
}

export interface SingleMeasurement {
  id: number; // 1, 2, or 3
  label: string;
  timestamp: string;
  isLocked: boolean;
  /** True only after the technician explicitly records this measurement. */
  isRecorded?: boolean;
  
  // Voltages Phase to Neutral (V)
  van: number;
  vbn: number;
  vcn: number;
  
  // Voltages Phase to Phase (V)
  vab: number;
  vbc: number;
  vca: number;
  
  // Currents (A)
  ia: number;
  ib: number;
  ic: number;
  in?: number; // Corrente no Neutro [A]

  // Phase Angles (Degrees)
  angleA?: number; // Phase A angle (deg)
  angleB?: number; // Phase B angle (deg)
  angleC?: number; // Phase C angle (deg)
  phaseAngleTheta?: number; // Angle θ between V and I for Monofásico
  
  // Power Factor
  powerFactor: number;
  
  // Calculated per measurement
  avgVoltagePhaseNeutral: number;
  avgVoltagePhasePhase: number;
  avgCurrent: number;
  totalKva: number;
  loadingPercent: number;
  fdtpPercent: number; // Fator de desbalanço de tensão
}

export interface ProdistStatus {
  voltageStatus: 'A MEDIR' | 'ADEQUADA' | 'PRECARIA' | 'CRITICA';
  voltageClassificationText: string;
  unbalanceStatus: 'ADEQUADO' | 'PRECARIO' | 'CRITICO';
  fdtpPercent: number;
}





export interface DiagnosticAnalysis {
  avgVan: number;
  avgVbn: number;
  avgVcn: number;
  avgVab: number;
  avgVbc: number;
  avgVca: number;
  avgIa: number;
  avgIb: number;
  avgIc: number;
  avgIn: number;
  
  overallAvgPhaseNeutralV: number;
  overallAvgPhasePhaseV: number;
  overallAvgCurrentA: number;
  
  nominalSecondaryPhasePhaseV: number;
  nominalSecondaryPhaseNeutralV: number;
  nominalCurrentSecondaryA: number;
  nominalCurrentPrimaryA: number;
  
  maxKvaMeasured: number;
  avgKvaMeasured: number;
  maxLoadingPercent: number;
  avgLoadingPercent: number;
  loadingCondition: 'SUB-CARREGADO' | 'IDEAL' | 'ELEVADO' | 'SOBRECARGA_MODERADA' | 'SOBRECARGA_CRITICA';

  // Specific Phase Validation Metrics & Alerts
  phaseTypeEvaluated: PhaseType;
  voltageUnbalancePercentNema: number;
  currentUnbalancePercent: number;
  phaseAlerts: {
    type: 'ALERTA_BAIXO_FATOR_POTENCIA' | 'ALERTA_DESEQUILIBRIO_CORRENTE' | 'ERRO_ANGULO_TRIFASICO' | 'CRITICO_DESEQUILIBRIO_TENSAO_NEMA';
    message: string;
    severity: 'CRITICAL' | 'WARNING';
  }[];

  cycleMode: MeasurementCycleMode;
  dataQuality: {
    status: 'VALIDO' | 'ALERTA' | 'INCONSISTENTE';
    isInstantaneous?: boolean;
    validMeasurementsCount?: number;
    issues: Array<{
      measurementId?: number;
      code:
        | 'TRANSFORMADOR_INCOMPLETO'
        | 'MEDICAO_INCOMPLETA'
        | 'MEDICOES_INSUFICIENTES'
        | 'CAMPANHA_PARCIAL'
        | 'CRONOLOGIA'
        | 'CRONOLOGIA_COINCIDENTE'
        | 'INTERVALO'
        | 'RELACAO_TENSAO'
        | 'TENSAO_PRODIST'
        | 'FDTP'
        | 'DESEQUILIBRIO_CORRENTE'
        | 'CORRENTE_NEUTRO'
        | 'CARREGAMENTO'
        | 'MEDICAO_INSTANTANEA';
      severity: 'CRITICAL' | 'WARNING';
      title: string;
      message: string;
    }>;
    canIssueTapRecommendation: boolean;
    canIssueReport: boolean;
  };
  
  prodist: ProdistStatus;
  
  estimatedCopperLossW: number;
  estimatedIronLossW: number;
  totalCalculatedLossW: number;
  calculatedEfficiencyPercent: number;
  windingMaterial: 'ALUMINIO' | 'COBRE';
  oilType: 'MINERAL' | 'VEGETAL';
  manufacturingDate: string;
  efficiencyLevel?: number | string;
  thermalConstantTk: number;
  thermalCorrectionFactorKt: number;
  
  recommendedFuse: FuseRecommendation | null;
  recommendedTap: string;
  tapAdjustmentAdvice: string;
}
