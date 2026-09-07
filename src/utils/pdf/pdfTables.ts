import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DiagnosticAnalysis, TransformerSpec, SingleMeasurement, MeasurementCycleMode } from '../../types';
import { getDiagnosticRuleValue, getOfflineProdistVoltageRanges } from '../sqliteAndSplitLoader';
import { PDF_PAGE_MARGIN } from './types';

export function renderExecutiveSummaryTable(
  doc: jsPDF,
  startY: number,
  analysis: DiagnosticAnalysis,
  transformer: TransformerSpec
): number {
  const margin = PDF_PAGE_MARGIN;
  const fdLimit = getDiagnosticRuleValue('prodist_fd_limit_bt_percent', 3.0);
  const voltageRange = getOfflineProdistVoltageRanges().find(
    (range) => range.connection === 'FF' && Math.abs(range.nominalV - transformer.secondaryVoltageV) < 0.01
  );

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head: [['Parâmetro Avaliado', 'Valor Medido / Calculado', 'Critério / Norma', 'Status Diagnóstico']],
    body: [
      [
        'Qualidade de Tensão (PRODIST Mód 8)',
        `${analysis.overallAvgPhasePhaseV} V (Méd. Secundária)`,
        voltageRange ? `${voltageRange.adequateMinV} a ${voltageRange.adequateMaxV} V (adequada)` : 'Faixa nominal não encontrada',
        analysis.prodist.voltageStatus
      ],
      [
        'Desbalanço de Tensão (FDTP %)',
        `${analysis.prodist.fdtpPercent}%`,
        `FDTP <= ${fdLimit.toFixed(1)}% (BT)`,
        analysis.prodist.unbalanceStatus
      ],
      [
        'Carregamento Máximo (% Corrente Nominal / kVA)',
        analysis.criticalPhase && analysis.criticalPhase !== 'EQUILIBRADO'
          ? `Pico ${analysis.maxPhaseLoadingPercent}% (Fase ${analysis.criticalPhase}) | Média ${analysis.avgLoadingPercent}% (${analysis.maxKvaMeasured} kVA)`
          : `Pico ${analysis.maxPhaseLoadingPercent || analysis.maxLoadingPercent}% (Trifásico) | Média ${analysis.avgLoadingPercent}% (${analysis.maxKvaMeasured} kVA)`,
        `Corrente Nominal = ${analysis.nominalCurrentSecondaryA} A | NDU 006 / NBR 5356-7`,
        analysis.loadingCondition.replace('_', ' ')
      ],
      [
        'Elo Fusível Primário Recomendado',
        analysis.recommendedFuse ? `Elo ${analysis.recommendedFuse.fuseCode}` : 'Não encontrado',
        analysis.recommendedFuse ? `${analysis.recommendedFuse.sourceDocument} - ${analysis.recommendedFuse.sourceTable}` : 'Sem correspondência exata',
        analysis.recommendedFuse ? 'Tabela 16' : 'VERIFICAR'
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const val = data.cell.raw?.toString() || '';
        if (val === 'ADEQUADA' || val === 'ADEQUADO' || val === 'IDEAL' || val === 'Coordenado' || val === 'Manter TAP' || val.includes('VÁLIDO')) {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'PRECARIA' || val === 'PRECARIO' || val === 'ELEVADO' || val === 'Requer Ajuste') {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'CRITICA' || val === 'CRITICO' || val === 'INCONSISTENTE' || val === 'BLOQUEADO' || val.includes('SOBRECARGA')) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  return (doc as any).lastAutoTable?.finalY || startY + 40;
}

export function renderMeasurementsTable(
  doc: jsPDF,
  startY: number,
  activeMeas: SingleMeasurement[],
  analysis: DiagnosticAnalysis,
  transformer: TransformerSpec,
  cycleMode: MeasurementCycleMode
): number {
  const margin = PDF_PAGE_MARGIN;
  const isTri = transformer.phaseType === 'TRIFASICO';

  const measurementOffset = (id: number) => {
    if (cycleMode === '1s') return `${id} s`;
    if (cycleMode === '5s') return `${(id - 1) * 5} s`;
    if (cycleMode === '5m') return `${id * 5} min`;
    if (id === 1) return '10 min pós-fechamento';
    if (id === 2) return '20 min';
    if (id === 3) return '30 min';
    return `${id * 10} min`;
  };

  const rowsMeas = activeMeas.map((m) => [
    `M${m.id} (T=${measurementOffset(m.id)})`,
    m.timestamp || 'Medição Inicial',
    isTri ? `${m.van} / ${m.vbn} / ${m.vcn} V` : `${m.van} / ${m.vbn} V`,
    isTri ? `${m.vab} / ${m.vbc} / ${m.vca} V` : `${m.vab} V`,
    isTri ? `${m.ia} / ${m.ib} / ${m.ic} A\n(In: ${m.in || 0} A)` : `${m.ia} / ${m.ib} A\n(In: ${m.in || 0} A)`,
    `${m.totalKva} kVA`,
    m.criticalPhase ? `${m.maxPhaseLoadingPercent}%\n(${m.criticalPhase})` : `${m.loadingPercent}%`,
    `${m.fdtpPercent}%`
  ]);

  if (activeMeas.length > 1) {
    rowsMeas.push([
      `MÉDIA DAS ETAPAS (${activeMeas.length} MEDIÇÕES)`,
      'Média Geral',
      isTri ? `${analysis.avgVan} / ${analysis.avgVbn} / ${analysis.avgVcn} V` : `${analysis.avgVan} / ${analysis.avgVbn} V`,
      isTri ? `${analysis.avgVab} / ${analysis.avgVbc} / ${analysis.avgVca} V` : `${analysis.avgVab} V`,
      isTri ? `${analysis.avgIa} / ${analysis.avgIb} / ${analysis.avgIc} A\n(In: ${analysis.avgIn || 0} A)` : `${analysis.avgIa} / ${analysis.avgIb} A\n(In: ${analysis.avgIn || 0} A)`,
      `${analysis.avgKvaMeasured} kVA`,
      analysis.criticalPhase ? `${analysis.maxPhaseLoadingPercent}%\n(${analysis.criticalPhase})` : `${analysis.avgLoadingPercent}%`,
      `${analysis.prodist.fdtpPercent}%`
    ]);
  } else {
    rowsMeas.push([
      'CONSOLIDADO',
      'Única',
      isTri ? `${analysis.avgVan} / ${analysis.avgVbn} / ${analysis.avgVcn} V` : `${analysis.avgVan} / ${analysis.avgVbn} V`,
      isTri ? `${analysis.avgVab} / ${analysis.avgVbc} / ${analysis.avgVca} V` : `${analysis.avgVab} V`,
      isTri ? `${analysis.avgIa} / ${analysis.avgIb} / ${analysis.avgIc} A\n(In: ${analysis.avgIn || 0} A)` : `${analysis.avgIa} / ${analysis.avgIb} A\n(In: ${analysis.avgIn || 0} A)`,
      `${analysis.avgKvaMeasured} kVA`,
      analysis.criticalPhase ? `${analysis.maxPhaseLoadingPercent}%\n(${analysis.criticalPhase})` : `${analysis.avgLoadingPercent}%`,
      `${analysis.prodist.fdtpPercent}%`
    ]);
  }

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head: [['Etapa', 'Horário', 'Tensão F-N (V)', 'Tensão F-F (V)', 'Correntes (A) / In', 'Potência', 'Carreg. Pico', 'FDTP']],
    body: rowsMeas,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 7.2,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle'
    },
    bodyStyles: {
      fontSize: 6.8,
      textColor: [30, 41, 59],
      cellPadding: 1.5,
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 23, fontStyle: 'bold' },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 28, halign: 'center' },
      3: { cellWidth: 28, halign: 'center' },
      4: { cellWidth: 38, halign: 'center' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 14, halign: 'center' }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === rowsMeas.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [226, 232, 240];
      }
    }
  });

  return (doc as any).lastAutoTable?.finalY || startY + 50;
}
