import jsPDF from 'jspdf';
import { InitialDiagnosticData, TransformerSpec } from '../../types';
import { drawHeader } from './pdfHeader';
import { PDF_COLORS, PDF_PAGE_MARGIN, formatKv } from './types';

export function renderPhotoAnnexPages(
  doc: jsPDF,
  initialData: InitialDiagnosticData,
  transformer: TransformerSpec,
  photos: string[] = []
) {
  if (!photos || photos.length === 0) return;

  const validPhotos = photos.slice(0, 15);
  const margin = PDF_PAGE_MARGIN;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  validPhotos.forEach((photo, idx) => {
    doc.addPage('a4', 'p');
    const pageNum = doc.getNumberOfPages();
    drawHeader(doc, `ANEXO FOTOGRÁFICO: FOTO ${idx + 1} DE ${validPhotos.length}`, pageNum, initialData);

    const titleY = 32;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(PDF_COLORS.secondary[0], PDF_COLORS.secondary[1], PDF_COLORS.secondary[2]);
    doc.text(
      `REGISTRO FOTOGRÁFICO ${idx + 1}/${validPhotos.length} — INSPEÇÃO DE CAMPO (TAG: ${initialData.transformerTag || 'S/TAG'})`,
      margin,
      titleY
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Equipamento: ${transformer.powerKva} kVA | Tensão: ${formatKv(transformer.primaryVoltageV)} / ${transformer.secondaryVoltageV} V | Concessionária: ${initialData.concessionaria || 'Energisa'}`,
      margin,
      titleY + 4.5
    );

    const startImgY = titleY + 9;
    const bottomLimit = pageHeight - 30;
    const maxW = pageWidth - 2 * margin; // ~180 mm
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

      // Legenda de identificação abaixo da foto
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
