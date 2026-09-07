import jsPDF from 'jspdf';
import { preloadAllFormulasForPdf } from '../formulaAssets';
import { PdfExportOptions, formatKv } from './types';
import { getEnergisaLogoBase64, drawGlobalFooter } from './pdfHeader';
import {
  renderPage1IdentificationAndSpecs,
  renderPage2MeasurementsAndVerdict,
  renderPage3PhasorDiagram,
  renderPage4NormativeAndFormulas
} from './pdfSections';
import { renderPhotoAnnexPages } from './pdfPhotos';

export * from './types';
export { getEnergisaLogoBase64 } from './pdfHeader';

export async function buildTransformerDiagnosticPdfDoc(options: PdfExportOptions): Promise<jsPDF> {
  const {
    initialData,
    transformer,
    measurements,
    analysis,
    cycleMode,
    hexDataUrl,
    photos = []
  } = options;

  // Pre-load logo and formula PNG assets in parallel
  const [logoBase64, formulas] = await Promise.all([
    getEnergisaLogoBase64(),
    preloadAllFormulasForPdf()
  ]);

  const JsPdfConstructor = (jsPDF as any).jsPDF || jsPDF;
  const doc: jsPDF = new JsPdfConstructor({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Page 1: Identification, location & basic specs
  renderPage1IdentificationAndSpecs(doc, initialData, transformer, analysis, logoBase64);

  // Page 2: Timed field measurements & consolidated verdict (NDU 006 / NBR 5356-7)
  renderPage2MeasurementsAndVerdict(doc, initialData, transformer, measurements, analysis, cycleMode);

  // Page 3: Full-page high-resolution hexagonal phasor diagram (A4 Landscape)
  renderPage3PhasorDiagram(doc, initialData, hexDataUrl);

  // Page 4: Normative tables, formula snippets & technical observations (A4 Portrait)
  renderPage4NormativeAndFormulas(doc, initialData, transformer, analysis, formulas);

  // Pages 5+: Photo annexes (1 per page, proportional aspect ratio)
  renderPhotoAnnexPages(doc, initialData, transformer, photos);

  // Global running footer with dynamic page numbering
  drawGlobalFooter(doc);

  return doc;
}

export async function generateTransformerDiagnosticPdf(options: PdfExportOptions): Promise<void> {
  const doc = await buildTransformerDiagnosticPdfDoc(options);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fileDate = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
  const fileTime = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const cleanTrafoTag = (options.initialData.transformerTag || 'TRANSFORMADOR')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_');

  const filename = `${cleanTrafoTag}_${fileDate}_${fileTime}.pdf`;
  console.log('PDF generator saving filename:', filename);
  doc.save(filename);
}
