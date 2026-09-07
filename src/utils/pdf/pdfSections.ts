import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InitialDiagnosticData, TransformerSpec, SingleMeasurement, DiagnosticAnalysis, MeasurementCycleMode } from '../../types';
import { getOfflineProdistVoltageRanges } from '../sqliteAndSplitLoader';
import { FormulaDataUrls } from '../formulaAssets';
import { drawHeader } from './pdfHeader';
import { renderExecutiveSummaryTable, renderMeasurementsTable } from './pdfTables';
import { PDF_COLORS, PDF_PAGE_MARGIN, formatKv } from './types';

export function renderPage1IdentificationAndSpecs(
  doc: jsPDF,
  initialData: InitialDiagnosticData,
  transformer: TransformerSpec,
  analysis: DiagnosticAnalysis,
  logoBase64?: string
) {
  const margin = PDF_PAGE_MARGIN;
  const pageWidth = doc.internal.pageSize.getWidth();

  drawHeader(doc, 'PÁGINA 1: DADOS INICIAIS, LOCALIZAÇÃO E ESPECIFICAÇÕES DO TRAFO', 1, initialData, logoBase64);

  let currentY = 28;

  // Block 1: Identificação do Local e Técnico
  const idRows: Array<{ left: string; right?: string }> = [];

  const filledAuthors = (initialData.authors && initialData.authors.length > 0)
    ? initialData.authors.filter((a) => a.name && a.name.trim())
    : [
        ...(initialData.electrician1Name?.trim() ? [{ role: 'ELETRICISTA', name: initialData.electrician1Name.trim(), matricula: initialData.electrician1Matricula?.trim() || '' }] : []),
        ...(initialData.electrician2Name?.trim() ? [{ role: 'ELETRICISTA', name: initialData.electrician2Name.trim(), matricula: initialData.electrician2Matricula?.trim() || '' }] : [])
      ];

  if (filledAuthors.length > 0) {
    filledAuthors.forEach((author) => {
      const left = `${author.role}: ${author.name}`;
      const right = author.matricula?.trim() ? `Matrícula: ${author.matricula.trim()}` : undefined;
      idRows.push({ left, right });
    });
  }

  const equipe = initialData.equipe?.trim();
  const conc = initialData.concessionaria?.trim();
  if (equipe || conc) {
    idRows.push({
      left: equipe ? `Equipe: ${equipe}` : (conc ? `Concessionária: ${conc}` : ''),
      right: (equipe && conc) ? `Concessionária: ${conc}` : undefined
    });
  }

  const loc = initialData.locationName?.trim();
  const city = initialData.cityState?.trim();
  if (loc || city) {
    if (loc && city) {
      idRows.push({ left: `Local: ${loc} (${city})` });
    } else if (loc) {
      idRows.push({ left: `Local: ${loc}` });
    } else {
      idRows.push({ left: `Cidade / Estado: ${city}` });
    }
  }

  if (initialData.utm && (initialData.utm.latitude !== 0 || initialData.utm.easting !== 0)) {
    const u = initialData.utm;
    const utmText = `UTM: [ ${u.zone || '23K'} ${Math.round(u.easting)} ${Math.round(u.northing)} ]`;
    const geoText = `GPS: [ ${u.latitude.toFixed(6)}, ${u.longitude.toFixed(6)} ]`;
    idRows.push({ left: utmText, right: geoText });
  }

  const block1Height = Math.max(18, 10 + idRows.length * 6.2);
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, currentY, pageWidth - margin * 2, block1Height, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(PDF_COLORS.secondary[0], PDF_COLORS.secondary[1], PDF_COLORS.secondary[2]);
  doc.text('1. DADOS DE IDENTIFICAÇÃO E LOCALIZAÇÃO', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  idRows.forEach((row, idx) => {
    const yPos = currentY + 12 + idx * 6.2;
    doc.text(row.left, margin + 4, yPos);
    if (row.right) {
      doc.text(row.right, margin + 110, yPos);
    }
  });

  currentY += block1Height + 4;

  // Block 2: Dados Básicos do Transformador
  const tag = (initialData.transformerTag || (transformer as any).tag)?.trim();
  const brand = (transformer.brand || initialData.transformerBrand)?.trim();

  const specRows: Array<{ left: string; right?: string }> = [];

  specRows.push({
    left: `TAG / Número do Transformador: ${tag || 'Não informado'}`,
    right: `Marca / Fabricante: ${brand || 'Não informado'}`
  });

  specRows.push({
    left: `Local / Alimentador: ${loc || 'Não informado'}`,
    right: `Tipo de Fase: ${transformer.phaseType}`
  });

  const primVStr = transformer.primaryVoltageV > 0
    ? `${transformer.primaryVoltageV} V (${formatKv(transformer.primaryVoltageV)})`
    : 'Não informada';
  specRows.push({
    left: `Potência Nominal: ${transformer.powerKva} kVA`,
    right: `Tensão Primária: ${primVStr}`
  });

  const secFfStr = transformer.secondaryVoltageV > 0 ? `${transformer.secondaryVoltageV} V` : 'Não informada';
  const secFnStr = transformer.secondaryNeutralV && transformer.secondaryNeutralV > 0
    ? `${transformer.secondaryNeutralV} V`
    : 'Não informada';
  specRows.push({
    left: `Tensão Secundária Fase-Fase: ${secFfStr}`,
    right: `Tensão Secundária Fase-Neutro: ${secFnStr}`
  });

  const norm = 'Dados Básicos Coletados em Campo (Técnico)';
  specRows.push({ left: `Padrão: ${norm}` });

  const block2Height = Math.max(18, 10 + specRows.length * 6.2);
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, currentY, pageWidth - margin * 2, block2Height, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(PDF_COLORS.secondary[0], PDF_COLORS.secondary[1], PDF_COLORS.secondary[2]);
  doc.text('2. DADOS BÁSICOS DO TRANSFORMADOR', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  specRows.forEach((row, idx) => {
    const yPos = currentY + 12 + idx * 6.2;
    doc.text(row.left, margin + 4, yPos);
    if (row.right) {
      doc.text(row.right, margin + 110, yPos);
    }
  });

  currentY += block2Height + 4;

  // Block 3: Resumo Executivo do Diagnóstico
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(PDF_COLORS.secondary[0], PDF_COLORS.secondary[1], PDF_COLORS.secondary[2]);
  doc.text('3. AVALIAÇÃO DIAGNÓSTICA SINTÉTICA (NORMAS ANEEL / NDU / ETU)', margin, currentY);

  currentY += 4;
  renderExecutiveSummaryTable(doc, currentY, analysis, transformer);
}

export function renderPage2MeasurementsAndVerdict(
  doc: jsPDF,
  initialData: InitialDiagnosticData,
  transformer: TransformerSpec,
  measurements: SingleMeasurement[],
  analysis: DiagnosticAnalysis,
  cycleMode: MeasurementCycleMode
) {
  const margin = PDF_PAGE_MARGIN;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.addPage();
  drawHeader(doc, 'PÁGINA 2: REGISTRO TEMPORIZADO DAS MEDIÇÕES E RECOMENDAÇÕES', 2, initialData);

  let currentY = 28;

  const recordedMeas = measurements.filter((m) =>
    m.isRecorded === true || m.van > 0 || m.vab > 0 || m.ia > 0
  );
  const activeMeas = recordedMeas.length > 0 ? recordedMeas : [measurements[0]];
  const isInstantaneous = activeMeas.length === 1;

  const cycleDescription = cycleMode === '1s'
    ? '1 segundo (Modo de Teste)'
    : cycleMode === '5s'
    ? '5 segundos (Modo de Teste)'
    : cycleMode === '5m'
    ? '5 minutos'
    : isInstantaneous
      ? '10 minutos (Medição Instantânea pós-fechamento)'
      : '10 minutos (Operação de Fato)';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(PDF_COLORS.secondary[0], PDF_COLORS.secondary[1], PDF_COLORS.secondary[2]);
  doc.text(`4. MEDIÇÕES DE CAMPO — ${isInstantaneous ? 'MEDIÇÃO INSTANTÂNEA (10 min pós-fechamento)' : `CICLO ${cycleDescription}`}`, margin, currentY);

  if (cycleMode === '5s') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9);
    doc.text('MODO DE TESTE:', margin, currentY + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.text('Ciclo destinado a validar cálculos e interface; não comprova conformidade regulatória de campanha.', margin + 3, currentY + 7.5);
    currentY += 8.5;
  }

  currentY += 4;
  currentY = renderMeasurementsTable(doc, currentY, activeMeas, analysis, transformer, cycleMode);
  currentY += 6;

  // Block 5: Parecer Técnico e Resultados Consolidados
  const iTri = transformer.phaseType === 'TRIFASICO';
  const unbPercent = analysis.currentUnbalancePercent || 0;
  const isUnbalanced = iTri && unbPercent > 15;

  const phs = [
    { p: 'A', curr: analysis.avgIa, ld: analysis.loadingPercentA || 0 },
    { p: 'B', curr: analysis.avgIb, ld: analysis.loadingPercentB || 0 },
    { p: 'C', curr: analysis.avgIc, ld: analysis.loadingPercentC || 0 }
  ].sort((a, b) => b.ld - a.ld);

  const pba = analysis.phaseBalanceAnalysis;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(PDF_COLORS.secondary[0], PDF_COLORS.secondary[1], PDF_COLORS.secondary[2]);
  doc.text('5. PARECER TÉCNICO E RESULTADOS CONSOLIDADOS', margin, currentY);
  currentY += 3;

  const boxWidth = pageWidth - margin * 2;
  const startBoxY = currentY;
  let textY = currentY + 4.5;

  const printItem = (label: string, value: string, isAlert = false) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(15, 23, 42);
    doc.text(`${label}:`, margin + 5, textY);
    textY += 3.6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.1);
    doc.setTextColor(isAlert ? 185 : 30, isAlert ? 28 : 41, isAlert ? 28 : 59);
    const valLines = doc.splitTextToSize(value, boxWidth - 14);
    valLines.forEach((vl: string) => {
      doc.text(vl, margin + 8, textY);
      textY += 3.5;
    });
    textY += 1.0;
  };

  // Bloco 1: RESUMO GERAL DO ESTADO OPERACIONAL
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(PDF_COLORS.secondary[0], PDF_COLORS.secondary[1], PDF_COLORS.secondary[2]);
  doc.text('• RESUMO GERAL DO ESTADO OPERACIONAL (NDU 006 / NBR 5356-7):', margin + 3, textY);
  textY += 4.2;

  const condicaoText = (analysis.maxPhaseLoadingPercent || 0) > 100
    ? (analysis.criticalPhase && analysis.criticalPhase !== 'EQUILIBRADO' ? `SOBRECARGA CRÍTICA NA FASE ${analysis.criticalPhase}` : 'SOBRECARGA CRÍTICA TRIFÁSICA')
    : analysis.loadingCondition.replace('_', ' ');
  const condicaoDetalhe = `${condicaoText} (Pico: ${analysis.maxPhaseLoadingPercent || analysis.maxLoadingPercent}% | ${analysis.maxKvaMeasured} kVA medidos | Corrente Nominal: ${analysis.nominalCurrentSecondaryA} A).`;

  printItem('Condição', condicaoDetalhe, (analysis.maxPhaseLoadingPercent || 0) > 100);

  const tensaoDetalhe = `Tensão média de ${analysis.overallAvgPhasePhaseV} V (Conforme / Status: ${analysis.prodist.voltageStatus} — ${analysis.prodist.voltageClassificationText}).`;
  printItem('Tensão Secundária PRODIST Módulo 8', tensaoDetalhe);

  const fuseText = analysis.recommendedFuse ? `Elo Fusível ${analysis.recommendedFuse.fuseCode}` : 'Elo 5H';
  printItem('Proteção Primária Recomendada', `${fuseText} (Norma NDU/ETU — ${formatKv(transformer.primaryVoltageV)} / ${transformer.powerKva} kVA).`);
  textY += 1.5;

  // Bloco 2: DIAGNÓSTICO POR FASE E SIMULAÇÃO DE BALANCEAMENTO
  if (pba) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(PDF_COLORS.secondary[0], PDF_COLORS.secondary[1], PDF_COLORS.secondary[2]);
    doc.text('• DIAGNÓSTICO POR FASE E SIMULAÇÃO DE BALANCEAMENTO:', margin + 3, textY);
    textY += 4.2;

    const dentroText = pba.phasesWithinNominal.length > 0
      ? pba.phasesWithinNominal.map(p => `Fase ${p.phase} (${p.current} A — ${p.loadingPercent}%)`).join(', ')
      : `Nenhuma (todas operando acima de 100% da capacidade nominal de ${pba.nominalCurrentA} A).`;
    printItem('Fases dentro do nominal', dentroText);

    const foraText = pba.phasesExceedingNominal.length > 0
      ? pba.phasesExceedingNominal.map(p => `Fase ${p.phase} (${p.current} A — ${p.loadingPercent}%)`).join(', ')
      : 'Nenhuma.';
    printItem('Fases fora do nominal / sobrecarga (> 100%)', foraText, pba.phasesExceedingNominal.length > 0);

    printItem('Carregamento projetado após balanceamento perfeito', `${pba.postBalancingLoadingPercent}% (${pba.postBalancingCurrentA} A médios por fase).`, !pba.willBeWithinNominalAfterBalancing);
    textY += 1.5;

    // Caixa de Veredito de Balanceamento
    const verdictLines = doc.splitTextToSize(pba.verdict, boxWidth - 16);
    const verdictH = verdictLines.length * 3.5 + 7;

    doc.setFillColor(pba.willBeWithinNominalAfterBalancing ? 240 : 254, pba.willBeWithinNominalAfterBalancing ? 253 : 242, pba.willBeWithinNominalAfterBalancing ? 244 : 242);
    doc.setDrawColor(pba.willBeWithinNominalAfterBalancing ? 187 : 254, pba.willBeWithinNominalAfterBalancing ? 247 : 202, pba.willBeWithinNominalAfterBalancing ? 208 : 202);
    doc.roundedRect(margin + 4, textY, boxWidth - 8, verdictH, 1.5, 1.5, 'FD');

    let vY = textY + 3.8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(pba.willBeWithinNominalAfterBalancing ? 22 : 153, pba.willBeWithinNominalAfterBalancing ? 101 : 27, pba.willBeWithinNominalAfterBalancing ? 52 : 27);
    doc.text('Parecer de Remanejamento:', margin + 7, vY);
    vY += 3.7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.0);
    verdictLines.forEach((vLine: string) => {
      doc.text(vLine, margin + 7, vY);
      vY += 3.4;
    });

    textY += verdictH + 3;
  }

  // Bloco 3: ALERTA DE DESEQUILÍBRIO DE CARGA
  if (isUnbalanced) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(180, 83, 9);
    doc.text('• ALERTA — DESEQUILÍBRIO DE CARGA NA REDE BT (NDU 006 / NDU 007):', margin + 3, textY);
    textY += 4.2;

    const unbItems = [
      { label: 'Desvio de Carga', text: `Desvio de carga de ${unbPercent}% excede o limiar normativo de 15%.` },
      { label: 'Fases Anômalas', text: `Fase ${phs[0].p} com maior carga (${phs[0].curr} A — ${phs[0].ld}%), Fase ${phs[phs.length - 1].p} com menor carga (${phs[phs.length - 1].curr} A — ${phs[phs.length - 1].ld}%).` },
      { label: 'Recomendação', text: 'Remanejamento imediato de ramais e cargas na rede secundária para evitar aquecimento assimétrico e fusão prematura de elos fusíveis.' }
    ];

    unbItems.forEach((u) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(180, 83, 9);
      doc.text(`${u.label}:`, margin + 6, textY);
      textY += 3.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.0);
      doc.setTextColor(120, 53, 15);
      const wrapped = doc.splitTextToSize(u.text, boxWidth - 16);
      wrapped.forEach((wL: string) => {
        doc.text(wL, margin + 9, textY);
        textY += 3.4;
      });
      textY += 1.0;
    });
  }

  // Moldura do Container Geral
  const totalBoxH = textY - startBoxY + 2.5;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, startBoxY, boxWidth, totalBoxH, 2, 2, 'S');
}

export function renderPage3PhasorDiagram(
  doc: jsPDF,
  initialData: InitialDiagnosticData,
  hexDataUrl?: string
) {
  doc.addPage('a4', 'l');
  const landscapePageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const landscapePageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  const margin = PDF_PAGE_MARGIN;

  drawHeader(doc, 'PÁGINA 3: DIAGRAMA HEXAGONAL FASORIAL DE SIMETRIA E DESBALANÇO', 3, initialData);

  const currentY = 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(PDF_COLORS.secondary[0], PDF_COLORS.secondary[1], PDF_COLORS.secondary[2]);
  doc.text('6. DIAGRAMA FASORIAL HEXAGONAL DE TENSÃO E CORRENTE (FASE-FASE E FASE-NEUTRO)', margin, currentY);

  if (hexDataUrl) {
    try {
      const imgProps = doc.getImageProperties(hexDataUrl);
      const imgAspect = imgProps.width / imgProps.height;

      const maxW = landscapePageWidth - margin * 2; // 269 mm
      const maxH = landscapePageHeight - currentY - 18; // ~160 mm

      let renderH = maxH;
      let renderW = renderH * imgAspect;

      if (renderW > maxW) {
        renderW = maxW;
        renderH = renderW / imgAspect;
      }

      const renderX = (landscapePageWidth - renderW) / 2;
      const renderY = currentY + (maxH - renderH) / 2;

      doc.addImage(hexDataUrl, 'PNG', renderX, renderY, renderW, renderH);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Figura 1: Representação Fasorial Completa em Alta Resolução (PRODIST Módulo 8 / NDU 006)',
        landscapePageWidth / 2,
        renderY + renderH + 5,
        { align: 'center' }
      );
    } catch (e) {
      console.warn('Erro ao inserir gráfico hexagonal no PDF:', e);
    }
  }
}

export function renderPage4NormativeAndFormulas(
  doc: jsPDF,
  initialData: InitialDiagnosticData,
  transformer: TransformerSpec,
  analysis: DiagnosticAnalysis,
  formulas: FormulaDataUrls
) {
  doc.addPage('a4', 'p');
  const margin = PDF_PAGE_MARGIN;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  drawHeader(doc, 'PÁGINA 4: BASE NORMATIVA, FÓRMULAS E OBSERVAÇÕES', 4, initialData);

  let currentY = 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(PDF_COLORS.secondary[0], PDF_COLORS.secondary[1], PDF_COLORS.secondary[2]);
  doc.text('7. DOCUMENTAÇÃO NORMATIVA E REGRAS DE CÁLCULO', margin, currentY);

  currentY += 5;

  // PRODIST MODULO 8 - PADRÃO ENERGISA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. PRODIST Módulo 8 — Faixas de Tensão Padronizadas para Concessões do Grupo Energisa', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);

  const pText = doc.splitTextToSize('Limites oficiais regulatórios de tensão aplicados nas áreas de concessão do Grupo Energisa (sistemas principais 220/127 V e 380/220 V, e sistemas monofásicos rurais 254/127 V e 440/220 V MRT). Limite de desbalanceamento de tensão (FDTP): BT <= 3,0%.', pageWidth - margin * 2);
  doc.text(pText, margin, currentY + 3.5);

  currentY += 10;

  const prodistRows = getOfflineProdistVoltageRanges().map((range) => [
    `${range.system} (${range.connection})`,
    `${range.nominalV} V`,
    `${range.adequateMinV}–${range.adequateMaxV} V`,
    `${range.precariousLowMinV} até <${range.adequateMinV} ou >${range.adequateMaxV} até ${range.precariousHighMaxV} V`,
    `<${range.criticalLowBelowV} ou >${range.criticalHighAboveV} V`
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Sistema (Ligação)', 'Nominal', 'Faixa Adequada', 'Faixa Precária', 'Faixa Crítica']],
    body: prodistRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, cellPadding: 1.2 },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold' },
      1: { cellWidth: 16 },
      2: { cellWidth: 28, textColor: [22, 163, 74], fontStyle: 'bold' },
      3: { cellWidth: 62, textColor: [217, 119, 6] },
      4: { cellWidth: 50, textColor: [220, 38, 38], fontStyle: 'bold' }
    }
  });

  currentY = (doc as any).lastAutoTable?.finalY + 6;

  // NDU / ETU e TABELAS DE PROTEÇÃO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. NORMATIVA PARA ELOS FUSÍVEIS E DADOS DA PLACA', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  const dbInfo = [
    '• Energisa ETU-109.1 / ETU-109.2, Tabela 16: matriz oficial para transformadores monofásicos e trifásicos.',
    `• Combinação deste equipamento: ${transformer.phaseType}, ${formatKv(transformer.primaryVoltageV)}, ${transformer.powerKva.toLocaleString('pt-BR')} kVA -> ${analysis.recommendedFuse ? `elo ${analysis.recommendedFuse.fuseCode}` : 'elo 5H'}.`,
    '• O código do elo (H ou K) é o valor oficial da célula normativa; o sistema não cria alternativas divergentes.'
  ];

  dbInfo.forEach((item, idx) => {
    doc.text(item, margin, currentY + 4 + idx * 3.8);
  });

  currentY += 17;

  // FÓRMULAS MATEMÁTICAS EM RECORTES DE IMAGEM
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. FÓRMULAS MATEMÁTICAS E REGRAS DE CÁLCULO (RECORTES NORMATIVOS)', margin, currentY);

  currentY += 2;

  const renderFormulaCard = (title: string, normRef: string, imgDataUrl: string) => {
    if (!imgDataUrl) return;
    let imgProps;
    try {
      imgProps = doc.getImageProperties(imgDataUrl);
    } catch {
      return;
    }
    const aspect = (imgProps.width || 1) / (imgProps.height || 1);
    const boxW = pageWidth - margin * 2;
    const imgW = Math.min(boxW - 12, 135);
    const imgH = imgW / aspect;
    const itemTotalH = imgH + 11;

    if (currentY + itemTotalH > pageHeight - 18) {
      doc.addPage('a4', 'p');
      currentY = 28;
      drawHeader(doc, `PÁGINA ${doc.getNumberOfPages()}: FÓRMULAS DE CÁLCULO E OBSERVAÇÕES`, doc.getNumberOfPages(), initialData);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(30, 58, 138);
    doc.text(title, margin + 2, currentY + 3.5);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(normRef, pageWidth - margin - 2, currentY + 3.5, { align: 'right' });

    currentY += 4.8;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, currentY, boxW, imgH + 3, 1.5, 1.5, 'FD');

    const imgX = margin + (boxW - imgW) / 2;
    const imgY = currentY + 1.5;
    doc.addImage(imgDataUrl, 'PNG', imgX, imgY, imgW, imgH);

    currentY += imgH + 5;
  };

  // I. Corrente Nominal IN
  if (transformer.phaseType === 'TRIFASICO') {
    renderFormulaCard(
      'I. Cálculo da corrente nominal em transformadores trifásicos (IN):',
      'Energisa NDU 006 (Pág. 178)',
      formulas.formulaInTrifasica
    );
  } else {
    renderFormulaCard(
      'I. Cálculo da corrente nominal em transformadores monofásicos (IN):',
      'Energisa NDU 007 (Pág. 189)',
      formulas.formulaInMonofasica
    );
  }

  // II. Potência Aparente e Carregamento
  renderFormulaCard(
    'II. Potência Aparente Trifásica e Carregamento por Fase e Pico:',
    'IEEE Std 1459 / NBR 5356-7',
    formulas.formulaPotenciaCarregamento
  );

  // III. FDTP PRODIST Módulo 8
  renderFormulaCard(
    'III. Fator de Desbalanço de Tensão (FDTP %) — Equações 15 e 16:',
    'PRODIST Módulo 8 ANEEL (Pág. 14)',
    formulas.formulaProdistFdtp
  );

  // IV. Desbalanço de Carga na Rede BT
  renderFormulaCard(
    'IV. Desbalanço de Carga na Rede Secundária BT (Triagem do App):',
    'Energisa NDU 006 / NDU 007 (Limiar: 15%)',
    formulas.formulaDesequilibrioBt
  );

  // 4. PARECER TÉCNICO / OBSERVAÇÕES DE CAMPO DO ELETRICISTA
  if (initialData.technicalNotes?.trim()) {
    const textLines = doc.splitTextToSize(initialData.technicalNotes.trim(), pageWidth - 2 * margin - 8);
    const boxHeight = Math.max(18, textLines.length * 3.8 + 8);

    if (currentY + boxHeight + 25 > pageHeight) {
      doc.addPage('a4', 'p');
      currentY = 28;
      drawHeader(doc, 'PARECER TÉCNICO E OBSERVAÇÕES DE CAMPO', doc.getNumberOfPages(), initialData);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(PDF_COLORS.secondary[0], PDF_COLORS.secondary[1], PDF_COLORS.secondary[2]);
    doc.text('4. PARECER TÉCNICO / OBSERVAÇÕES DE CAMPO DO ELETRICISTA', margin, currentY);
    currentY += 3.5;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, currentY, pageWidth - 2 * margin, boxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(textLines, margin + 4, currentY + 5);

    currentY += boxHeight + 6;
  }
}
