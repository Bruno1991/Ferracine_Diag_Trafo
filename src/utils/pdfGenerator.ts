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

  // Colors
  const primaryColor = [15, 23, 42]; // slate-900
  const secondaryColor = [30, 58, 138]; // blue-900
  const accentColor = [2, 132, 199]; // sky-600
  const fdLimit = getDiagnosticRuleValue('prodist_fd_limit_bt_percent', 3.0);
  const voltageRange = getOfflineProdistVoltageRanges().find((range) => range.connection === 'FF' && Math.abs(range.nominalV - transformer.secondaryVoltageV) < 0.01);
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
  const measurementOffset = (id: number) => {
    if (cycleMode === '1s') return `${id} s`;
    if (cycleMode === '5s') return `${(id - 1) * 5} s`;
    if (cycleMode === '5m') return `${id * 5} min`;
    if (id === 1) return '10 min pós-fechamento';
    if (id === 2) return '20 min';
    if (id === 3) return '30 min';
    return `${id * 10} min`;
  };

  // Header Builder - Matches App Header
  const drawHeader = (title: string, pageNum: number) => {
    const curWidth = doc.internal.pageSize.getWidth();
    // Header Background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, curWidth, 24, 'F');

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
    if (initialData.dateTime?.trim()) {
      doc.text(`Data: ${initialData.dateTime.trim()}`, curWidth - margin, 8.5, { align: 'right' });
    }

    if (initialData.transformerTag?.trim()) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`TAG: ${initialData.transformerTag.trim()}`, curWidth - margin, 14, { align: 'right' });
    }

    // Header Bottom Accent & Border
    doc.setFillColor(2, 132, 199); // sky-600 accent line
    doc.rect(0, 23.2, curWidth, 0.8, 'F');

    doc.setDrawColor(203, 213, 225); // slate-300 line
    doc.line(0, 24, curWidth, 24);
  };

  // ==========================================
  // PAGE 1: DADOS INICIAIS E ESPECIFICAÇÕES DO TRAFO
  // ==========================================
  drawHeader('PÁGINA 1: DADOS INICIAIS, LOCALIZAÇÃO E ESPECIFICAÇÕES DO TRAFO', 1);

  let currentY = 28;

  // Block 1: Identificação do Local e Técnico (Apenas campos preenchidos são impressos)
  const idRows: Array<{ left: string; right?: string }> = [];

  // 1. Autores (Técnicos e/ou Eletricistas)
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

  // 2. Equipe e Concessionária
  const equipe = initialData.equipe?.trim();
  const conc = initialData.concessionaria?.trim();
  if (equipe || conc) {
    idRows.push({
      left: equipe ? `Equipe: ${equipe}` : (conc ? `Concessionária: ${conc}` : ''),
      right: (equipe && conc) ? `Concessionária: ${conc}` : undefined
    });
  }

  // 4. Local e Cidade/Estado
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

  // 5. Coordenadas UTM e Geográficas (Apenas se preenchidas / adquiridas)
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
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
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

  // Block 2: Dados Básicos do Transformador (Mesma Ordem do App)
  const tag = (initialData.transformerTag || (transformer as any).tag)?.trim();
  const brand = (transformer.brand || initialData.transformerBrand)?.trim();

  const specRows: Array<{ left: string; right?: string }> = [];

  // 1. Identificação (TAG / Marca)
  specRows.push({
    left: `TAG / Número do Transformador: ${tag || 'Não informado'}`,
    right: `Marca / Fabricante: ${brand || 'Não informado'}`
  });

  // 2. Local e Tipo de Fase
  specRows.push({
    left: `Local / Alimentador: ${loc || 'Não informado'}`,
    right: `Tipo de Fase: ${transformer.phaseType}`
  });

  // 3. Potência Nominal e Tensão Primária
  const primVStr = transformer.primaryVoltageV > 0
    ? `${transformer.primaryVoltageV} V (${(transformer.primaryVoltageV / 1000).toFixed(3)} kV)`
    : 'Não informada';
  specRows.push({
    left: `Potência Nominal: ${transformer.powerKva} kVA`,
    right: `Tensão Primária: ${primVStr}`
  });

  // 4. Tensões Secundárias Fase-Fase e Fase-Neutro
  const secFfStr = transformer.secondaryVoltageV > 0 ? `${transformer.secondaryVoltageV} V` : 'Não informada';
  const secFnStr = transformer.secondaryNeutralV && transformer.secondaryNeutralV > 0
    ? `${transformer.secondaryNeutralV} V`
    : 'Não informada';
  specRows.push({
    left: `Tensão Secundária Fase-Fase: ${secFfStr}`,
    right: `Tensão Secundária Fase-Neutro: ${secFnStr}`
  });

  // 5. Padrão de Coleta
  const norm = 'Dados Básicos Coletados em Campo (Técnico)';
  specRows.push({ left: `Padrão: ${norm}` });

  const block2Height = Math.max(18, 10 + specRows.length * 6.2);
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, currentY, pageWidth - margin * 2, block2Height, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
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

  // ==========================================
  // PAGE 2: TABELA DETALHADA DAS MEDIÇÕES E PARECER
  // ==========================================
  doc.addPage();
  drawHeader('PÁGINA 2: REGISTRO TEMPORIZADO DAS MEDIÇÕES E RECOMENDAÇÕES', 2);

  currentY = 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text(`4. MEDIÇÕES DE CAMPO — ${isInstantaneous ? 'MEDIÇÃO INSTANTÂNEA (10 min pós-fechamento)' : `CICLO ${cycleDescription}`}`, margin, currentY);

  if (cycleMode === '5s') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9);
    doc.text('MODO DE TESTE: ciclo destinado a validar cálculos e interface; não comprova conformidade regulatória de campanha.', margin, currentY + 4);
    currentY += 4;
  }

  currentY += 4;

  const isTri = transformer.phaseType === 'TRIFASICO';

  const rowsMeas = activeMeas.map((m) => [
    `M${m.id} (T=${measurementOffset(m.id)})`,
    m.timestamp || 'Medição Inicial',
    isTri ? `${m.van} / ${m.vbn} / ${m.vcn} V` : `${m.van} / ${m.vbn} V`,
    isTri ? `${m.vab} / ${m.vbc} / ${m.vca} V` : `${m.vab} V`,
    isTri ? `${m.ia} / ${m.ib} / ${m.ic} A (In: ${m.in || 0}A)` : `${m.ia} / ${m.ib} A (In: ${m.in || 0}A)`,
    `${m.totalKva} kVA`,
    m.criticalPhase ? `${m.maxPhaseLoadingPercent}% (${m.criticalPhase})` : `${m.loadingPercent}%`,
    `${m.fdtpPercent}%`
  ]);

  if (activeMeas.length > 1) {
    rowsMeas.push([
      `MÉDIA DAS ETAPAS (${activeMeas.length} MEDIÇÕES)`,
      'Média Geral',
      isTri ? `${analysis.avgVan} / ${analysis.avgVbn} / ${analysis.avgVcn} V` : `${analysis.avgVan} / ${analysis.avgVbn} V`,
      isTri ? `${analysis.avgVab} / ${analysis.avgVbc} / ${analysis.avgVca} V` : `${analysis.avgVab} V`,
      isTri ? `${analysis.avgIa} / ${analysis.avgIb} / ${analysis.avgIc} A (In: ${analysis.avgIn || 0}A)` : `${analysis.avgIa} / ${analysis.avgIb} A (In: ${analysis.avgIn || 0}A)`,
      `${analysis.avgKvaMeasured} kVA`,
      analysis.criticalPhase ? `${analysis.maxPhaseLoadingPercent}% (${analysis.criticalPhase})` : `${analysis.avgLoadingPercent}%`,
      `${analysis.prodist.fdtpPercent}%`
    ]);
  } else {
    rowsMeas.push([
      'VALORES CONSOLIDADOS (1 MEDIÇÃO)',
      'Resultado',
      isTri ? `${analysis.avgVan} / ${analysis.avgVbn} / ${analysis.avgVcn} V` : `${analysis.avgVan} / ${analysis.avgVbn} V`,
      isTri ? `${analysis.avgVab} / ${analysis.avgVbc} / ${analysis.avgVca} V` : `${analysis.avgVab} V`,
      isTri ? `${analysis.avgIa} / ${analysis.avgIb} / ${analysis.avgIc} A (In: ${analysis.avgIn || 0}A)` : `${analysis.avgIa} / ${analysis.avgIb} A (In: ${analysis.avgIn || 0}A)`,
      `${analysis.avgKvaMeasured} kVA`,
      analysis.criticalPhase ? `${analysis.maxPhaseLoadingPercent}% (${analysis.criticalPhase})` : `${analysis.avgLoadingPercent}%`,
      `${analysis.prodist.fdtpPercent}%`
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Etapa de Teste', 'Horário Log', 'Tensão Fase-Neutro (A/B/C)', 'Tensão Fase-Fase (AB/BC/CA)', 'Correntes (Ia/Ib/Ic) e Neutro', 'Carregamento', 'Carga (Pico)', 'FDTP %']],
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

  // Block 5: Parecer Técnico e Resultados Consolidados
  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 7;

  // Cálculo de Desequilíbrio de Corrente na Rede BT
  const iTri = transformer.phaseType === 'TRIFASICO';
  const cList = [analysis.avgIa, analysis.avgIb, analysis.avgIc].filter((c) => c > 0);
  const mAvgI = cList.length > 0 ? cList.reduce((a, b) => a + b, 0) / cList.length : 0;
  const mMaxDev = mAvgI > 0 ? Math.max(...cList.map((c) => Math.abs(c - mAvgI))) : 0;
  const unbPercent = mAvgI > 0 ? Number(((mMaxDev / mAvgI) * 100).toFixed(1)) : 0;
  const isUnbalanced = iTri && unbPercent > 15;

  const phs = [
    { p: 'A', curr: analysis.avgIa, ld: analysis.loadingPercentA || 0 },
    { p: 'B', curr: analysis.avgIb, ld: analysis.loadingPercentB || 0 },
    { p: 'C', curr: analysis.avgIc, ld: analysis.loadingPercentC || 0 }
  ].sort((a, b) => b.ld - a.ld);

  const pba = analysis.phaseBalanceAnalysis;

  // Renderização Estruturada de 5. PARECER TÉCNICO E RESULTADOS CONSOLIDADOS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('5. PARECER TÉCNICO E RESULTADOS CONSOLIDADOS', margin, currentY);
  currentY += 3;

  const boxWidth = pageWidth - margin * 2;
  const startBoxY = currentY;

  // Bloco 1: RESUMO GERAL DO ESTADO OPERACIONAL
  let textY = currentY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('• RESUMO GERAL DO ESTADO OPERACIONAL (NDU 006 / NBR 5356-7):', margin + 3, textY);
  textY += 4.5;

  const condicaoText = (analysis.maxPhaseLoadingPercent || 0) > 100
    ? (analysis.criticalPhase && analysis.criticalPhase !== 'EQUILIBRADO' ? `SOBRECARGA CRÍTICA NA FASE ${analysis.criticalPhase}` : 'SOBRECARGA CRÍTICA TRIFÁSICA')
    : analysis.loadingCondition.replace('_', ' ');
  const condicaoDetalhe = `${condicaoText} (Pico: ${analysis.maxPhaseLoadingPercent || analysis.maxLoadingPercent}% | ${analysis.maxKvaMeasured} kVA medidos | Corrente Nominal: ${analysis.nominalCurrentSecondaryA} A).`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Condição: ', margin + 6, textY);
  const wCondLabel = doc.getTextWidth('Condição: ');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor((analysis.maxPhaseLoadingPercent || 0) > 100 ? 185 : 30, (analysis.maxPhaseLoadingPercent || 0) > 100 ? 28 : 41, (analysis.maxPhaseLoadingPercent || 0) > 100 ? 28 : 59);
  doc.text(condicaoDetalhe, margin + 6 + wCondLabel, textY);
  textY += 4.2;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Tensão Secundária PRODIST Módulo 8: ', margin + 6, textY);
  const wTensLabel = doc.getTextWidth('Tensão Secundária PRODIST Módulo 8: ');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  const tensaoDetalhe = `Tensão média de ${analysis.overallAvgPhasePhaseV} V (Conforme / Status: ${analysis.prodist.voltageStatus} — ${analysis.prodist.voltageClassificationText}).`;
  doc.text(doc.splitTextToSize(tensaoDetalhe, boxWidth - 12 - wTensLabel)[0] || '', margin + 6 + wTensLabel, textY);
  textY += 4.2;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Proteção Primária Recomendada: ', margin + 6, textY);
  const wProtLabel = doc.getTextWidth('Proteção Primária Recomendada: ');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  const fuseText = analysis.recommendedFuse ? `Elo Fusível ${analysis.recommendedFuse.fuseCode}` : 'Elo 5H';
  doc.text(`${fuseText} (Norma NDU/ETU — ${transformer.primaryVoltageV / 1000} kV / ${transformer.powerKva} kVA).`, margin + 6 + wProtLabel, textY);
  textY += 6;

  // Bloco 2: DIAGNÓSTICO POR FASE E SIMULAÇÃO DE BALANCEAMENTO
  if (pba) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('• DIAGNÓSTICO POR FASE E SIMULAÇÃO DE BALANCEAMENTO:', margin + 3, textY);
    textY += 4.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Fases dentro do nominal: ', margin + 6, textY);
    const wDentroLabel = doc.getTextWidth('Fases dentro do nominal: ');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const dentroText = pba.phasesWithinNominal.length > 0
      ? pba.phasesWithinNominal.map(p => `Fase ${p.phase} (${p.current} A — ${p.loadingPercent}%)`).join(', ')
      : `Nenhuma (todas operando acima de 100% da capacidade nominal de ${pba.nominalCurrentA} A).`;
    doc.text(dentroText, margin + 6 + wDentroLabel, textY);
    textY += 4.2;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Fases fora do nominal / sobrecarga (> 100%): ', margin + 6, textY);
    const wForaLabel = doc.getTextWidth('Fases fora do nominal / sobrecarga (> 100%): ');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor((pba.phasesExceedingNominal.length > 0) ? 185 : 30, (pba.phasesExceedingNominal.length > 0) ? 28 : 41, (pba.phasesExceedingNominal.length > 0) ? 28 : 59);
    const foraText = pba.phasesExceedingNominal.length > 0
      ? pba.phasesExceedingNominal.map(p => `Fase ${p.phase} (${p.current} A — ${p.loadingPercent}%)`).join(', ')
      : 'Nenhuma.';
    doc.text(foraText, margin + 6 + wForaLabel, textY);
    textY += 4.2;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Carregamento projetado após balanceamento perfeito: ', margin + 6, textY);
    const wProjBalLabel = doc.getTextWidth('Carregamento projetado após balanceamento perfeito: ');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(pba.willBeWithinNominalAfterBalancing ? 22 : 185, pba.willBeWithinNominalAfterBalancing ? 101 : 28, pba.willBeWithinNominalAfterBalancing ? 52 : 28);
    doc.text(`${pba.postBalancingLoadingPercent}% (${pba.postBalancingCurrentA} A médios por fase).`, margin + 6 + wProjBalLabel, textY);
    textY += 4.5;

    // Caixa de Veredito de Balanceamento
    const verdictLines = doc.splitTextToSize(`Parecer de Remanejamento: ${pba.verdict}`, boxWidth - 14);
    const verdictH = verdictLines.length * 3.8 + 4;
    doc.setFillColor(pba.willBeWithinNominalAfterBalancing ? 240 : 254, pba.willBeWithinNominalAfterBalancing ? 253 : 242, pba.willBeWithinNominalAfterBalancing ? 244 : 242);
    doc.setDrawColor(pba.willBeWithinNominalAfterBalancing ? 187 : 254, pba.willBeWithinNominalAfterBalancing ? 247 : 202, pba.willBeWithinNominalAfterBalancing ? 208 : 202);
    doc.roundedRect(margin + 4, textY, boxWidth - 8, verdictH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.3);
    doc.setTextColor(pba.willBeWithinNominalAfterBalancing ? 22 : 153, pba.willBeWithinNominalAfterBalancing ? 101 : 27, pba.willBeWithinNominalAfterBalancing ? 52 : 27);
    doc.text(verdictLines, margin + 7, textY + 3.5);
    textY += verdictH + 4;
  }

  // Bloco 3: ALERTA DE DESEQUILÍBRIO DE CARGA
  if (isUnbalanced) {
    const unbLines = [
      `Desvio de carga de ${unbPercent}% excede o limiar normativo de 15%.`,
      `Fases anômalas: Fase ${phs[0].p} com maior carga (${phs[0].curr} A — ${phs[0].ld}%), Fase ${phs[phs.length - 1].p} com menor carga (${phs[phs.length - 1].curr} A — ${phs[phs.length - 1].ld}%).`,
      `Recomendação: Remanejamento imediato de ramais e cargas na rede secundária para evitar aquecimento assimétrico e fusão prematura de elos fusíveis.`
    ];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(180, 83, 9);
    doc.text('• ALERTA — DESEQUILÍBRIO DE CARGA NA REDE BT (NDU 006 / NDU 007):', margin + 3, textY);
    textY += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 53, 15);
    unbLines.forEach((uLine) => {
      doc.text(uLine, margin + 6, textY);
      textY += 3.8;
    });
    textY += 2;
  }

  // Moldura do Container Geral
  const totalBoxH = textY - startBoxY + 3;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, startBoxY, boxWidth, totalBoxH, 2, 2, 'S');

  // ==========================================
  // PAGE 3: DIAGRAMA HEXAGONAL FASORIAL EM PÁGINA INTEIRA (A4 LANDSCAPE)
  // ==========================================
  doc.addPage('a4', 'l');
  const landscapePageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const landscapePageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  drawHeader('PÁGINA 3: DIAGRAMA HEXAGONAL FASORIAL DE SIMETRIA E DESBALANÇO', 3);

  currentY = 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('6. DIAGRAMA FASORIAL HEXAGONAL DE TENSÃO E CORRENTE (FASE-FASE E FASE-NEUTRO)', margin, currentY);

  currentY += 4;

  if (hexDataUrl) {
    try {
      const imgProps = doc.getImageProperties(hexDataUrl);
      const imgAspect = imgProps.width / imgProps.height;

      // Ocupa a folha inteira A4 Paisagem (297 x 210 mm)
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

  // ==========================================
  // PAGE 4: BASE NORMATIVA, ANÁLISE FASORIAL E OBSERVAÇÕES TÉCNICAS (RETORNA A4 PORTRAIT)
  // ==========================================
  doc.addPage('a4', 'p');
  drawHeader('PÁGINA 4: ANÁLISE FASORIAL, BASE NORMATIVA E OBSERVAÇÕES', 4);

  currentY = 28;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('7. AVALIAÇÃO DETALHADA DOS ELEMENTOS FASORIAIS', margin, currentY);

  currentY += 4;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Elemento Fasorial', 'Condição Observada na Medição', 'Análise de Conformidade e Riscos']],
    body: [
      [
        'Simetria Fasorial de Tensão',
        `Van=${analysis.avgVan}V | Vbn=${analysis.avgVbn}V | Vcn=${analysis.avgVcn}V`,
        analysis.prodist.fdtpPercent <= fdLimit
          ? `FDTP dentro do limite BT de ${fdLimit.toFixed(1)}%. Defasagem angular equilibrada entre as fases secundárias.`
          : `Desequilíbrio de tensão detectado (FDTP > ${fdLimit.toFixed(1)}%). Verificar rede, carga e coerência da coleta.`
      ],
      [
        'Fator de Desbalanço (FDTP %)',
        `FDTP Medido: ${analysis.prodist.fdtpPercent}%`,
        analysis.prodist.unbalanceStatus === 'ADEQUADO'
          ? `FDTP <= ${fdLimit.toFixed(1)}%: dentro do limite BT cadastrado do PRODIST Módulo 8.`
          : `FDTP > ${fdLimit.toFixed(1)}%: fora do limite BT cadastrado do PRODIST Módulo 8.`
      ],
      [
        'Corrente de Neutro (In)',
        `Corrente Média no Neutro: ${analysis.avgIn || 0} A`,
        analysis.dataQuality.issues.some((issue) => issue.code === 'CORRENTE_NEUTRO')
          ? 'Valor incompatível com a estimativa fasorial a 120°. Conferir ângulos, harmônicos, instrumento e ponto de medição.'
          : 'Sem incompatibilidade detectada pela triagem fasorial.'
      ]
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 }
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('8. DOCUMENTAÇÃO NORMATIVA E FÓRMULAS DE CÁLCULO', margin, currentY);

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

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 6;

  // NDU / ETU e TABELAS DE EFICIÊNCIA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. NORMATIVA PARA ELOS FUSÍVEIS E DADOS DA PLACA', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  const dbInfo = [
    '• Energisa ETU-109.1 / ETU-109.2, Tabela 16: matriz oficial para transformadores monofásicos e trifásicos.',
    `• Combinação deste equipamento: ${transformer.phaseType}, ${(transformer.primaryVoltageV / 1000).toLocaleString('pt-BR')} kV, ${transformer.powerKva.toLocaleString('pt-BR')} kVA -> ${analysis.recommendedFuse ? `elo ${analysis.recommendedFuse.fuseCode}` : 'elo 5H'}.`,
    '• O código do elo (H ou K) é o valor oficial da célula normativa; o sistema não cria alternativas divergentes.'
  ];

  dbInfo.forEach((item, idx) => {
    doc.text(item, margin, currentY + 4 + idx * 3.8);
  });

  currentY += 17;

  // FÓRMULAS MATEMÁTICAS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. FÓRMULAS MATEMÁTICAS E REGRAS DE CÁLCULO', margin, currentY);

  currentY += 3.5;

  const formulaRows = [
    ['Potência aparente trifásica (IEEE Std 1459)', 'S = Van·Ia + Vbn·Ib + Vcn·Ic   ou   S = √3 · V_méd · I_méd / 1000  (kVA)'],
    ['Carregamento por fase e pico (NBR 5356-7 / NDU 006)', 'Carga Fase (%) = (I_fase / I_nominal) × 100; Limite governado pelo pico da fase mais carregada'],
    ['FDTP — fórmula exata PRODIST Módulo 8', 'β = (Vab⁴ + Vbc⁴ + Vca⁴) / (Vab² + Vbc² + Vca²)²;  FDTP = 100 × √((1 - √(3 - 6β)) / (1 + √(3 - 6β)))'],
    ['Desbalanço de corrente (triagem BT)', 'Desvio (%) = 100 × máx |I_fase - I_média| / I_média (Orientativo para balanceamento NDU 006/007 — Limiar: 15%)'],
    ['Perdas no cobre sob carga', 'Pk(I) = Pk,75 × [(Ia² + Ib² + Ic²) / (3 × I_nominal²)] (Física das perdas Joule)'],
    ['Rendimento estimado sob carga', 'η = [P_ativa / (P_ativa + P0 + Pk(I))] × 100']
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Métrica Calculada', 'Fórmula / Equação Matemática Utilizada']],
    body: formulaRows,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7, cellPadding: 1.2 },
    columnStyles: {
      0: { cellWidth: 54, fontStyle: 'bold' },
      1: { cellWidth: 128 }
    }
  });

  // Assinatura e Parecer Técnico
  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 6;

  // 4. PARECER TÉCNICO / OBSERVAÇÕES DE CAMPO DO ELETRICISTA
  if (initialData.technicalNotes?.trim()) {
    const textLines = doc.splitTextToSize(initialData.technicalNotes.trim(), pageWidth - 2 * margin - 8);
    const boxHeight = Math.max(18, textLines.length * 3.8 + 8);

    if (currentY + boxHeight + 25 > pageHeight) {
      doc.addPage('a4', 'p');
      currentY = 28;
      drawHeader('PARECER TÉCNICO E OBSERVAÇÕES DE CAMPO', doc.getNumberOfPages());
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
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

  // ==========================================
  // REGISTROS FOTOGRÁFICOS: 1 FOTO POR PÁGINA (SEM DISTORÇÃO) - ATÉ 15 FOTOS
  // ==========================================
  if (photos && photos.length > 0) {
    const validPhotos = photos.slice(0, 15);
    validPhotos.forEach((photo, idx) => {
      doc.addPage('a4', 'p');
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

    });
  }

  // ==========================================
  // FOOTER & GLOBAL DYNAMIC PAGE NUMBERING (ALL PAGES)
  // ==========================================
  const totalDocPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalDocPages; i++) {
    doc.setPage(i);
    const curPWidth = doc.internal.pageSize.getWidth();
    const curPHeight = doc.internal.pageSize.getHeight();
    doc.setFillColor(241, 245, 249);
    doc.rect(0, curPHeight - 12, curPWidth, 12, 'F');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Grupo Energisa', margin, curPHeight - 5);
    doc.setFont('helvetica', 'normal');
    doc.text(' — Laudo Pericial — Normas ANEEL PRODIST Mód 8 / NDU / ETU / NBR 5440', margin + 22, curPHeight - 5);
    doc.text(`Página ${i} de ${totalDocPages}`, curPWidth - margin, curPHeight - 5, { align: 'right' });
  }

  // Save / Download PDF
  const filename = `Laudo_Trafo_${initialData.transformerTag || 'TAG'}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
