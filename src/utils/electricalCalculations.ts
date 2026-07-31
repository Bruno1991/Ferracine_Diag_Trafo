import { SingleMeasurement, TransformerSpec, DiagnosticAnalysis, ProdistStatus, FuseRecommendation, PhaseType, TransformerType, IticBlockAnalysis, IticMeasurementClassification, IticStatus } from '../types';

/**
 * Avalia o bloco de 3 medições (janela de 15 min - intervalo de 5 min)
 * segundo os critérios da Curva ITIC para Regime Permanente (t > 10s)
 * Limite Superior: 110% da Tensão Nominal
 * Limite Inferior: 90% da Tensão Nominal
 */
export function evaluateIticBlock(
  measurements: SingleMeasurement[],
  transformer: TransformerSpec
): IticBlockAnalysis {
  const nominalV = transformer.secondaryVoltageV || 220;
  const validMeas = measurements.filter((m) => m.avgVoltagePhasePhase > 0 || m.avgVoltagePhaseNeutral > 0);

  if (validMeas.length === 0) {
    return {
      windowStatus: 'AGUARDANDO MEDIÇÕES' as any,
      windowStatusText: 'Aguardando preenchimento das medições para avaliação da curva ITIC / CBEMA (15 min).',
      hasViolation: false,
      classifications: [],
      violationCount: 0
    };
  }

  const classifications: IticMeasurementClassification[] = (validMeas.length > 0 ? validMeas : measurements).map((m) => {
    const measV = m.avgVoltagePhasePhase > 0 ? m.avgVoltagePhasePhase : m.avgVoltagePhaseNeutral * Math.sqrt(3);
    const vPercent = nominalV > 0 ? (measV / nominalV) * 100 : 100;
    const roundedPercent = Math.round(vPercent * 10) / 10;
    const roundedV = Math.round(measV * 10) / 10;
    const roundedI = Math.round(m.avgCurrent * 10) / 10;

    let status: IticStatus = 'ZONA_SEGURA';
    let statusText = 'Dentro do envelope de segurança ITIC (90% - 110%)';

    if (roundedPercent > 110.0) {
      status = 'SOBRETENSÃO_SUSTENTADA';
      statusText = `Sobretensão Sustentada ITIC (${roundedPercent}% > 110%)`;
    } else if (roundedPercent < 90.0) {
      status = 'SUBTENSÃO_SUSTENTADA';
      statusText = `Subtensão Sustentada ITIC (${roundedPercent}% < 90%)`;
    }

    return {
      measurementId: m.id,
      timestamp: m.timestamp || `14:0${(m.id - 1) * 5}`,
      voltageV: roundedV,
      nominalV,
      voltagePercent: roundedPercent,
      currentA: roundedI,
      status,
      statusText
    };
  });

  const violationCount = classifications.filter((c) => c.status !== 'ZONA_SEGURA').length;
  const hasViolation = violationCount > 0;

  const windowStatus = hasViolation ? 'ALERTA_DE_VIOLAÇÃO_ITIC' : 'DENTRO_DOS_LIMITES_ITIC';
  const windowStatusText = hasViolation
    ? `Alerta ITIC: ${violationCount} de ${classifications.length} medição(ões) fora da Zona Segura (90% - 110%).`
    : 'Bloco Aprovado: Todas as 3 medições em regime permanente estão dentro da Zona Segura ITIC (90% - 110%).';

  return {
    windowStatus,
    windowStatusText,
    hasViolation,
    classifications,
    violationCount
  };
}

/**
 * Calcula perdas em vazio (P0), perdas em carga (Pk) e eficiência nominal
 * a partir das características de placa inseridas pelo técnico
 */
export function computeNominalLossesAndEfficiency(
  powerKva: number,
  phaseType: PhaseType,
  category: TransformerType,
  customP0?: number,
  customPk?: number,
  windingMaterial: 'ALUMINIO' | 'COBRE' = 'ALUMINIO'
) {
  let p0 = customP0 && customP0 > 0 ? customP0 : 0;
  let pk = customPk && customPk > 0 ? customPk : 0;

  if (p0 === 0 && powerKva > 0) {
    if (phaseType === 'TRIFASICO') {
      p0 = Math.round(5.5 * Math.pow(powerKva, 0.85));
    } else {
      p0 = Math.round(7.0 * Math.pow(powerKva, 0.75));
    }
    if (category === 'RECONDICIONADO' || category === 'USADO') {
      p0 = Math.round(p0 * 1.2);
    }
  }

  if (pk === 0 && powerKva > 0) {
    const pkMult = windingMaterial === 'COBRE' ? 17.0 : 19.2;
    if (phaseType === 'TRIFASICO') {
      pk = Math.round(pkMult * Math.pow(powerKva, 0.88));
    } else {
      const pkMonoMult = windingMaterial === 'COBRE' ? 20.0 : 23.0;
      pk = Math.round(pkMonoMult * Math.pow(powerKva, 0.82));
    }
    if (category === 'RECONDICIONADO' || category === 'USADO') {
      pk = Math.round(pk * 1.15);
    }
  }

  const totalLossW = p0 + pk;
  const powerW = powerKva * 1000;
  const pfNominal = 0.92;
  const efficiencyPercent = powerW > 0
    ? Number((((powerW * pfNominal) / (powerW * pfNominal + totalLossW)) * 100).toFixed(2))
    : 0;

  return {
    noLoadLossW: p0,
    loadLoss75cW: pk,
    totalLossW,
    efficiencyPercent
  };
}

/**
 * Calcula a corrente nominal secundária
 */
export function calculateNominalSecondaryCurrent(transformer: TransformerSpec): number {
  const { powerKva, secondaryVoltageV, phaseType } = transformer;
  if (phaseType === 'TRIFASICO') {
    return (powerKva * 1000) / (Math.sqrt(3) * secondaryVoltageV);
  } else {
    return (powerKva * 1000) / secondaryVoltageV;
  }
}

/**
 * Calcula a corrente nominal primária
 */
export function calculateNominalPrimaryCurrent(transformer: TransformerSpec): number {
  const { powerKva, primaryVoltageV, phaseType } = transformer;
  if (phaseType === 'TRIFASICO') {
    return (powerKva * 1000) / (Math.sqrt(3) * primaryVoltageV);
  } else {
    return (powerKva * 1000) / primaryVoltageV;
  }
}

/**
 * Atualiza métricas de uma medição individual
 */
export function processSingleMeasurement(
  meas: SingleMeasurement,
  transformer: TransformerSpec
): SingleMeasurement {
  const isTri = transformer.phaseType === 'TRIFASICO';

  // Médias de tensão fase-neutro
  let avgVfn = 0;
  if (isTri) {
    avgVfn = (meas.van + meas.vbn + meas.vcn) / 3;
  } else {
    if (meas.van > 0 && meas.vbn > 0) {
      avgVfn = (meas.van + meas.vbn) / 2;
    } else {
      avgVfn = meas.van > 0 ? meas.van : meas.vbn;
    }
  }

  // Médias de tensão fase-fase
  let avgVff = 0;
  if (isTri) {
    avgVff = (meas.vab + meas.vbc + meas.vca) / 3;
  } else {
    if (meas.vab > 0) {
      avgVff = meas.vab;
    } else if (meas.van > 0 && meas.vbn > 0) {
      avgVff = meas.van + meas.vbn;
    } else if (meas.van > 0) {
      avgVff = meas.van * 2;
    }
  }

  // Média de corrente
  let avgI = 0;
  if (isTri) {
    avgI = (meas.ia + meas.ib + meas.ic) / 3;
  } else {
    if (meas.ia > 0 && meas.ib > 0) {
      avgI = (meas.ia + meas.ib) / 2;
    } else {
      avgI = meas.ia > 0 ? meas.ia : meas.ib;
    }
  }

  // Potência aparente em kVA
  const totalKva = isTri
    ? (Math.sqrt(3) * avgVff * avgI) / 1000
    : (avgVff * avgI) / 1000;

  // Carregamento %
  const loadingPercent = transformer.powerKva > 0
    ? (totalKva / transformer.powerKva) * 100
    : 0;

  // Fator de desbalanço de tensão FDTP (%)
  let maxDev = 0;
  if (isTri && avgVfn > 0) {
    const devA = Math.abs(meas.van - avgVfn);
    const devB = Math.abs(meas.vbn - avgVfn);
    const devC = Math.abs(meas.vcn - avgVfn);
    maxDev = Math.max(devA, devB, devC);
  } else if (!isTri && avgVfn > 0 && meas.van > 0 && meas.vbn > 0) {
    const devA = Math.abs(meas.van - avgVfn);
    const devB = Math.abs(meas.vbn - avgVfn);
    maxDev = Math.max(devA, devB);
  }
  const fdtpPercent = avgVfn > 0 ? (maxDev / avgVfn) * 100 : 0;

  return {
    ...meas,
    avgVoltagePhaseNeutral: Math.round(avgVfn * 10) / 10,
    avgVoltagePhasePhase: Math.round(avgVff * 10) / 10,
    avgCurrent: Math.round(avgI * 10) / 10,
    totalKva: Math.round(totalKva * 100) / 100,
    loadingPercent: Math.round(loadingPercent * 10) / 10,
    fdtpPercent: Math.round(fdtpPercent * 100) / 100
  };
}

/**
 * Avalia Faixas de Tensão segundo PRODIST Módulo 8 da ANEEL
 */
export function evaluateProdist(
  measuredV: number,
  nominalV: number,
  fdtpPercent: number
): ProdistStatus {
  if (!measuredV || measuredV === 0) {
    return {
      voltageStatus: 'A MEDIR' as any,
      voltageClassificationText: 'Aguardando medições de tensão para classificação PRODIST Módulo 8 ANEEL.',
      unbalanceStatus: 'ADEQUADO',
      fdtpPercent: 0
    };
  }

  if (!nominalV || nominalV === 0) {
    return {
      voltageStatus: 'ADEQUADA',
      voltageClassificationText: 'Tensão dentro do padrão normal.',
      unbalanceStatus: 'ADEQUADO',
      fdtpPercent: 0
    };
  }

  const ratio = measuredV / nominalV;

  let voltageStatus: 'ADEQUADA' | 'PRECARIA' | 'CRITICA' = 'ADEQUADA';
  let text = 'Faixa de Tensão Adequada (PRODIST Mód. 8)';

  if (ratio >= 0.93 && ratio <= 1.05) {
    voltageStatus = 'ADEQUADA';
    text = `Faixa ADEQUADA (${Math.round(ratio * 100)}% da nominal). Atende requisitos ANEEL.`;
  } else if ((ratio >= 0.90 && ratio < 0.93) || (ratio > 1.05 && ratio <= 1.07)) {
    voltageStatus = 'PRECARIA';
    text = `Faixa PRECÁRIA (${Math.round(ratio * 100)}% da nominal). Requer ajuste de TAP ou reconfiguração de rede.`;
  } else {
    voltageStatus = 'CRITICA';
    text = `Faixa CRÍTICA (${Math.round(ratio * 100)}% da nominal). Sujeito a ressarcimento e risco a equipamentos.`;
  }

  const unbalanceStatus: 'ADEQUADO' | 'PRECARIO' | 'CRITICO' =
    fdtpPercent <= 2.0 ? 'ADEQUADO' : fdtpPercent <= 3.0 ? 'PRECARIO' : 'CRITICO';

  return {
    voltageStatus,
    voltageClassificationText: text,
    unbalanceStatus,
    fdtpPercent: Math.round(fdtpPercent * 100) / 100
  };
}

/**
 * Busca Elo Fusível Recomendado conforme NDU / ETU
 * Elos de 1A a 5A: Tipo H (ex: 1H, 2H, 3H, 5H)
 * Elos de 6A a 100A: Tipo K (ex: 6K, 8K, 10K, 15K, 20K, 25K, 30K)
 */
export function findRecommendedFuse(
  primaryVoltageV: number,
  powerKva: number,
  phaseType: PhaseType = 'TRIFASICO'
): FuseRecommendation | null {
  if (!primaryVoltageV || !powerKva) return null;

  const isTri = phaseType === 'TRIFASICO';
  const iPrim = isTri
    ? (powerKva * 1000) / (Math.sqrt(3) * primaryVoltageV)
    : (powerKva * 1000) / primaryVoltageV;

  // Fator de multiplicação de segurança para coordenação de proteção NDU/ETU
  const targetCurrent = iPrim * 1.4;

  const standardRatings = [1, 2, 3, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 65, 80, 100];
  let chosenRating = standardRatings.find((r) => r >= targetCurrent) || 100;
  if (targetCurrent < 1) chosenRating = 1;

  const fuseType: 'H' | 'K' = chosenRating <= 5 ? 'H' : 'K';
  const fuseCode = `${chosenRating}${fuseType}`;

  return {
    primaryVoltageV,
    powerKva,
    fuseRatingA: chosenRating,
    fuseType,
    fuseCode,
    fuseTypeH: fuseType === 'H' ? fuseCode : `${chosenRating}H`,
    fuseTypeK: fuseType === 'K' ? fuseCode : `${chosenRating}K`,
    notes: `Dimensionado conforme NDU/ETU para I_prim = ${iPrim.toFixed(2)} A (Elo ${fuseCode})`
  };
}

/**
 * Executa análise completa das 3 medições
 */
export function performFullDiagnosticAnalysis(
  measurements: SingleMeasurement[],
  transformer: TransformerSpec
): DiagnosticAnalysis {
  const validMeas = measurements.filter((m) => m.avgVoltagePhasePhase > 0 || m.avgVoltagePhaseNeutral > 0);
  const count = validMeas.length || 1;

  const sumVan = validMeas.reduce((acc, m) => acc + m.van, 0);
  const sumVbn = validMeas.reduce((acc, m) => acc + m.vbn, 0);
  const sumVcn = validMeas.reduce((acc, m) => acc + m.vcn, 0);

  const sumVab = validMeas.reduce((acc, m) => acc + m.vab, 0);
  const sumVbc = validMeas.reduce((acc, m) => acc + m.vbc, 0);
  const sumVca = validMeas.reduce((acc, m) => acc + m.vca, 0);

  const sumIa = validMeas.reduce((acc, m) => acc + m.ia, 0);
  const sumIb = validMeas.reduce((acc, m) => acc + m.ib, 0);
  const sumIc = validMeas.reduce((acc, m) => acc + m.ic, 0);
  const sumIn = validMeas.reduce((acc, m) => acc + (m.in || 0), 0);

  const avgVan = sumVan / count;
  const avgVbn = sumVbn / count;
  const avgVcn = sumVcn / count;

  const avgVab = sumVab / count;
  const avgVbc = sumVbc / count;
  const avgVca = sumVca / count;

  const avgIa = sumIa / count;
  const avgIb = sumIb / count;
  const avgIc = sumIc / count;
  const avgIn = sumIn / count;

  const isTri = transformer.phaseType === 'TRIFASICO';

  const overallAvgPhaseNeutralV = isTri ? (avgVan + avgVbn + avgVcn) / 3 : avgVan;
  const overallAvgPhasePhaseV = isTri ? (avgVab + avgVbc + avgVca) / 3 : (avgVab > 0 ? avgVab : avgVan * Math.sqrt(3));
  const overallAvgCurrentA = isTri ? (avgIa + avgIb + avgIc) / 3 : avgIa;

  const nominalSecV = transformer.secondaryVoltageV;
  const nominalSecNeutV = transformer.secondaryNeutralV;

  const nominalCurrentSecondaryA = calculateNominalSecondaryCurrent(transformer);
  const nominalCurrentPrimaryA = calculateNominalPrimaryCurrent(transformer);

  const maxKvaMeasured = Math.max(...validMeas.map((m) => m.totalKva), 0);
  const avgKvaMeasured = validMeas.reduce((acc, m) => acc + m.totalKva, 0) / count;

  const maxLoadingPercent = transformer.powerKva > 0 ? (maxKvaMeasured / transformer.powerKva) * 100 : 0;
  const avgLoadingPercent = transformer.powerKva > 0 ? (avgKvaMeasured / transformer.powerKva) * 100 : 0;

  let loadingCondition: 'SUB-CARREGADO' | 'IDEAL' | 'ELEVADO' | 'SOBRECARGA_MODERADA' | 'SOBRECARGA_CRITICA' = 'IDEAL';
  if (avgLoadingPercent < 45) loadingCondition = 'SUB-CARREGADO';
  else if (avgLoadingPercent <= 85) loadingCondition = 'IDEAL';
  else if (avgLoadingPercent <= 100) loadingCondition = 'ELEVADO';
  else if (avgLoadingPercent <= 120) loadingCondition = 'SOBRECARGA_MODERADA';
  else loadingCondition = 'SOBRECARGA_CRITICA';

  // Desbalanço
  const maxFdtp = Math.max(...validMeas.map((m) => m.fdtpPercent), 0);

  // PRODIST
  const prodist = evaluateProdist(overallAvgPhasePhaseV, nominalSecV, maxFdtp);

  // Análise de Bloco Curva ITIC (Janela 15 min / 3 Medições)
  const iticAnalysis = evaluateIticBlock(measurements, transformer);

  // Material dos Enrolamentos & Correção Térmica de Perdas (ABNT NBR 5356 / NBR 5440)
  const windingMaterial: 'ALUMINIO' | 'COBRE' = transformer.windingMaterial || 'ALUMINIO';
  // Constante de temperatura Tk (°C): Alumínio = 225.0 °C; Cobre = 234.5 °C
  const thermalConstantTk = windingMaterial === 'COBRE' ? 234.5 : 225.0;
  const opTempC = transformer.oilTempC && transformer.oilTempC > 0 ? transformer.oilTempC : 75;
  // Fator de correção de temperatura para perdas em carga: Kt = (Tk + T_op) / (Tk + 75°C)
  const thermalCorrectionFactorKt = (thermalConstantTk + opTempC) / (thermalConstantTk + 75);

  // Perdas calculadas
  const estimatedIronLossW = transformer.noLoadLossW;
  const currentRatio = nominalCurrentSecondaryA > 0 ? overallAvgCurrentA / nominalCurrentSecondaryA : 0;
  const estimatedCopperLossW = transformer.loadLoss75cW * Math.pow(currentRatio, 2) * thermalCorrectionFactorKt;
  const totalCalculatedLossW = estimatedIronLossW + estimatedCopperLossW;

  const pf = validMeas.length > 0 ? validMeas[0].powerFactor || 0.92 : 0.92;
  const activePowerW = avgKvaMeasured * 1000 * pf;
  const calculatedEfficiencyPercent = (activePowerW + totalCalculatedLossW) > 0
    ? (activePowerW / (activePowerW + totalCalculatedLossW)) * 100
    : transformer.efficiencyPercent;

  // Recomendação de Elo Fusível
  const recommendedFuse = findRecommendedFuse(transformer.primaryVoltageV, transformer.powerKva, transformer.phaseType);

  // Phase Specific Validation Rules & Alerts
  const phaseAlerts: DiagnosticAnalysis['phaseAlerts'] = [];
  let voltageUnbalancePercentNema = 0;
  let currentUnbalancePercent = 0;

  const phaseType = transformer.phaseType || 'TRIFASICO';

  if (phaseType === 'MONOFASICO') {
    // 1. Monofásico: Ignore phase unbalance. Calculate FP = cos(θ). Alert if FP < 0.92.
    validMeas.forEach((m) => {
      let fp = m.powerFactor;
      if (m.phaseAngleTheta !== undefined && m.phaseAngleTheta !== null) {
        fp = Math.cos((m.phaseAngleTheta * Math.PI) / 180);
      }
      if (fp > 0 && fp < 0.92) {
        const fpFormatted = fp.toFixed(2);
        if (!phaseAlerts.some(a => a.type === 'ALERTA_BAIXO_FATOR_POTENCIA')) {
          phaseAlerts.push({
            type: 'ALERTA_BAIXO_FATOR_POTENCIA',
            message: `Alerta: Baixo Fator de Potência detectado (FP = ${fpFormatted} < 0.92). Requer correção do fator de potência.`,
            severity: 'WARNING'
          });
        }
      }
    });
  } else if (phaseType === 'BIFASICO') {
    // 2. Bifásico:
    // a) Angular unbalance: diff between Phase A and Phase B (180° ± 2°, i.e. 178° to 182°)
    validMeas.forEach((m) => {
      const angleA = m.angleA !== undefined ? m.angleA : 0;
      const angleB = m.angleB !== undefined ? m.angleB : 180;
      let diffAB = Math.abs(angleB - angleA);
      while (diffAB > 360) diffAB -= 360;
      
      if (diffAB < 178 || diffAB > 182) {
        if (!phaseAlerts.some(a => a.type === 'ERRO_ANGULO_BIFASICO')) {
          phaseAlerts.push({
            type: 'ERRO_ANGULO_BIFASICO',
            message: `Erro de Ângulo Bifásico: Diferença angular entre Fase A e Fase B (${diffAB.toFixed(1)}°) está fora do limite de 180° ± 2° (178° - 182°).`,
            severity: 'CRITICAL'
          });
        }
      }
    });

    // b) Current unbalance: Deseq_I = (max_desvio / I_media) * 100 > 15%
    if (avgIa > 0 || avgIb > 0) {
      const iMedia = (avgIa + avgIb) / 2;
      if (iMedia > 0) {
        const maxDesvioI = Math.max(Math.abs(avgIa - iMedia), Math.abs(avgIb - iMedia));
        currentUnbalancePercent = (maxDesvioI / iMedia) * 100;
        if (currentUnbalancePercent > 15.0) {
          phaseAlerts.push({
            type: 'ALERTA_DESEQUILIBRIO_CORRENTE',
            message: `Alerta de Desequilíbrio de Corrente Bifásico: Desequilíbrio (${currentUnbalancePercent.toFixed(1)}%) superior ao limite de 15%.`,
            severity: 'WARNING'
          });
        }
      }
    }
  } else {
    // 3. Trifásico:
    // a) Angular unbalance: diff between phases 120° ± 1.5° (118.5° to 121.5°)
    validMeas.forEach((m) => {
      const angleA = m.angleA !== undefined ? m.angleA : 0;
      const angleB = m.angleB !== undefined ? m.angleB : 120;
      const angleC = m.angleC !== undefined ? m.angleC : 240;

      let diffAB = Math.abs(angleB - angleA);
      let diffBC = Math.abs(angleC - angleB);
      let diffCA = Math.abs((angleA + 360) - angleC);

      const isAbInvalid = diffAB < 118.5 || diffAB > 121.5;
      const isBcInvalid = diffBC < 118.5 || diffBC > 121.5;
      const isCaInvalid = diffCA < 118.5 || diffCA > 121.5;

      if (isAbInvalid || isBcInvalid || isCaInvalid) {
        if (!phaseAlerts.some(a => a.type === 'ERRO_ANGULO_TRIFASICO')) {
          phaseAlerts.push({
            type: 'ERRO_ANGULO_TRIFASICO',
            message: `Erro de Ângulo Trifásico: Deslocamento angular entre fases (${diffAB.toFixed(1)}°, ${diffBC.toFixed(1)}°, ${diffCA.toFixed(1)}°) fora do limite normativo de 120° ± 1.5° (118.5° - 121.5°).`,
            severity: 'CRITICAL'
          });
        }
      }
    });

    // b) NEMA Voltage Unbalance Formula: Deseq_V = (max_desvio_V / V_media) * 100 > 2.0%
    const vList = [avgVan, avgVbn, avgVcn].filter(v => v > 0);
    if (vList.length === 3) {
      const vMedia = (avgVan + avgVbn + avgVcn) / 3;
      if (vMedia > 0) {
        const maxDesvioV = Math.max(Math.abs(avgVan - vMedia), Math.abs(avgVbn - vMedia), Math.abs(avgVcn - vMedia));
        voltageUnbalancePercentNema = (maxDesvioV / vMedia) * 100;
        if (voltageUnbalancePercentNema > 2.0) {
          phaseAlerts.push({
            type: 'CRITICO_DESEQUILIBRIO_TENSAO_NEMA',
            message: `Crítico: Desequilíbrio de Tensão NEMA (${voltageUnbalancePercentNema.toFixed(2)}%) excede o limite máximo permitido de 2.0%.`,
            severity: 'CRITICAL'
          });
        }
      }
    }

    // c) Current Unbalance Formula: Deseq_I = (max_desvio_I / I_media) * 100 > 15.0%
    const iList = [avgIa, avgIb, avgIc].filter(i => i > 0);
    if (iList.length === 3) {
      const iMedia = (avgIa + avgIb + avgIc) / 3;
      if (iMedia > 0) {
        const maxDesvioI = Math.max(Math.abs(avgIa - iMedia), Math.abs(avgIb - iMedia), Math.abs(avgIc - iMedia));
        currentUnbalancePercent = (maxDesvioI / iMedia) * 100;
        if (currentUnbalancePercent > 15.0) {
          phaseAlerts.push({
            type: 'ALERTA_DESEQUILIBRIO_CORRENTE',
            message: `Alerta de Desequilíbrio de Corrente Trifásico: Desequilíbrio de corrente (${currentUnbalancePercent.toFixed(1)}%) excede o limite de 15.0%.`,
            severity: 'WARNING'
          });
        }
      }
    }
  }

  // Recomendação de TAP
  let recommendedTap = 'TAP 3 (Nominal - 13.8 kV)';
  let tapAdjustmentAdvice = 'Tensão secundária dentro do intervalo normal. Manter o comutador no TAP central.';

  if (overallAvgPhasePhaseV > 0 && nominalSecV > 0) {
    const vRatio = overallAvgPhasePhaseV / nominalSecV;
    if (vRatio < 0.93) {
      recommendedTap = 'TAP 4 ou TAP 5 (Reduzir espiras no primário, e.g. 13.2 kV / 12.87 kV)';
      tapAdjustmentAdvice = 'Tensão secundária baixa (Subtensão). Recomenda-se mudar para TAP mais baixo (TAP 4/5) para elevar a tensão secundária para a faixa adequada PRODIST.';
    } else if (vRatio > 1.05) {
      recommendedTap = 'TAP 1 ou TAP 2 (Aumentar espiras no primário, e.g. 14.4 kV / 14.1 kV)';
      tapAdjustmentAdvice = 'Tensão secundária elevada (Sobretensão). Recomenda-se mudar para TAP mais alto (TAP 1/2) para reduzir a tensão secundária e proteger as cargas.';
    }
  }

  return {
    avgVan: Math.round(avgVan * 10) / 10,
    avgVbn: Math.round(avgVbn * 10) / 10,
    avgVcn: Math.round(avgVcn * 10) / 10,
    avgVab: Math.round(avgVab * 10) / 10,
    avgVbc: Math.round(avgVbc * 10) / 10,
    avgVca: Math.round(avgVca * 10) / 10,
    avgIa: Math.round(avgIa * 10) / 10,
    avgIb: Math.round(avgIb * 10) / 10,
    avgIc: Math.round(avgIc * 10) / 10,
    avgIn: Math.round(avgIn * 10) / 10,
    overallAvgPhaseNeutralV: Math.round(overallAvgPhaseNeutralV * 10) / 10,
    overallAvgPhasePhaseV: Math.round(overallAvgPhasePhaseV * 10) / 10,
    overallAvgCurrentA: Math.round(overallAvgCurrentA * 10) / 10,
    nominalSecondaryPhasePhaseV: nominalSecV,
    nominalSecondaryPhaseNeutralV: nominalSecNeutV,
    nominalCurrentSecondaryA: Math.round(nominalCurrentSecondaryA * 10) / 10,
    nominalCurrentPrimaryA: Math.round(nominalCurrentPrimaryA * 100) / 100,
    maxKvaMeasured: Math.round(maxKvaMeasured * 100) / 100,
    avgKvaMeasured: Math.round(avgKvaMeasured * 100) / 100,
    maxLoadingPercent: Math.round(maxLoadingPercent * 10) / 10,
    avgLoadingPercent: Math.round(avgLoadingPercent * 10) / 10,
    loadingCondition,
    phaseTypeEvaluated: phaseType,
    voltageUnbalancePercentNema: Math.round(voltageUnbalancePercentNema * 100) / 100,
    currentUnbalancePercent: Math.round(currentUnbalancePercent * 100) / 100,
    phaseAlerts,
    prodist,
    iticAnalysis,
    estimatedCopperLossW: Math.round(estimatedCopperLossW),
    estimatedIronLossW: Math.round(estimatedIronLossW),
    totalCalculatedLossW: Math.round(totalCalculatedLossW),
    calculatedEfficiencyPercent: Math.round(calculatedEfficiencyPercent * 100) / 100,
    windingMaterial,
    oilType: transformer.oilType || 'MINERAL',
    manufacturingDate: transformer.manufacturingDate || 'N/A',
    efficiencyLevel: transformer.efficiencyLevel,
    thermalConstantTk,
    thermalCorrectionFactorKt: Math.round(thermalCorrectionFactorKt * 1000) / 1000,
    recommendedFuse,
    recommendedTap,
    tapAdjustmentAdvice
  };
}
