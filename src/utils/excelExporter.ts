import * as XLSX from 'xlsx';
import { InitialDiagnosticData, TransformerSpec, SingleMeasurement, DiagnosticAnalysis } from '../types';
import { getDiagnosticRuleValue, getOfflineProdistVoltageRanges } from './sqliteAndSplitLoader';

interface ExcelExportOptions {
  initialData: InitialDiagnosticData;
  transformer: TransformerSpec;
  measurements: SingleMeasurement[];
  analysis: DiagnosticAnalysis;
}

export function exportDiagnosticToExcel({
  initialData,
  transformer,
  measurements,
  analysis
}: ExcelExportOptions) {
  const wb = XLSX.utils.book_new();
  const fdLimit = getDiagnosticRuleValue('prodist_fd_limit_bt_percent', 3);
  const range = getOfflineProdistVoltageRanges().find((item) => item.connection === 'FF' && Math.abs(item.nominalV - transformer.secondaryVoltageV) < 0.01);

  // Sheet 1: Diagnostico_e_Trafo
  const sheet1Data = [
    ['LAUDO TÉCNICO DE DIAGNÓSTICO DE TRANSFORMADOR', ''],
    ['Data e Hora do Diagnóstico', initialData.dateTime || new Date().toLocaleString()],
    ['Técnico Responsável', initialData.technicianName || 'N/A'],
    ['CREA / CFT', initialData.technicianCreaCft || 'N/A'],
    ['Concessionária de Energia', initialData.concessionaria || 'N/A'],
    ['TAG / Número do Transformador', initialData.transformerTag || 'N/A'],
    ['Localização / Posto', initialData.locationName || 'N/A'],
    ['Cidade / Estado', initialData.cityState || 'N/A'],
    ['UTM Zona', initialData.utm?.zone || 'N/A'],
    ['UTM Coordenada Este (E)', initialData.utm?.easting || 'N/A'],
    ['UTM Coordenada Norte (N)', initialData.utm?.northing || 'N/A'],
    ['Latitude', initialData.utm?.latitude || 'N/A'],
    ['Longitude', initialData.utm?.longitude || 'N/A'],
    [],
    ['DADOS NOMINAIS DO TRANSFORMADOR (BANCO DE DADOS)', ''],
    ['Categoria', transformer.category === 'NOVO' ? 'NOVO' : 'RECONDICIONADO'],
    ['Tipo de Fase', transformer.phaseType],
    ['Potência Nominal (kVA)', transformer.powerKva],
    ['Tensão Primária Nominal (V)', transformer.primaryVoltageV],
    ['Tensão Secundária Nominal (V)', transformer.secondaryVoltageV],
    ['Tensão Secundária Neutro (V)', transformer.secondaryNeutralV],
    ['Impedância Nominal (%Z)', transformer.impedancePercent],
    ['Perdas em Vazio Nominais P0 (W)', transformer.noLoadLossW],
    ['Perdas em Carga Nominais Pk (W)', transformer.loadLoss75cW],
    ['Eficiência Nominal de Fábrica (%)', transformer.efficiencyPercent],
    ['Norma Tabela Referência', transformer.standardReference]
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);

  // Sheet 2: Medicoes_Temporizadas
  const sheet2Headers = [
    'Etapa de Teste',
    'Horário Log',
    'Van (V)',
    'Vbn (V)',
    'Vcn (V)',
    'Vab (V)',
    'Vbc (V)',
    'Vca (V)',
    'Ia (A)',
    'Ib (A)',
    'Ic (A)',
    'In Neutro (A)',
    'Média V F-N (V)',
    'Média V F-F (V)',
    'Média I (A)',
    'Carregamento (kVA)',
    'Carregamento (%)',
    'Desbalanço FDTP (%)',
    'Fator de Potência'
  ];

  const stageLabel = (id: number) => analysis.cycleMode === '5s'
    ? `M${id} (T=${(id - 1) * 5} s — modo de teste)`
    : `M${id} (T=${(id - 1) * (analysis.cycleMode === '5m' ? 5 : 10)} min)`;
  const sheet2Rows = measurements.map((m) => [
    stageLabel(m.id),
    m.timestamp || 'N/A',
    m.van,
    m.vbn,
    m.vcn,
    m.vab,
    m.vbc,
    m.vca,
    m.ia,
    m.ib,
    m.ic,
    m.in || 0,
    m.avgVoltagePhaseNeutral,
    m.avgVoltagePhasePhase,
    m.avgCurrent,
    m.totalKva,
    m.loadingPercent,
    m.fdtpPercent,
    m.powerFactor
  ]);

  sheet2Rows.push([
    'MÉDIA GERAL (3 ETAPAS)',
    `Ciclo ${analysis.cycleMode === '5s' ? '5 s (teste)' : analysis.cycleMode}`,
    analysis.avgVan,
    analysis.avgVbn,
    analysis.avgVcn,
    analysis.avgVab,
    analysis.avgVbc,
    analysis.avgVca,
    analysis.avgIa,
    analysis.avgIb,
    analysis.avgIc,
    analysis.avgIn || 0,
    analysis.overallAvgPhaseNeutralV,
    analysis.overallAvgPhasePhaseV,
    analysis.overallAvgCurrentA,
    analysis.avgKvaMeasured,
    analysis.avgLoadingPercent,
    analysis.prodist.fdtpPercent,
    0.92
  ]);

  const ws2Data = [sheet2Headers, ...sheet2Rows];
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);

  // Sheet 3: Resultados_e_PRODIST
  const sheet3Data = [
    ['ANÁLISE DIAGNÓSTICA E NORMAS ANEEL', 'VALOR OBTIDO', 'CRITÉRIO / UNIDADE', 'DIAGNÓSTICO'],
    ['Qualidade dos dados', analysis.dataQuality.status, `${analysis.dataQuality.issues.length} ocorrência(s)`, analysis.dataQuality.canIssueTapRecommendation ? 'Recomendação liberada' : 'TAP bloqueado'],
    ['Status Tensão PRODIST Mód 8', `${analysis.overallAvgPhasePhaseV} V`, range ? `${range.adequateMinV} a ${range.adequateMaxV} V` : 'Faixa não encontrada', analysis.prodist.voltageStatus],
    ['Detalhamento de Tensão', analysis.prodist.voltageClassificationText, 'ANEEL Mód 8', analysis.prodist.voltageStatus],
    ['Fator de Desbalanço FDTP', `${analysis.prodist.fdtpPercent} %`, `FDTP <= ${fdLimit}% (BT)`, analysis.prodist.unbalanceStatus],
    ['Carregamento Máximo kVA', `${analysis.maxKvaMeasured} kVA`, `Capacidade: ${transformer.powerKva} kVA`, `${analysis.maxLoadingPercent}%`],
    ['Condição de Carga', analysis.loadingCondition, 'Análise Térmica', 'Operacional'],
    ['Elo Fusível Primário Recomendado', analysis.recommendedFuse?.fuseCode || 'N/A', analysis.recommendedFuse?.sourceDocument || 'Sem correspondência', analysis.recommendedFuse?.sourceTable || 'Verificar'],
    ['Posição Recomendada para TAP', analysis.recommendedTap, 'Comutação Sob Carga/Sem Carga', 'Ajuste Recom.'],
    ['Diagnóstico de TAP', analysis.tapAdjustmentAdvice, 'Análise Tensão Secundária', 'Orientação'],
    ['Perdas Estimadas no Cobre Pk (W)', analysis.estimatedCopperLossW, 'W', 'Sob Carga Medida'],
    ['Perdas Estimadas no Ferro P0 (W)', analysis.estimatedIronLossW, 'W', 'Em Vazio'],
    ['Perdas Totais Calculadas (W)', analysis.totalCalculatedLossW, 'W', 'P0 + Pk_calc'],
    ['Eficiência Operacional Calculada (%)', analysis.calculatedEfficiencyPercent, '%', 'Rendimento Real']
  ];

  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);

  const wsValidation = XLSX.utils.aoa_to_sheet([
    ['MEDIÇÃO', 'SEVERIDADE', 'CÓDIGO', 'VERIFICAÇÃO', 'RESULTADO EXATO'],
    ...analysis.dataQuality.issues.map((issue) => [issue.measurementId ? `M${issue.measurementId}` : 'Bloco', issue.severity, issue.code, issue.title, issue.message])
  ]);

  // Sheet 4: Base_Normativa
  const sheet4Data = [
    ['NORMA / REGRA DE NEGÓCIO', 'DETALHAMENTO', 'REQUISITO'],
    ['PRODIST Módulo 8', 'Faixas absolutas por tensão nominal e ligação, carregadas do SQLite offline', `FD95 BT <= ${fdLimit}%`],
    ['Energisa ETU-109.1 / ETU-109.2', 'Tabela 16 separada por óleo, fase, tensão e potência', 'Elo H ou K da célula oficial'],
    ['Triagem temporal', 'Classificação ponto a ponto pelo PRODIST; sem declarar ITIC sem duração de evento', 'Diagnóstico do app'],
    [],
    ['FÓRMULAS E EQUAÇÕES UTILIZADAS NO SISTEMA', ''],
    ['Potência aparente trifásica', 'S = √3 × VFF,média × Imédia / 1000', 'Engenharia'],
    ['Carregamento', 'Carga (%) = Smedida / Snominal × 100', 'Engenharia'],
    ['FDTP', 'β=(Vab⁴+Vbc⁴+Vca⁴)/(Vab²+Vbc²+Vca²)²; FD=100×√((1−√(3−6β))/(1+√(3−6β)))', 'PRODIST'],
    ['Desbalanço de corrente', '100 × máximo |Ifase−Imédia| / Imédia', 'Triagem do app']
  ];

  const ws4 = XLSX.utils.aoa_to_sheet(sheet4Data);

  // Append Sheets to Workbook
  XLSX.utils.book_append_sheet(wb, ws1, 'Diagnostico_e_Trafo');
  XLSX.utils.book_append_sheet(wb, ws2, 'Medicoes_Temporizadas');
  XLSX.utils.book_append_sheet(wb, ws3, 'Resultados_PRODIST');
  XLSX.utils.book_append_sheet(wb, wsValidation, 'Validacao_Dados');
  XLSX.utils.book_append_sheet(wb, ws4, 'Base_Normativa');

  // Export File
  const filename = `Diagnostico_Trafo_${initialData.transformerTag || 'TAG'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
