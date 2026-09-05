import { SingleMeasurement, TransformerSpec, DiagnosticAnalysis, ProdistStatus, FuseRecommendation, PhaseType, TransformerType, MeasurementCycleMode } from '../types';
import { classifyProdistVoltage, findFuseInOfflineDatabase, getDiagnosticRuleValue } from './sqliteAndSplitLoader';

type MeasurementField = keyof Pick<
  SingleMeasurement,
  'van' | 'vbn' | 'vcn' | 'vab' | 'vbc' | 'vca' | 'ia' | 'ib' | 'ic'
>;

const FIELD_LABELS: Record<MeasurementField, string> = {
  van: 'Van', vbn: 'Vbn', vcn: 'Vcn',
  vab: 'Vab', vbc: 'Vbc', vca: 'Vca',
  ia: 'Ia', ib: 'Ib', ic: 'Ic'
};

export function getMissingMeasurementFields(
  measurement: SingleMeasurement,
  transformer: TransformerSpec
): string[] {
  const voltageFields: MeasurementField[] = transformer.phaseType === 'TRIFASICO'
    ? ['van', 'vbn', 'vcn', 'vab', 'vbc', 'vca']
    : ['van', 'vbn', 'vab'];
  const currentFields: MeasurementField[] = transformer.phaseType === 'TRIFASICO'
    ? ['ia', 'ib', 'ic']
    : ['ia', 'ib'];

  const missingVoltages = voltageFields
    .filter((field) => !Number.isFinite(measurement[field]) || Number(measurement[field]) <= 0)
    .map((field) => FIELD_LABELS[field]);

  const missingCurrents = currentFields
    .filter((field) => !Number.isFinite(measurement[field]) || Number(measurement[field]) < 0)
    .map((field) => FIELD_LABELS[field]);

  return [...missingVoltages, ...missingCurrents];
}

export function isMeasurementComplete(
  measurement: SingleMeasurement,
  transformer: TransformerSpec
): boolean {
  return getMissingMeasurementFields(measurement, transformer).length === 0;
}

function isMeasurementReady(measurement: SingleMeasurement, transformer: TransformerSpec): boolean {
  return measurement.isRecorded === true && isMeasurementComplete(measurement, transformer);
}

function hasValidTransformerIdentity(transformer: TransformerSpec): boolean {
  return Boolean(
    (transformer.id || transformer.powerKva > 0) &&
    transformer.powerKva > 0 &&
    transformer.primaryVoltageV > 0 &&
    transformer.secondaryVoltageV > 0 &&
    transformer.impedancePercent > 0
  );
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
    const values = [meas.van, meas.vbn, meas.vcn];
    avgVfn = values.every((value) => value > 0)
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
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
    const values = [meas.vab, meas.vbc, meas.vca];
    avgVff = values.every((value) => value > 0)
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
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
    const values = [meas.ia, meas.ib, meas.ic];
    avgI = values.every((value) => value > 0)
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  } else {
    if (meas.ia > 0 && meas.ib > 0) {
      avgI = (meas.ia + meas.ib) / 2;
    } else {
      avgI = meas.ia > 0 ? meas.ia : meas.ib;
    }
  }

  // Corrente nominal secundária (A)
  const nominalSecCurrent = calculateNominalSecondaryCurrent(transformer);

  // Carregamento por fase e identificação da fase de pico
  let loadingPercentA = 0;
  let loadingPercentB = 0;
  let loadingPercentC = 0;
  let maxPhaseLoadingPercent = 0;
  let criticalPhase: 'A' | 'B' | 'C' | 'EQUILIBRADO' = 'EQUILIBRADO';

  if (nominalSecCurrent > 0) {
    loadingPercentA = Math.round((meas.ia / nominalSecCurrent) * 1000) / 10;
    loadingPercentB = Math.round((meas.ib / nominalSecCurrent) * 1000) / 10;
    if (isTri) {
      loadingPercentC = Math.round((meas.ic / nominalSecCurrent) * 1000) / 10;
      const maxI = Math.max(meas.ia, meas.ib, meas.ic);
      maxPhaseLoadingPercent = Math.round((maxI / nominalSecCurrent) * 1000) / 10;
      if (meas.ic === maxI && (meas.ic > meas.ia || meas.ic > meas.ib)) criticalPhase = 'C';
      else if (meas.ib === maxI && (meas.ib > meas.ia || meas.ib > meas.ic)) criticalPhase = 'B';
      else if (meas.ia === maxI && (meas.ia > meas.ib || meas.ia > meas.ic)) criticalPhase = 'A';
    } else {
      const maxI = Math.max(meas.ia, meas.ib);
      maxPhaseLoadingPercent = Math.round((maxI / nominalSecCurrent) * 1000) / 10;
      if (meas.ia > meas.ib) criticalPhase = 'A';
      else if (meas.ib > meas.ia) criticalPhase = 'B';
    }
  }

  // Potência aparente em kVA: soma das potências por fase se tensões FN e correntes estiverem presentes (IEEE Std 1459)
  let totalKva = 0;
  if (isTri) {
    if (meas.van > 0 && meas.vbn > 0 && meas.vcn > 0 && (meas.ia > 0 || meas.ib > 0 || meas.ic > 0)) {
      totalKva = (meas.van * meas.ia + meas.vbn * meas.ib + meas.vcn * meas.ic) / 1000;
    } else {
      totalKva = (Math.sqrt(3) * avgVff * avgI) / 1000;
    }
  } else {
    if (meas.van > 0 && meas.vbn > 0 && (meas.ia > 0 || meas.ib > 0)) {
      totalKva = (meas.van * meas.ia + meas.vbn * meas.ib) / 1000;
    } else {
      totalKva = (avgVff * avgI) / 1000;
    }
  }

  // Carregamento global do banco (% da potência nominal)
  const loadingPercent = transformer.powerKva > 0
    ? (totalKva / transformer.powerKva) * 100
    : 0;

  // Fator de desbalanço de tensão FDTP (%)
  let fdtpPercent = 0;
  if (isTri && meas.vab > 0 && meas.vbc > 0 && meas.vca > 0) {
    const vab2 = meas.vab ** 2;
    const vbc2 = meas.vbc ** 2;
    const vca2 = meas.vca ** 2;
    const denominator = (vab2 + vbc2 + vca2) ** 2;
    if (denominator > 0) {
      const beta = (vab2 ** 2 + vbc2 ** 2 + vca2 ** 2) / denominator;
      const innerRoot = Math.sqrt(Math.max(0, 3 - 6 * beta));
      const ratioDenominator = 1 + innerRoot;
      if (ratioDenominator > 0) {
        fdtpPercent = 100 * Math.sqrt(Math.max(0, (1 - innerRoot) / ratioDenominator));
      }
    }
  }

  return {
    ...meas,
    avgVoltagePhaseNeutral: Math.round(avgVfn * 10) / 10,
    avgVoltagePhasePhase: Math.round(avgVff * 10) / 10,
    avgCurrent: Math.round(avgI * 10) / 10,
    totalKva: Math.round(totalKva * 100) / 100,
    loadingPercent: Math.round(loadingPercent * 10) / 10,
    loadingPercentA,
    loadingPercentB,
    loadingPercentC,
    maxPhaseLoadingPercent,
    criticalPhase,
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
      voltageStatus: 'A MEDIR',
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
  const databaseClassification = classifyProdistVoltage(measuredV, nominalV, 'FF');

  let voltageStatus: 'ADEQUADA' | 'PRECARIA' | 'CRITICA' = 'ADEQUADA';
  let text = 'Faixa de Tensão Adequada (PRODIST Mód. 8)';

  if (databaseClassification) {
    voltageStatus = databaseClassification.status;
    const range = databaseClassification.range;
    text = `Faixa ${voltageStatus} - PRODIST (${range.adequateMinV} a ${range.adequateMaxV} V adequada; sistema ${range.system}).`;
  } else if (ratio >= 0.93 && ratio <= 1.05) {
    voltageStatus = 'ADEQUADA';
    text = `Faixa ADEQUADA (${Math.round(ratio * 100)}% da nominal). Atende requisitos ANEEL.`;
  } else if ((ratio >= 0.90 && ratio < 0.93) || (ratio > 1.05 && ratio <= 1.07)) {
    voltageStatus = 'PRECARIA';
    text = `Faixa PRECÁRIA (${Math.round(ratio * 100)}% da nominal). Requer ajuste de TAP ou reconfiguração de rede.`;
  } else {
    voltageStatus = 'CRITICA';
    text = `Faixa CRÍTICA (${Math.round(ratio * 100)}% da nominal). Sujeito a ressarcimento e risco a equipamentos.`;
  }

  const fdLimit = getDiagnosticRuleValue('prodist_fd_limit_bt_percent', 3.0);
  const unbalanceStatus: 'ADEQUADO' | 'PRECARIO' | 'CRITICO' =
    fdtpPercent <= fdLimit ? 'ADEQUADO' : 'CRITICO';

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
  phaseType: PhaseType = 'TRIFASICO',
  oilType: 'MINERAL' | 'VEGETAL' = 'MINERAL'
): FuseRecommendation | null {
  if (!primaryVoltageV || !powerKva) return null;
  return findFuseInOfflineDatabase(primaryVoltageV, powerKva, phaseType, oilType);
}

function timestampToSeconds(timestamp: string): number | null {
  const match = timestamp.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
}

function validateMeasurementData(
  measurements: SingleMeasurement[],
  transformer: TransformerSpec,
  cycleMode: MeasurementCycleMode
): DiagnosticAnalysis['dataQuality'] {
  const issues: DiagnosticAnalysis['dataQuality']['issues'] = [];
  if (!hasValidTransformerIdentity(transformer)) {
    issues.push({
      code: 'TRANSFORMADOR_INCOMPLETO',
      severity: 'CRITICAL',
      title: 'Dados do transformador incompletos',
      message: 'Selecione ou preencha um transformador com identificacao, potencia, tensoes e impedancia validas.'
    });
  }

  measurements.forEach((measurement) => {
    // Only check missing fields if measurement was marked recorded or has values entered
    const hasData = measurement.isRecorded === true || measurement.van > 0 || measurement.vab > 0;
    if (hasData) {
      const missing = getMissingMeasurementFields(measurement, transformer);
      if (missing.length > 0) {
        issues.push({
          measurementId: measurement.id,
          code: 'MEDICAO_INCOMPLETA',
          severity: 'WARNING',
          title: `M${measurement.id}: campos pendentes`,
          message: `Preencha os campos: ${missing.join(', ')}.`
        });
      }
    }
  });

  const valid = measurements.filter((m) => isMeasurementReady(m, transformer));
  if (valid.length === 0) {
    issues.push({
      code: 'MEDICOES_INSUFICIENTES',
      severity: 'CRITICAL',
      title: 'Nenhuma medição completa',
      message: 'Preencha e registre pelo menos 1 medição para gerar o laudo.'
    });
  } else if (valid.length === 2) {
    issues.push({
      code: 'CAMPANHA_PARCIAL',
      severity: 'WARNING',
      title: 'Campanha com 2 medições',
      message: 'Foram registradas 2 de 3 medições do ciclo temporizado. Laudo gerado com a média das medições disponíveis.'
    });
  }
  // Obs: se valid.length === 1, a medição é validada como Medição Instantânea (após 10 min do fechamento do trafo), plenamente conforme.

  const fdLimit = getDiagnosticRuleValue('prodist_fd_limit_bt_percent', 3.0);
  const currentLimit = getDiagnosticRuleValue('current_unbalance_limit_percent', 15.0);

  valid.forEach((m) => {
    if (transformer.phaseType === 'TRIFASICO') {
      const ff = [m.vab, m.vbc, m.vca];
      const fn = [m.van, m.vbn, m.vcn];
      const ffLabels = ['Vab', 'Vbc', 'Vca'];
      const fnLabels = ['Van', 'Vbn', 'Vcn'];
      const ffOut = ff.map((value, index) => ({ label: ffLabels[index], value, result: classifyProdistVoltage(value, transformer.secondaryVoltageV, 'FF') }))
        .filter((item) => item.value > 0 && item.result?.status !== 'ADEQUADA');
      const fnOut = fn.map((value, index) => ({ label: fnLabels[index], value, result: classifyProdistVoltage(value, transformer.secondaryNeutralV, 'FN') }))
        .filter((item) => item.value > 0 && item.result?.status !== 'ADEQUADA');
      if (ffOut.length || fnOut.length) {
        const details = [...ffOut, ...fnOut].map((item) => `${item.label}=${item.value} V (${item.result?.status})`).join('; ');
        const critical = [...ffOut, ...fnOut].some((item) => item.result?.status === 'CRITICA');
        issues.push({
          measurementId: m.id,
          code: 'TENSAO_PRODIST',
          severity: critical ? 'CRITICAL' : 'WARNING',
          title: `M${m.id}: tensão fora da faixa adequada`,
          message: details
        });
      }

      if (fn.every((value) => value > 0) && ff.every((value) => value > 0)) {
        const pairs: Array<[number, number, number, string]> = [
          [m.van, m.vbn, m.vab, 'Van/Vbn/Vab'],
          [m.vbn, m.vcn, m.vbc, 'Vbn/Vcn/Vbc'],
          [m.vcn, m.van, m.vca, 'Vcn/Van/Vca']
        ];
        const impossible = pairs.filter(([v1, v2, line]) => line > (v1 + v2) * 1.02 || line < Math.abs(v1 - v2) * 0.98);
        const avgFn = fn.reduce((sum, value) => sum + value, 0) / 3;
        const avgFf = ff.reduce((sum, value) => sum + value, 0) / 3;
        const expectedFf = Math.sqrt(3) * avgFn;
        const ratioError = expectedFf > 0 ? Math.abs(avgFf - expectedFf) / expectedFf : 0;
        if (impossible.length > 0 || ratioError > 0.15) {
          const pairText = impossible.length > 0 ? `; combinação impossível: ${impossible.map((pair) => pair[3]).join(', ')}` : '';
          issues.push({
            measurementId: m.id,
            code: 'RELACAO_TENSAO',
            severity: 'CRITICAL',
            title: `M${m.id}: relação F-N/F-F inconsistente`,
            message: `Média F-N ${avgFn.toFixed(1)} V implica aproximadamente ${expectedFf.toFixed(1)} V F-F em sistema trifásico equilibrado, mas foi informado ${avgFf.toFixed(1)} V${pairText}. Verifique escala, ligação e instrumento.`
          });
        } else if (ratioError > 0.05) {
          issues.push({
            measurementId: m.id,
            code: 'RELACAO_TENSAO',
            severity: 'WARNING',
            title: `M${m.id}: divergência moderada F-N/F-F`,
            message: `Média F-N ${avgFn.toFixed(1)} V vs F-F ${avgFf.toFixed(1)} V (diferença de ${(ratioError * 100).toFixed(1)}%). Recomenda-se conferir medição no secundário.`
          });
        }
      }

      if (m.fdtpPercent > fdLimit) {
        issues.push({
          measurementId: m.id,
          code: 'FDTP',
          severity: 'CRITICAL',
          title: `M${m.id}: desbalanço de tensão crítico`,
          message: `FDTP ${m.fdtpPercent.toFixed(2)}% excede o limite BT de ${fdLimit.toFixed(1)}%.`
        });
      }

      const currents = [m.ia, m.ib, m.ic];
      if (currents.every((value) => value >= 0) && currents.some((value) => value > 0)) {
        const avg = currents.reduce((sum, value) => sum + value, 0) / 3;
        const unbalance = avg > 0 ? Math.max(...currents.map((value) => Math.abs(value - avg))) / avg * 100 : 0;
        if (unbalance > currentLimit) {
          const isExtreme = unbalance > 90;
          issues.push({
            measurementId: m.id,
            code: 'DESEQUILIBRIO_CORRENTE',
            severity: isExtreme ? 'CRITICAL' : 'WARNING',
            title: `M${m.id}: ${isExtreme ? 'desbalanceamento extremo de corrente' : 'desequilíbrio de carga na rede BT'}`,
            message: `Ia=${m.ia} A, Ib=${m.ib} A, Ic=${m.ic} A; desvio ${unbalance.toFixed(1)}% (limiar: ${currentLimit.toFixed(0)}%). Recomenda-se remanejamento de carga entre as fases na rede secundária (NDU 006 / NDU 007).`
          });
        }

        if ((m.in || 0) > 0) {
          const expectedNeutral = Math.sqrt(Math.max(0, m.ia ** 2 + m.ib ** 2 + m.ic ** 2 - m.ia * m.ib - m.ib * m.ic - m.ic * m.ia));
          const neutralTolerance = Math.max(5, expectedNeutral * 0.25);
          if (Math.abs((m.in || 0) - expectedNeutral) > neutralTolerance) {
            issues.push({
              measurementId: m.id,
              code: 'CORRENTE_NEUTRO',
              severity: 'WARNING',
              title: `M${m.id}: corrente de neutro requer conferência`,
              message: `In informado ${(m.in || 0).toFixed(1)} A; estimativa fasorial a 120° ${expectedNeutral.toFixed(1)} A. Conferir ângulos, harmônicos, pinça e ponto de medição.`
            });
          }
        }
      }
    }

    const peakLoading = m.maxPhaseLoadingPercent || m.loadingPercent;
    if (peakLoading > 100) {
      issues.push({
        measurementId: m.id,
        code: 'CARREGAMENTO',
        severity: 'WARNING',
        title: `M${m.id}: sobrecarga ${m.criticalPhase && m.criticalPhase !== 'EQUILIBRADO' ? `na Fase ${m.criticalPhase}` : ''} (${peakLoading.toFixed(1)}%)`,
        message: `Corrente de pico ${peakLoading.toFixed(1)}% da capacidade nominal contínua do enrolamento. Risco de atuação de elo fusível e perda de vida útil (NBR 5356-7 / NDU 006).`
      });
    }
  });

  const times = valid.map((m) => ({ id: m.id, seconds: timestampToSeconds(m.timestamp) })).filter((item): item is { id: number; seconds: number } => item.seconds !== null);
  const expectedSeconds = cycleMode === '5s' ? 5 : 600;
  const tolerance = cycleMode === '5s' ? 2 : expectedSeconds * 0.2;
  for (let index = 1; index < times.length; index += 1) {
    let elapsed = times[index].seconds - times[index - 1].seconds;
    if (elapsed < -43200) elapsed += 86400; // virada legítima de meia-noite
    if (elapsed < 0) {
      issues.push({ code: 'CRONOLOGIA', severity: 'CRITICAL', title: 'Ordem temporal invertida', message: `M${times[index].id} (${measurements.find((m) => m.id === times[index].id)?.timestamp}) é anterior à medição anterior.` });
    } else if (elapsed === 0) {
      issues.push({ code: 'CRONOLOGIA_COINCIDENTE', severity: 'WARNING', title: 'Horários coincidentes', message: `M${times[index - 1].id} e M${times[index].id} possuem o mesmo horário gravado. Recomenda-se registrar os horários distintos de cada medição.` });
    } else if (elapsed < expectedSeconds - tolerance) {
      issues.push({ code: 'INTERVALO', severity: 'WARNING', title: 'Intervalo menor que o ciclo selecionado', message: `Intervalo M${times[index - 1].id}→M${times[index].id}: ${elapsed} s; mínimo esperado ${expectedSeconds} s para o ciclo ${cycleMode}.` });
    }
  }

  const hasCritical = issues.some((issue) => issue.severity === 'CRITICAL');
  const hasFatalMeasurementError = issues.some((issue) =>
    issue.severity === 'CRITICAL' && issue.code !== 'DESEQUILIBRIO_CORRENTE'
  );
  const hasTrafo = hasValidTransformerIdentity(transformer);
  const canIssueTap = !hasFatalMeasurementError && valid.length >= 1 && hasTrafo;
  const canIssueReport = valid.length >= 1 && hasTrafo;
  return {
    status: hasCritical ? 'INCONSISTENTE' : issues.length > 0 ? 'ALERTA' : 'VALIDO',
    isInstantaneous: valid.length === 1,
    validMeasurementsCount: valid.length,
    issues,
    canIssueTapRecommendation: canIssueTap,
    canIssueReport: canIssueReport
  };
}

/**
 * Executa análise completa das 3 medições
 */
function buildTapRecommendation(
  transformer: TransformerSpec,
  measuredSecondaryV: number,
  dataQuality: DiagnosticAnalysis['dataQuality']
): Pick<DiagnosticAnalysis, 'recommendedTap' | 'tapAdjustmentAdvice'> {
  if (!dataQuality.canIssueTapRecommendation) {
    return {
      recommendedTap: 'RECOMENDACAO DE TAP BLOQUEADA',
      tapAdjustmentAdvice: 'Corrija as inconsistencias criticas detectadas nos dados antes de alterar o TAP.'
    };
  }

  // Obter tensões de TAP do transformador ou calcular padrão (+5%, +2.5%, Nominal, -2.5%, -5%)
  let tapVoltages = transformer.tapVoltages;
  if (!tapVoltages || Object.keys(tapVoltages).length === 0) {
    const primV = transformer.primaryVoltageV || 13800;
    tapVoltages = {
      1: Math.round(primV * 1.05),
      2: Math.round(primV * 1.025),
      3: Math.round(primV),
      4: Math.round(primV * 0.975),
      5: Math.round(primV * 0.95)
    };
  }

  const entries = Object.entries(tapVoltages)
    .map(([position, voltage]) => ({ position: Number(position), voltage: Number(voltage) }))
    .filter((entry) => Number.isInteger(entry.position) && entry.position > 0 && Number.isFinite(entry.voltage) && entry.voltage > 0)
    .sort((a, b) => a.position - b.position);

  const activeIndex = transformer.activeTapIndex && entries.some(e => e.position === transformer.activeTapIndex)
    ? transformer.activeTapIndex
    : entries.length >= 3 ? Math.ceil(entries.length / 2) : (entries[0]?.position || 1);

  const active = entries.find((entry) => entry.position === activeIndex);
  if (!active || measuredSecondaryV <= 0 || transformer.secondaryVoltageV <= 0) {
    return {
      recommendedTap: 'RECOMENDACAO DE TAP BLOQUEADA',
      tapAdjustmentAdvice: 'Informe as tensoes de todas as posicoes e marque o TAP atualmente em operacao.'
    };
  }

  const severity = { ADEQUADA: 0, PRECARIA: 1, CRITICA: 2 } as const;
  const candidates = entries.map((entry) => {
    const predictedVoltage = measuredSecondaryV * active.voltage / entry.voltage;
    const classification = classifyProdistVoltage(predictedVoltage, transformer.secondaryVoltageV, 'FF');
    const ratio = predictedVoltage / transformer.secondaryVoltageV;
    const status: 'ADEQUADA' | 'PRECARIA' | 'CRITICA' = classification?.status || (
      ratio >= 0.93 && ratio <= 1.05 ? 'ADEQUADA' : 'CRITICA'
    );
    return {
      ...entry,
      predictedVoltage,
      status,
      error: Math.abs(predictedVoltage - transformer.secondaryVoltageV)
    };
  }).sort((a, b) => severity[a.status] - severity[b.status] || a.error - b.error || a.position - b.position);

  const best = candidates[0];
  const tapLabel = `TAP ${best.position} (${(best.voltage / 1000).toFixed(3)} kV)`;
  if (best.position === active.position) {
    return {
      recommendedTap: `MANTER ${tapLabel}`,
      tapAdjustmentAdvice: `O TAP ativo e a melhor posicao cadastrada. Tensao secundaria prevista: ${best.predictedVoltage.toFixed(1)} V (${best.status}).`
    };
  }
  return {
    recommendedTap: tapLabel,
    tapAdjustmentAdvice: `Comutar do TAP ${active.position} (${(active.voltage / 1000).toFixed(3)} kV) para o TAP ${best.position}. Tensao secundaria estimada apos a comutacao: ${best.predictedVoltage.toFixed(1)} V (${best.status}). Confirmar procedimento, desenergizacao e regras de seguranca antes da intervencao.`
  };
}


export function performFullDiagnosticAnalysis(
  measurements: SingleMeasurement[],
  transformer: TransformerSpec,
  cycleMode: MeasurementCycleMode = '10m'
): DiagnosticAnalysis {
  const validMeas = measurements.filter((m) => isMeasurementReady(m, transformer));
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

  // Carregamento de pico de fase (enrolamento mais solicitado):
  const maxPhaseLoadingPercent = Math.max(
    ...validMeas.map((m) => m.maxPhaseLoadingPercent || 0),
    maxLoadingPercent
  );

  // Identificação da fase crítica:
  const criticalPhase: 'A' | 'B' | 'C' | 'EQUILIBRADO' = validMeas.length > 0 && validMeas[0].criticalPhase
    ? validMeas[0].criticalPhase
    : 'EQUILIBRADO';

  const loadingPercentA = nominalCurrentSecondaryA > 0 ? (avgIa / nominalCurrentSecondaryA) * 100 : 0;
  const loadingPercentB = nominalCurrentSecondaryA > 0 ? (avgIb / nominalCurrentSecondaryA) * 100 : 0;
  const loadingPercentC = isTri && nominalCurrentSecondaryA > 0 ? (avgIc / nominalCurrentSecondaryA) * 100 : 0;

  // A condição de carregamento é ditada pela fase mais carregada (NBR 5356-7 / NDU 006):
  const peakEvaluationLoading = Math.max(maxPhaseLoadingPercent, maxLoadingPercent);
  let loadingCondition: 'SUB-CARREGADO' | 'IDEAL' | 'ELEVADO' | 'SOBRECARGA_MODERADA' | 'SOBRECARGA_CRITICA' = 'IDEAL';
  if (peakEvaluationLoading < 45) loadingCondition = 'SUB-CARREGADO';
  else if (peakEvaluationLoading <= 85) loadingCondition = 'IDEAL';
  else if (peakEvaluationLoading <= 100) loadingCondition = 'ELEVADO';
  else if (peakEvaluationLoading <= 120) loadingCondition = 'SOBRECARGA_MODERADA';
  else loadingCondition = 'SOBRECARGA_CRITICA';

  // Desbalanço
  const maxFdtp = Math.max(...validMeas.map((m) => m.fdtpPercent), 0);

  // PRODIST
  let prodist = evaluateProdist(overallAvgPhasePhaseV, nominalSecV, maxFdtp);

  // Material dos Enrolamentos & Correção Térmica de Perdas (ABNT NBR 5356 / NBR 5440)
  const windingMaterial: 'ALUMINIO' | 'COBRE' = transformer.windingMaterial || 'ALUMINIO';
  // Constante de temperatura Tk (°C): Alumínio = 225.0 °C; Cobre = 234.5 °C
  const thermalConstantTk = windingMaterial === 'COBRE' ? 234.5 : 225.0;
  const opTempC = transformer.oilTempC && transformer.oilTempC > 0 ? transformer.oilTempC : 75;
  // Fator de correção de temperatura para perdas em carga: Kt = (Tk + T_op) / (Tk + 75°C)
  const thermalCorrectionFactorKt = (thermalConstantTk + opTempC) / (thermalConstantTk + 75);

  // Perdas calculadas considerando a média quadrática das correntes de fase (Joule I²R):
  const estimatedIronLossW = transformer.noLoadLossW;
  const currentRatioSquared = isTri
    ? (Math.pow(avgIa, 2) + Math.pow(avgIb, 2) + Math.pow(avgIc, 2)) / (3 * Math.pow(nominalCurrentSecondaryA || 1, 2))
    : (Math.pow(avgIa, 2) + Math.pow(avgIb, 2)) / (2 * Math.pow(nominalCurrentSecondaryA || 1, 2));

  const estimatedCopperLossW = transformer.loadLoss75cW * currentRatioSquared * thermalCorrectionFactorKt;
  const totalCalculatedLossW = estimatedIronLossW + estimatedCopperLossW;

  const pf = validMeas.length > 0 ? validMeas[0].powerFactor || 0.92 : 0.92;
  const activePowerW = avgKvaMeasured * 1000 * pf;
  const calculatedEfficiencyPercent = (activePowerW + totalCalculatedLossW) > 0
    ? (activePowerW / (activePowerW + totalCalculatedLossW)) * 100
    : transformer.efficiencyPercent;

  // Recomendação de Elo Fusível
  const recommendedFuse = findRecommendedFuse(
    transformer.primaryVoltageV,
    transformer.powerKva,
    transformer.phaseType,
    transformer.oilType || 'MINERAL'
  );

  const dataQuality = validateMeasurementData(measurements, transformer, cycleMode);

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
            message: `Alerta: Baixo Fator de Potência detectado (FP = ${fpFormatted} < 0.92). Requer intervenção para correção de reativos.`,
            severity: 'WARNING'
          });
        }
      }
    });
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

  const { recommendedTap, tapAdjustmentAdvice } = buildTapRecommendation(
    transformer,
    overallAvgPhasePhaseV,
    dataQuality
  );

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
    maxPhaseLoadingPercent: Math.round(maxPhaseLoadingPercent * 10) / 10,
    criticalPhase,
    loadingPercentA: Math.round(loadingPercentA * 10) / 10,
    loadingPercentB: Math.round(loadingPercentB * 10) / 10,
    loadingPercentC: Math.round(loadingPercentC * 10) / 10,
    loadingCondition,
    phaseTypeEvaluated: phaseType,
    voltageUnbalancePercentNema: Math.round(voltageUnbalancePercentNema * 100) / 100,
    currentUnbalancePercent: Math.round(currentUnbalancePercent * 100) / 100,
    phaseAlerts,
    cycleMode,
    dataQuality,
    prodist,
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
