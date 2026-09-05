import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InitialDiagnosticData, TransformerSpec, SingleMeasurement, DiagnosticAnalysis, MeasurementCycleMode } from '../types';
import { getDiagnosticRuleValue, getOfflineProdistVoltageRanges } from './sqliteAndSplitLoader';

interface PdfExportOptions {
  initialData: InitialDiagnosticData;
  transformer: TransformerSpec;
  measurements: SingleMeasurement[];
  analysis: DiagnosticAnalysis;
  cycleMode: MeasurementCycleMode;
  hexDataUrl?: string;
  photos?: string[];
}

let energisaLogoBase64Cache: string | null = null;

export function getEnergisaLogoBase64(): Promise<string> {
  if (energisaLogoBase64Cache) return Promise.resolve(energisaLogoBase64Cache);

  return new Promise((resolve) => {
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 999.84 325.7" width="999.84" height="325.7">
      <style>.cls-1{fill:#c3cc25;}.cls-2{fill:#049dc5;}</style>
      <g id="Camada_1-2">
        <path class="cls-2" d="M307.34,198.7c.5-4.4,.7-8.3,.7-11.6,0-27.3-14.1-49.7-46.9-49.7h0c-33.5,0-52.4,25.8-52.4,60.5,0,40.4,19.6,58.9,55.4,58.9,14.1,0,28.2-2.5,39.7-7.4l-2.3-19.6c-9.5,4.6-21.7,7.4-33.5,7.4-22.9,0-34.6-12-33.9-38.5h73.2Zm-47.1-43c14.6,0,23.5,9.9,23.1,25.6h-48.7c2.1-15.5,11.8-25.6,25.6-25.6Z"/>
        <path class="cls-2" d="M392.34,137.4c-19.4,0-33.2,10.1-39.9,24.9l-.2-.2c1.1-6.5,1.6-16.4,1.6-22.4h-23.6v114.8h24.7v-55.5c0-22.8,12.7-41.1,30-41.1,13.2,0,17.1,8.3,17.1,22.6v73.9h24.5v-80.4c0-20.2-8.1-36.6-34.2-36.6"/>
        <path class="cls-2" d="M546.04,198.7c.5-4.4,.7-8.3,.7-11.6,.1-27.3-14-49.7-46.8-49.7h0c-33.5,0-52.4,25.8-52.4,60.5,0,40.4,19.6,58.9,55.4,58.9,14.1,0,28.2-2.5,39.7-7.4l-2.3-19.6c-9.5,4.6-21.7,7.4-33.5,7.4-22.9,0-34.6-12-34-38.5h73.2Zm-47.1-43c14.6,0,23.5,9.9,23.1,25.6h-48.7c2.1-15.5,11.8-25.6,25.6-25.6Z"/>
        <path class="cls-2" d="M590.64,165.1h-.4c1.6-8.8,2.3-19,2.3-25.4h-23.6v114.8h24.7v-46.6c0-34.4,11.1-50.4,34-46.2l1.1-24.2c-21.4-2.2-33,12.1-38.1,27.6"/>
        <path class="cls-2" d="M715.74,233.6c-4.9,1.3-10.9,2.2-16.9,2.2-21.6,0-36.5-13.6-36.5-38.2,0-26.2,17.3-39.8,38.9-39.8,11.1,0,21.6,2.2,31.8,6.2l4.3-20.9c-12-3.6-24-5.3-36.3-5.3-40.2,0-64.2,27.1-64.2,61.8,0,37.8,25.1,57.4,59.8,57.4,15.8,0,29.8-2.7,43.1-7.8v-54.5h-24v38.9"/>
        <polyline class="cls-2" points="763.24 254.5 787.94 254.5 787.94 139.7 763.24 139.7 763.24 254.5"/>
        <path class="cls-2" d="M974.44,199.7c0,16.4-11.3,37.8-28.2,37.8-4.1,0-7.4-.6-9.8-1.9-6.3-3.4-12.7-19.8-.5-29.6,3.1-2.5,7.8-4.5,12.9-5.8,5.7-1.4,13.6-2.8,25.6-2.8v2.3Zm25.4,55c-.5-9.7-.7-21.5-.7-31.4v-47c0-23.5-9.7-38.8-44.8-38.8-14.8,0-29.1,3.2-40.4,7.6l2.3,21c9.7-6,23.6-9.2,34.2-9.2,18,0,24,9.7,24,23.9-23.8,0-47.2,5.9-59.3,18.2-3.3,3.4-5.7,6.9-7.6,11.4-5.7,13-1.9,24.9,3.3,32.6,7.1,10.6,14.9,14.3,28.1,14.1,18.3-.4,32.6-10.2,38.1-23.8l.2,.3c-.9,6.2-1.2,13.8-1.2,21.2h23.8"/>
        <path class="cls-2" d="M836.74,169.1c0-8.7,11.8-12.6,25.6-12.6,7.5,0,15.7,1.3,22.6,4l1.1-18.9c-5.7-2.3-14.9-3.4-21.7-3.3-31.6,0-53.2,13.6-53.3,33.2-.2,39.2,56.1,30.5,56,53.3,0,9.3-8.4,10.9-22,10.9-8.9,0-22.9-3.5-30.9-7.1l-.8,21.9c7.5,3,21.6,5.7,30.2,5.7,31.1,0,49.6-12.6,49.7-33.8,.1-37.7-56.6-31.4-56.5-53.3"/>
        <path class="cls-2" d="M236.84,99c-10.3,0-17.7-5.8-17.7-17,0-10.3,7.1-18.3,19-18.3,3.7,0,7.2,.5,10.7,1.6l-1.2,6.2c-3-1.2-6.1-1.8-9.4-1.8-6.3,0-11.5,4-11.5,11.8,0,7.3,4.4,11.3,10.8,11.3,1.8,0,3.5-.3,5-.7v-11.5h7.1v16.1c-4,1.5-8.1,2.3-12.8,2.3"/>
        <path class="cls-2" d="M278.24,87c-1.1-1.5-2-2.8-2.8-3.7,5.4-.9,9.3-4.2,9.3-9.8,0-6.3-4.8-9.5-12.9-9.5-4.2,0-8.7,.1-11.2,.2v34.2h7.1v-14.1h.3l9.8,14.1h8.9l-8.5-11.4Zm-10.5-7.5v-9.9c.9-.1,1.8-.1,3-.1,4,0,6.4,1.7,6.5,4.7,0,3.2-2.4,5.4-6.2,5.4-1.2,0-2.3,0-3.3-.1Z"/>
        <path class="cls-2" d="M309.14,99c-9.9,0-14.9-4.7-14.9-12.5v-22.3h7.1v20.8c0,5.6,2.9,8,8.2,8,5.9,0,8-3.3,8-8.6v-20.2h7.1v21.1c.1,7.5-4.5,13.7-15.5,13.7"/>
        <path class="cls-2" d="M347.34,64c-4,0-8.3,.1-11.2,.2v34.2h7.1v-11.2c.8,0,2.1,.1,3,.1,8.7,0,14.7-4.7,14.7-12.2,0-6.9-4.9-11.1-13.6-11.1Zm-1.1,17.8c-.9,0-2.2-.1-3-.3v-11.6c1-.1,2.2-.1,3.5-.1,4.4,0,6.6,2.4,6.6,5.9,0,4-2.7,6.1-7.1,6.1Z"/>
        <path class="cls-2" d="M383.54,63.7c-9.4,0-17.7,6.8-17.7,18,0,10.2,5.5,17.3,16.6,17.3,9.8,0,18-6.7,17.9-18,0-11.5-6.9-17.3-16.8-17.3Zm-.7,29.1c-6.6,0-9.4-5.1-9.4-11.6,0-7.4,4.5-11.3,9.7-11.3,5.8,0,9.7,4,9.7,11.6s-4.5,11.3-10,11.3Z"/>
        <path class="cls-1" d="M108.14,94.3c-76.5,31.6-141.6,114.3,3.5,231.4h123.4S-13.66,178.8,108.14,94.3"/>
        <path class="cls-1" d="M7.24,204.3s-22.7,58.3,12.3,121.4H104.34C61.94,306.6,5.44,253.3,7.24,204.3"/>
        <path class="cls-2" d="M153.64,0H18.24S173.44,51.1,105.94,154.9c0,0,114.8-80.4,47.7-154.9"/>
      </g>
    </svg>`;

    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 326;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        energisaLogoBase64Cache = canvas.toDataURL('image/png');
        resolve(energisaLogoBase64Cache);
      } else {
        resolve('');
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve('');
    };
    img.src = url;
  });
}

export async function generateTransformerDiagnosticPdf({
  initialData,
  transformer,
  measurements,
  analysis,
  cycleMode,
  hexDataUrl,
  photos = []
}: PdfExportOptions) {
  const logoBase64 = await getEnergisaLogoBase64();

  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const totalPages = photos && photos.length > 0 ? 6 : 5;

  // Colors
  const primaryColor = [15, 23, 42]; // slate-900
  const secondaryColor = [30, 58, 138]; // blue-900
  const accentColor = [2, 132, 199]; // sky-600
  const fdLimit = getDiagnosticRuleValue('prodist_fd_limit_bt_percent', 3.0);
  const voltageRange = getOfflineProdistVoltageRanges().find((range) => range.connection === 'FF' && Math.abs(range.nominalV - transformer.secondaryVoltageV) < 0.01);
  const cycleDescription = cycleMode === '5s' ? '5 segundos (Modo de Teste)' : '10 minutos (Operação de Fato)';
  const measurementOffset = (id: number) => cycleMode === '5s' ? `${(id - 1) * 5} s` : `${(id - 1) * 10} min`;

  // Header Builder - Matches App Header
  const drawHeader = (title: string, pageNum: number) => {
    // Header Background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, 24, 'F');

    let textX = margin;

    // Logo Container Box (Matching App Header style) - ONLY on page 1
    if (pageNum === 1) {
      doc.setFillColor(241, 245, 249); // slate-100
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(margin, 3.5, 30, 16, 2, 2, 'FD');

      // Add Energisa Logo
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin + 1.5, 5.5, 27, 12);
      }
      textX = margin + 33;
    }

    // Main App Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('DIAGNÓSTICO TÉCNICO DE TRANSFORMADORES', textX, 8.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('COMPLIANCE E ANÁLISE DE DESEMPENHO ELÉTRICO', textX, 13);

    // Page Section Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(2, 132, 199); // sky-600
    doc.text(title, textX, 18);

    // Right Side Metadata
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Data: ${initialData.dateTime || new Date().toLocaleString()}`, pageWidth - margin, 8.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`TAG: ${initialData.transformerTag || 'N/A'}`, pageWidth - margin, 14, { align: 'right' });

    // Header Bottom Accent & Border
    doc.setFillColor(2, 132, 199); // sky-600 accent line
    doc.rect(0, 23.2, pageWidth, 0.8, 'F');

    doc.setDrawColor(203, 213, 225); // slate-300 line
    doc.line(0, 24, pageWidth, 24);

    // Footer Bar
    doc.setFillColor(241, 245, 249);
    doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Grupo Energisa', margin, pageHeight - 5);
    doc.setFont('helvetica', 'normal');
    doc.text(' — Laudo Pericial — Normas ANEEL PRODIST Mód 8 / NDU / ETU / NBR 5440', margin + 22, pageHeight - 5);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
  };

  // ==========================================
  // PAGE 1: DADOS INICIAIS E ESPECIFICAÇÕES DO TRAFO
  // ==========================================
  drawHeader('PÁGINA 1: DADOS INICIAIS, LOCALIZAÇÃO E ESPECIFICAÇÕES DO TRAFO', 1);

  let currentY = 28;

  // Block 1: Identificação do Local e Técnico
  doc.setFillColor(248, 250, 252);
  const hasElec2 = Boolean(initialData.electrician2Name && initialData.electrician2Name.trim());
  const block1Height = hasElec2 ? 48 : 42;
  doc.rect(margin, currentY, pageWidth - margin * 2, block1Height, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('1. DADOS DE IDENTIFICAÇÃO E LOCALIZAÇÃO', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  let lineY = currentY + 12;
  doc.text(`Eletricista 1: ${initialData.electrician1Name || 'Não Informado'}`, margin + 4, lineY);
  doc.text(`Matrícula 1: ${initialData.electrician1Matricula || 'N/A'}`, margin + 110, lineY);

  if (hasElec2) {
    lineY += 6;
    doc.text(`Eletricista 2: ${initialData.electrician2Name}`, margin + 4, lineY);
    doc.text(`Matrícula 2: ${initialData.electrician2Matricula || 'N/A'}`, margin + 110, lineY);
  }

  lineY += 6;
  doc.text(`Concessionária: ${initialData.concessionaria || 'N/A'}`, margin + 4, lineY);
  doc.text(`TAG / Nº do Trafo: ${initialData.transformerTag || 'N/A'}`, margin + 110, lineY);

  lineY += 6;
  doc.text(`Local: ${initialData.locationName || 'N/A'} (${initialData.cityState || ''})`, margin + 4, lineY);

  lineY += 7;
  // Single Box Formats for UTM and Geo Coordinates
  let utmStr = '[ 23K 332450,25 7394820,50 ]';
  let geoStr = '[ -23.550520, -46.633308 ]';

  if (initialData.utm) {
    const u = initialData.utm;
    utmStr = `[ ${u.zone || '23K'} ${Math.round(u.easting)} ${Math.round(u.northing)} ]`;
    geoStr = `[ ${u.latitude.toFixed(6)}, ${u.longitude.toFixed(6)} ]`;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`UTM: ${utmStr}`, margin + 4, lineY);
  doc.text(`Coordenadas Geográficas: ${geoStr}`, margin + 110, lineY);

  currentY += block1Height + 4;

  // Block 2: Dados de Placa do Transformador
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, currentY, pageWidth - margin * 2, 50, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('2. ESPECIFICAÇÕES NOMINAIS DA PLACA DO TRANSFORMADOR', margin + 4, currentY + 6);

  const catLabel = transformer.category === 'NOVO'
    ? 'EQUIPAMENTO NOVO (NBR 5440)'
    : 'USADO / RECONDICIONADO (NBR 10295)';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  doc.text(`Situação: ${catLabel}`, margin + 4, currentY + 14);
  doc.text(`Tipo de Fase: ${transformer.phaseType}`, margin + 110, currentY + 14);

  doc.text(`Potência Nominal: ${transformer.powerKva} kVA`, margin + 4, currentY + 21);
  doc.text(`Tensão Primária / Secundária: ${transformer.primaryVoltageV / 1000} kV / ${transformer.secondaryVoltageV}V (F-F)`, margin + 110, currentY + 21);

  doc.text(`Impedância de Placa (%Z): ${transformer.impedancePercent}%`, margin + 4, currentY + 28);
  doc.text(`Temperatura do Óleo (°C): ${transformer.oilTempC || 65} °C`, margin + 110, currentY + 28);

  doc.text(`Perdas em Vazio Nominais (P0): ${transformer.noLoadLossW} W`, margin + 4, currentY + 35);
  doc.text(`Perdas em Carga Nominais (Pk 75°C): ${transformer.loadLoss75cW} W`, margin + 110, currentY + 35);

  doc.text(`Eficiência Nominal de Placa: ${transformer.efficiencyPercent}%`, margin + 4, currentY + 42);
  const standardReferenceLines = doc.splitTextToSize(`Norma de Referência: ${transformer.standardReference}`, 72);
  doc.setFontSize(7.5);
  doc.text(standardReferenceLines, margin + 110, currentY + 42);

  currentY += 54;

  // Block 3: Resumo Executivo do Diagnóstico
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('3. AVALIAÇÃO DIAGNÓSTICA SINTÉTICA (NORMAS ANEEL / NDU / ETU)', margin, currentY);

  currentY += 4;

  autoTable(doc, {
    startY: currentY,
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
        'Carregamento Máximo (% kVA)',
        `${analysis.maxLoadingPercent}% (${analysis.maxKvaMeasured} kVA)`,
        `Pico ${analysis.maxLoadingPercent}% | Média ${analysis.avgLoadingPercent}%`,
        analysis.loadingCondition
      ],
      [
        'Elo Fusível Primário Recomendado',
        analysis.recommendedFuse ? `Elo ${analysis.recommendedFuse.fuseCode}` : 'Não encontrado',
        analysis.recommendedFuse ? `${analysis.recommendedFuse.sourceDocument} - ${analysis.recommendedFuse.sourceTable}` : 'Sem correspondência exata',
        analysis.recommendedFuse ? 'Tabela 16' : 'VERIFICAR'
      ],
      [
        'Recomendação de Posição de TAP',
        analysis.recommendedTap,
        'Comutação de Tensão Secundária',
        !analysis.dataQuality.canIssueTapRecommendation ? 'BLOQUEADO' : analysis.prodist.voltageStatus === 'ADEQUADA' ? 'Manter TAP' : 'Requer Ajuste'
      ],
      [
        'Qualidade / Coerência dos Dados',
        `${analysis.dataQuality.status} (${analysis.dataQuality.issues.length} ocorrência(s))`,
        `Ciclo: ${cycleDescription}`,
        analysis.dataQuality.status
      ],
      [
        'Eficiência Operacional Calculada',
        `${analysis.calculatedEfficiencyPercent}%`,
        `Perdas Totais: ${analysis.totalCalculatedLossW} W`,
        'Operacional'
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
        if (val === 'ADEQUADA' || val === 'ADEQUADO' || val === 'IDEAL' || val === 'Coordenado') {
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

  // ==========================================
  // PAGE 2: TABELA DETALHADA DAS 3 MEDIÇÕES E PARECER
  // ==========================================
  doc.addPage();
  drawHeader('PÁGINA 2: REGISTRO TEMPORIZADO DAS 3 MEDIÇÕES E RECOMENDAÇÕES', 2);

  currentY = 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`4. MEDIÇÕES DE CAMPO — CICLO ${cycleDescription}`, margin, currentY);

  if (cycleMode === '5s') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9);
    doc.text('MODO DE TESTE: ciclo destinado a validar cálculos e interface; não comprova conformidade regulatória de campanha.', margin, currentY + 4);
    currentY += 4;
  }

  currentY += 4;

  const isTri = transformer.phaseType === 'TRIFASICO';

  const rowsMeas = measurements.map((m) => [
    `M${m.id} (T=${measurementOffset(m.id)})`,
    m.timestamp || 'N/A',
    isTri ? `${m.van} / ${m.vbn} / ${m.vcn} V` : `${m.van} / ${m.vbn} V`,
    isTri ? `${m.vab} / ${m.vbc} / ${m.vca} V` : `${m.vab} V`,
    isTri ? `${m.ia} / ${m.ib} / ${m.ic} A (In: ${m.in || 0}A)` : `${m.ia} / ${m.ib} A (In: ${m.in || 0}A)`,
    `${m.totalKva} kVA`,
    `${m.loadingPercent}%`,
    `${m.fdtpPercent}%`
  ]);

  rowsMeas.push([
    'MÉDIA DAS ETAPAS',
    'Média Geral',
    isTri ? `${analysis.avgVan} / ${analysis.avgVbn} / ${analysis.avgVcn} V` : `${analysis.avgVan} / ${analysis.avgVbn} V`,
    isTri ? `${analysis.avgVab} / ${analysis.avgVbc} / ${analysis.avgVca} V` : `${analysis.avgVab} V`,
    isTri ? `${analysis.avgIa} / ${analysis.avgIb} / ${analysis.avgIc} A (In: ${analysis.avgIn || 0}A)` : `${analysis.avgIa} / ${analysis.avgIb} A (In: ${analysis.avgIn || 0}A)`,
    `${analysis.avgKvaMeasured} kVA`,
    `${analysis.avgLoadingPercent}%`,
    `${analysis.prodist.fdtpPercent}%`
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Etapa de Teste', 'Horário Log', 'Tensão F-N (A/B/C)', 'Tensão F-F (AB/BC/CA)', 'Corrente (Ia/Ib/Ic) e Neutro', 'Carreg.', '% Carga', 'FDTP %']],
    body: rowsMeas,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59]
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === rowsMeas.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [226, 232, 240];
      }
    }
  });

  // Inconsistências e anomalias exatas encontradas em cada medição
  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(analysis.dataQuality.status === 'INCONSISTENTE' ? 190 : 180, analysis.dataQuality.status === 'INCONSISTENTE' ? 18 : 83, analysis.dataQuality.status === 'INCONSISTENTE' ? 60 : 9);
  doc.text(`5. VALIDAÇÃO DOS DADOS: ${analysis.dataQuality.status}`, margin, currentY);
  currentY += 3;
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Medição', 'Severidade', 'Verificação', 'Resultado exato']],
    body: analysis.dataQuality.issues.length > 0
      ? analysis.dataQuality.issues.map((issue) => [issue.measurementId ? `M${issue.measurementId}` : 'Bloco', issue.severity === 'CRITICAL' ? 'CRÍTICO' : 'ALERTA', issue.title, issue.message])
      : [['Bloco', 'OK', 'Coerência', 'Nenhuma inconsistência detectada nos dados informados.']],
    theme: 'grid',
    headStyles: { fillColor: analysis.dataQuality.status === 'INCONSISTENTE' ? [190, 18, 60] : [180, 83, 9], textColor: [255, 255, 255], fontSize: 7 },
    bodyStyles: { fontSize: 6.5, cellPadding: 1.2 },
    columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 16 }, 2: { cellWidth: 41 } }
  });

  // Block 5: Parecer Técnico Detalhado
  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 7;

  if (currentY > 235) {
    doc.addPage();
    drawHeader('CONTINUAÇÃO: RECOMENDAÇÕES TÉCNICAS', 2);
    currentY = 30;
  }

  doc.setFillColor(248, 250, 252);
  doc.rect(margin, currentY, pageWidth - margin * 2, 48, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('6. RECOMENDAÇÕES DE AJUSTE DE TAP E ELO FUSÍVEL DE PROTEÇÃO', margin + 4, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  const tapLines = doc.splitTextToSize(
    `• Posição Recomendada para TAP: ${analysis.recommendedTap}\n  Diagnóstico do TAP: ${analysis.tapAdjustmentAdvice}`,
    pageWidth - margin * 2 - 8
  );
  doc.text(tapLines, margin + 4, currentY + 15);

  const fuse = analysis.recommendedFuse;
  const fuseInfoStr = fuse
    ? `• Elo Fusível Primário Recomendado (NDU/ETU): Elo ${fuse.fuseCode} (Corrente Primária ~${(transformer.powerKva * 1000 / (Math.sqrt(3) * transformer.primaryVoltageV)).toFixed(2)} A)\n  Regra de Especificação: Elos de 1A a 5A são Tipo H (ex: 1H, 2H, 3H, 5H). Elos de 6A a 100A são Tipo K (ex: 6K, 8K, 10K, 15K, 20K, 25K).\n  Observação: ${fuse.notes}`
    : '• Elo Fusível Primário: Não especificado para este nível de tensão.';

  const fuseLines = doc.splitTextToSize(fuseInfoStr, pageWidth - margin * 2 - 8);
  doc.text(fuseLines, margin + 4, currentY + 28);

  // ==========================================
  // PAGE 3: ANÁLISE GRÁFICA FASORIAL (DIAGRAMA HEXAGONAL)
  // ==========================================
  doc.addPage();
  drawHeader('PÁGINA 3: DIAGRAMA HEXAGONAL FASORIAL DE SIMETRIA E DESBALANÇO', 3);

  currentY = 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('6. ANÁLISE FASORIAL DO VETOR DE TENSÃO E CORRENTE (DIAGRAMA HEXAGONAL)', margin, currentY);

  currentY += 6;

  const hexImgW = 175;
  const hexImgH = 104;
  const hexX = (pageWidth - hexImgW) / 2;

  if (hexDataUrl) {
    try {
      doc.setFillColor(15, 23, 42);
      doc.rect(hexX - 2, currentY - 2, hexImgW + 4, hexImgH + 4, 'F');
      doc.addImage(hexDataUrl, 'PNG', hexX, currentY, hexImgW, hexImgH);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Figura 1: Diagrama Hexagonal Fasorial de Tensão e Corrente (Fase-Fase e Fase-Neutro)', pageWidth / 2, currentY + hexImgH + 5, { align: 'center' });
    } catch (e) {
      console.warn('Erro ao inserir gráfico hexagonal no PDF:', e);
    }
  }

  currentY += hexImgH + 10;

  // Explanatory Table for Hexagonal Diagram
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Elemento Fasorial', 'Condição Observada na Medição', 'Análise de Conformidade e Riscos']],
    body: [
      [
        'Simetria Fasorial de Tensão',
        `Van=${analysis.avgVan}V | Vbn=${analysis.avgVbn}V | Vcn=${analysis.avgVcn}V`,
        analysis.prodist.fdtpPercent <= fdLimit
          ? `FDTP dentro do limite BT de ${fdLimit.toFixed(1)}%. A defasagem angular só é confirmada se os ângulos forem medidos.`
          : `Desequilíbrio de tensão detectado (FDTP > ${fdLimit.toFixed(1)}%). Verificar rede, carga e coerência da coleta.`
      ],
      [
        'Fator de Desbalanço (FDTP %)',
        `FDTP Medido: ${analysis.prodist.fdtpPercent}%`,
        analysis.prodist.unbalanceStatus === 'ADEQUADO'
          ? `FDTP <= ${fdLimit.toFixed(1)}%: dentro do limite BT cadastrado do PRODIST.`
          : `FDTP > ${fdLimit.toFixed(1)}%: fora do limite BT cadastrado do PRODIST.`
      ],
      [
        'Corrente de Neutro (In)',
        `Corrente Média no Neutro: ${analysis.avgIn || 0} A`,
        analysis.dataQuality.issues.some((issue) => issue.code === 'CORRENTE_NEUTRO')
          ? 'Valor incompatível com a estimativa fasorial a 120°. Conferir ângulos, harmônicos, instrumento e ponto de medição.'
          : 'Sem incompatibilidade detectada pela triagem fasorial; harmônicos e ângulos medidos continuam necessários para conclusão.'
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8.5 }
  });

  // ==========================================
  // PAGE 4: TRIAGEM TEMPORAL PRODIST
  // ==========================================
  doc.addPage();
  drawHeader('PÁGINA 4: TRIAGEM TEMPORAL DE TENSÃO E CORRENTE — PRODIST', 4);
  // PAGE 4: BASE NORMATIVA, FÓRMULAS E ASSINATURA TÉCNICA
  // ==========================================
  doc.addPage();
  drawHeader('PÁGINA 4: BASE NORMATIVA, FÓRMULAS E ASSINATURA TÉCNICA', 4);

  currentY = 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('8. DOCUMENTAÇÃO NORMATIVA E FÓRMULAS DE CÁLCULO', margin, currentY);

  currentY += 6;

  // PRODIST MODULO 8
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('1. PRODIST Módulo 8 — Qualidade do Fornecimento de Energia Elétrica', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  const pText = doc.splitTextToSize('O app usa faixas absolutas por tensão nominal e ligação armazenadas no SQLite. Para BT, o limite FD95 cadastrado é 3,0%; a campanha regulatória possui requisitos próprios de agregação e duração.', pageWidth - margin * 2);
  doc.text(pText, margin, currentY + 4);

  currentY += 12;

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
    head: [['Sistema', 'Nominal', 'Adequada', 'Precária', 'Crítica']],
    body: prodistRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontSize: 8 }
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 8;

  // NDU / ETU e TABELAS DE EFICIÊNCIA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('2. NORMATIVA PARA ELOS FUSÍVEIS E DADOS DA PLACA', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const dbInfo = [
    '• Energisa ETU-109.1 / ETU-109.2, Tabela 16, página 142: matriz separada para transformadores monofásicos e trifásicos.',
    `• Combinação deste equipamento: ${transformer.phaseType}, ${(transformer.primaryVoltageV / 1000).toLocaleString('pt-BR')} kV, ${transformer.powerKva.toLocaleString('pt-BR')} kVA → ${analysis.recommendedFuse ? `elo ${analysis.recommendedFuse.fuseCode}` : 'sem correspondência exata no banco'}.`,
    '• O código do elo (H ou K) é o valor oficial da célula; o app não cria alternativas H/K/T.',
    '• Eficiência operacional é uma estimativa de engenharia a partir de P0, Pk, carga, fator de potência e correção térmica.'
  ];

  dbInfo.forEach((item, idx) => {
    doc.text(item, margin, currentY + 5 + idx * 4.5);
  });

  currentY += 24;

  // FÓRMULAS MATEMÁTICAS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('3. FÓRMULAS MATEMÁTICAS E REGRAS DE CÁLCULO', margin, currentY);

  currentY += 4;

  const formulaRows = [
    ['Potência aparente trifásica', 'S = sqrt(3) x VFF,media x Imedia / 1000'],
    ['Carregamento', 'Carga (%) = Smedida / Snominal x 100'],
    ['FDTP — fórmula exata PRODIST', 'beta=(Vab^4+Vbc^4+Vca^4)/(Vab^2+Vbc^2+Vca^2)^2; FD=100xsqrt((1-sqrt(3-6beta))/(1+sqrt(3-6beta)))'],
    ['Desbalanço de corrente — triagem do app', '100 x maximo |Ifase-Imedia| / Imedia'],
    ['Correção térmica', 'Kt = (Tk + Toleo) / (Tk + 75 C); Tk Cu=234,5 C e Tk Al=225 C'],
    ['Rendimento estimado', 'eta = Pativa / (Pativa + P0 + Pk,calc) x 100']
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Métrica Calculada', 'Fórmula Equação Utilizada']],
    body: formulaRows,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 }
  });

  // Assinatura e Parecer Técnico
  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 8;

  // 4. PARECER TÉCNICO / OBSERVAÇÕES DE CAMPO DO ELETRICISTA
  if (initialData.technicalNotes?.trim()) {
    const textLines = doc.splitTextToSize(initialData.technicalNotes.trim(), pageWidth - 2 * margin - 8);
    const boxHeight = Math.max(20, textLines.length * 4.2 + 10);

    if (currentY + boxHeight + 40 > pageHeight) {
      doc.addPage();
      currentY = 28;
      drawHeader('PARECER TÉCNICO E OBSERVAÇÕES DE CAMPO', doc.getNumberOfPages());
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('4. PARECER TÉCNICO / OBSERVAÇÕES DE CAMPO DO ELETRICISTA', margin, currentY);
    currentY += 4;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, currentY, pageWidth - 2 * margin, boxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(textLines, margin + 4, currentY + 6);

    currentY += boxHeight + 8;
  }

  // Assinaturas dos Responsáveis Técnicos
  const sigSpace = 28;
  if (currentY + sigSpace > pageHeight) {
    doc.addPage();
    currentY = 28;
    drawHeader('ASSINATURAS DOS RESPONSÁVEIS TÉCNICOS', doc.getNumberOfPages());
  }

  const sigY = Math.max(currentY + 14, pageHeight - 34);
  if (initialData.electrician2Name?.trim()) {
    const colW = (pageWidth - 2 * margin - 15) / 2;
    // Eletricista 1
    doc.setDrawColor(148, 163, 184);
    doc.line(margin + 5, sigY, margin + colW - 5, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(initialData.electrician1Name || 'Eletricista 1', margin + colW / 2, sigY + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Matrícula: ${initialData.electrician1Matricula || 'N/A'}`, margin + colW / 2, sigY + 8.5, { align: 'center' });

    // Eletricista 2
    const x2 = margin + colW + 15;
    doc.line(x2 + 5, sigY, x2 + colW - 5, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(initialData.electrician2Name, x2 + colW / 2, sigY + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Matrícula: ${initialData.electrician2Matricula || 'N/A'}`, x2 + colW / 2, sigY + 8.5, { align: 'center' });
  } else {
    // Eletricista 1 único
    doc.setDrawColor(148, 163, 184);
    doc.line(margin + 30, sigY, pageWidth - margin - 30, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(initialData.electrician1Name || 'Eletricista 1', pageWidth / 2, sigY + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Matrícula: ${initialData.electrician1Matricula || 'N/A'}`, pageWidth / 2, sigY + 8.5, { align: 'center' });
  }

  // ==========================================
  // REGISTROS FOTOGRÁFICOS: 1 FOTO POR PÁGINA (SEM DISTORÇÃO) - ATÉ 15 FOTOS
  // ==========================================
  if (photos && photos.length > 0) {
    const validPhotos = photos.slice(0, 15);
    validPhotos.forEach((photo, idx) => {
      doc.addPage();
      const pageNum = doc.getNumberOfPages();
      drawHeader(`ANEXO FOTOGRÁFICO: FOTO ${idx + 1} DE ${validPhotos.length}`, pageNum);

      const titleY = 32;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(
        `REGISTRO FOTOGRÁFICO ${idx + 1}/${validPhotos.length} — INSPEÇÃO TÉCNICA (TAG: ${initialData.transformerTag || 'S/TAG'})`,
        margin,
        titleY
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Equipamento: ${transformer.powerKva} kVA | Tensão: ${(transformer.primaryVoltageV / 1000).toLocaleString('pt-BR')} kV / ${transformer.secondaryVoltageV} V | Concessionária: ${initialData.concessionaria || 'Energisa'}`,
        margin,
        titleY + 4.5
      );

      // Dimensões úteis para renderização proporcional exata
      const startImgY = titleY + 9;
      const bottomLimit = pageHeight - 30;
      const maxW = pageWidth - 2 * margin; // 180 mm
      const maxH = bottomLimit - startImgY; // ~220 mm

      try {
        const imgProps = doc.getImageProperties(photo);
        const imgWidthPx = imgProps.width || 1;
        const imgHeightPx = imgProps.height || 1;
        const aspect = imgWidthPx / imgHeightPx;

        let renderW = maxW;
        let renderH = renderW / aspect;

        if (renderH > maxH) {
          renderH = maxH;
          renderW = renderH * aspect;
        }

        const renderX = margin + (maxW - renderW) / 2;
        const renderY = startImgY + (maxH - renderH) / 2;

        // Moldura em torno da imagem
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.rect(renderX - 1.5, renderY - 1.5, renderW + 3, renderH + 3, 'FD');

        // Renderiza a imagem sem distorção
        doc.addImage(photo, 'JPEG', renderX, renderY, renderW, renderH);

        // Legenda técnica abaixo da foto
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(
          `Foto ${idx + 1} de ${validPhotos.length}: Registro de Campo — TAG ${initialData.transformerTag || 'N/A'} — Data: ${initialData.dateTime || new Date().toLocaleDateString('pt-BR')}`,
          pageWidth / 2,
          renderY + renderH + 6,
          { align: 'center' }
        );
      } catch (e) {
        console.warn(`Erro ao inserir foto ${idx + 1} no PDF:`, e);
      }

      // Rodapé técnico em cada página de foto
      doc.setDrawColor(226, 232, 240);
      doc.line(margin + 40, pageHeight - 16, pageWidth - margin - 40, pageHeight - 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Responsável: ${initialData.electrician1Name || 'Eletricista'} (Matrícula: ${initialData.electrician1Matricula || 'N/A'})${initialData.electrician2Name ? ` | ${initialData.electrician2Name} (Matrícula: ${initialData.electrician2Matricula || 'N/A'})` : ''}`,
        pageWidth / 2,
        pageHeight - 12,
        { align: 'center' }
      );
    });
  }

  // Save / Download PDF
  const filename = `Laudo_Trafo_${initialData.transformerTag || 'TAG'}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
