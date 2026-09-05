import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DiagnosticPage } from './pages/DiagnosticPage';
import { NormsPage } from './pages/NormsPage';

import {
  InitialDiagnosticData,
  TransformerSpec,
  SingleMeasurement,
  MeasurementCycleMode
} from './types';
import { processSingleMeasurement, performFullDiagnosticAnalysis } from './utils/electricalCalculations';
import { generateTransformerDiagnosticPdf } from './utils/pdfGenerator';
import { exportDiagnosticToExcel } from './utils/excelExporter';
import { loadBundledOfflineDatabase } from './utils/sqliteAndSplitLoader';
import {
  clearDiagnosticDraft,
  loadDiagnosticDraft,
  saveDiagnosticDraft
} from './utils/diagnosticDraft';
import { getDeviceDateTime } from './utils/dateTimeService';

export const DEFAULT_TECHNICAL_NOTES_TEMPLATE = `OCORRÊNCIA: 
FASE ATUADA: 
CAUSA: 
ELO INSERIDO: 
ELO REMOVIDO: 
OBSERVAÇÕES: `;

export default function App() {
  // Theme State (Light / Dark)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('tx_theme') as 'light' | 'dark') || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('tx_theme', theme);
    } catch (e) {
      console.error('Failed to save theme setting', e);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Helper to ensure all transformers in the array have unique IDs
  useEffect(() => {
    try {
      localStorage.removeItem('tx_analytix_transformers');
      localStorage.removeItem('tx_community_sync');
    } catch {
      // ignore
    }
    void loadBundledOfflineDatabase().catch((err) => {
      console.warn('Erro ao inicializar base SQLite offline:', err);
    });
  }, []);

  // Initial Diagnostic Data
  const [initialData, setInitialData] = useState<InitialDiagnosticData>({
    concessionaria: 'Energisa',
    equipe: '',
    locationName: '',
    cityState: '',
    dateTime: getDeviceDateTime(),
    utm: null,
    authors: [{ id: '1', role: 'ELETRICISTA', name: '', matricula: '' }],
    electrician1Name: '',
    electrician1Matricula: '',
    electrician2Name: '',
    electrician2Matricula: '',
    transformerTag: '',
    technicalNotes: DEFAULT_TECHNICAL_NOTES_TEMPLATE
  });

  const cleanTransformer: TransformerSpec = {
    id: '',
    category: 'USADO',
    phaseType: 'TRIFASICO',
    powerKva: 0,
    primaryVoltageV: 0,
    secondaryVoltageV: 0,
    secondaryNeutralV: 0,
    impedancePercent: 0,
    oilTempC: 0,
    noLoadLossW: 0,
    loadLoss75cW: 0,
    totalLossW: 0,
    efficiencyPercent: 0,
    standardReference: 'Dados da Placa do Transformador',
    dateAdded: new Date().toISOString().split('T')[0]
  };

  const [selectedTransformer, setSelectedTransformer] = useState<TransformerSpec>(cleanTransformer);
  const [cycleMode, setCycleMode] = useState<MeasurementCycleMode>('10m');

  const createInitialMeasurement = (): SingleMeasurement => ({
    id: 1,
    label: '1ª Medição (T = 10 min pós-fechamento)',
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    isLocked: false,
    isRecorded: false,
    van: 0, vbn: 0, vcn: 0,
    vab: 0, vbc: 0, vca: 0,
    ia: 0, ib: 0, ic: 0, in: 0,
    powerFactor: 0.92,
    avgVoltagePhaseNeutral: 0,
    avgVoltagePhasePhase: 0,
    avgCurrent: 0,
    totalKva: 0,
    loadingPercent: 0,
    fdtpPercent: 0
  });

  // Measurements State: inicia com 1 medição e permite adicionar até 3
  const [measurements, setMeasurements] = useState<SingleMeasurement[]>([
    createInitialMeasurement()
  ]);

  const handleAddMeasurement = () => {
    if (measurements.length >= 3) return;
    const nextId = measurements.length + 1;
    const label = nextId === 2
      ? `2ª Medição (T = ${cycleMode === '5s' ? '10 seg' : '20 min'})`
      : `3ª Medição (T = ${cycleMode === '5s' ? '15 seg' : '30 min'})`;

    const newMeas: SingleMeasurement = processSingleMeasurement(
      {
        id: nextId,
        label,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        isLocked: false,
        isRecorded: false,
        van: 0, vbn: 0, vcn: 0,
        vab: 0, vbc: 0, vca: 0,
        ia: 0, ib: 0, ic: 0, in: 0,
        powerFactor: 0.92,
        avgVoltagePhaseNeutral: 0,
        avgVoltagePhasePhase: 0,
        avgCurrent: 0,
        totalKva: 0,
        loadingPercent: 0,
        fdtpPercent: 0
      },
      selectedTransformer
    );

    setMeasurements((prev) => [...prev, newMeas]);
  };

  const handleRemoveMeasurement = (index: number) => {
    if (measurements.length <= 1) return;
    setMeasurements((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSetMeasurementsCount = (count: number) => {
    if (count < 1 || count > 3) return;
    setMeasurements((prev) => {
      if (prev.length === count) return prev;
      if (count < prev.length) {
        return prev.slice(0, count);
      }
      const updated = [...prev];
      while (updated.length < count) {
        const nextId = updated.length + 1;
        const label = `${nextId}ª Medição`;
        const newMeas = processSingleMeasurement(
          {
            id: nextId,
            label,
            timestamp: new Date().toLocaleTimeString('pt-BR'),
            isLocked: false,
            isRecorded: false,
            van: 0, vbn: 0, vcn: 0,
            vab: 0, vbc: 0, vca: 0,
            ia: 0, ib: 0, ic: 0, in: 0,
            powerFactor: 0.92,
            avgVoltagePhaseNeutral: 0,
            avgVoltagePhasePhase: 0,
            avgCurrent: 0,
            totalKva: 0,
            loadingPercent: 0,
            fdtpPercent: 0
          },
          selectedTransformer
        );
        updated.push(newMeas);
      }
      return updated;
    });
  };

  // Photos state (up to 5 photos)
  const [photos, setPhotos] = useState<string[]>([]);
  const draftReadyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadDiagnosticDraft()
      .then((draft) => {
        if (!draft || cancelled) return;
        setInitialData(draft.initialData);
        setSelectedTransformer(draft.transformer);
        setMeasurements(draft.measurements);
        setCycleMode(draft.cycleMode);
        setPhotos(draft.photos);
      })
      .catch((error) => console.warn('Nao foi possivel restaurar o rascunho do diagnostico.', error))
      .finally(() => {
        if (!cancelled) draftReadyRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!draftReadyRef.current) return;
    const timeout = window.setTimeout(() => {
      void saveDiagnosticDraft({
        version: 1,
        savedAt: new Date().toISOString(),
        initialData,
        transformer: selectedTransformer,
        measurements,
        cycleMode,
        photos
      }).catch((error) => console.warn('Nao foi possivel salvar o rascunho do diagnostico.', error));
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [initialData, selectedTransformer, measurements, cycleMode, photos]);

  // Canvas PNG Data URL for Hexagonal diagram in PDF export
  const hexDataUrlRef = useRef<string>('');

  // Handle Measurement Update
  const handleMeasurementChange = (index: number, updated: SingleMeasurement) => {
    const updatedList = [...measurements];
    updatedList[index] = updated;
    setMeasurements(updatedList);
  };

  // Perform Full Analysis
  const analysis = useMemo(() => {
    return performFullDiagnosticAnalysis(measurements, selectedTransformer, cycleMode);
  }, [measurements, selectedTransformer, cycleMode]);

  // PDF Export
  const handleExportPdf = async () => {
    const blockers = getReportBlockers();
    if (blockers.length > 0) {
      alert(`O laudo nao pode ser emitido ainda:\n- ${blockers.join('\n- ')}`);
      return;
    }
    await generateTransformerDiagnosticPdf({
      initialData,
      transformer: selectedTransformer,
      measurements,
      analysis,
      cycleMode,
      hexDataUrl: hexDataUrlRef.current,
      photos
    });
  };

  // Excel Export
  const handleExportExcel = () => {
    const blockers = getReportBlockers();
    if (blockers.length > 0) {
      alert(`A planilha nao pode ser emitida ainda:\n- ${blockers.join('\n- ')}`);
      return;
    }
    exportDiagnosticToExcel({
      initialData,
      transformer: selectedTransformer,
      measurements,
      analysis
    });
  };

  function getReportBlockers(): string[] {
    const blockers: string[] = [];

    // Pelo menos um responsável técnico / eletricista informado
    const hasAuthor = (initialData.authors && initialData.authors.some((a) => a.name.trim())) ||
      Boolean(initialData.electrician1Name?.trim());
    if (!hasAuthor) {
      blockers.push('informe pelo menos um técnico ou eletricista responsável');
    }

    // Transformador com dados básicos
    if (!selectedTransformer.id || selectedTransformer.powerKva <= 0 || selectedTransformer.primaryVoltageV <= 0 || selectedTransformer.secondaryVoltageV <= 0) {
      blockers.push('selecione ou preencha um transformador com potência e tensões nominais válidas');
    }

    // Pelo menos 1 medição preenchida ou registrada (1, 2 ou 3 testes permitidos)
    const hasAtLeastOneMeasurement = measurements.some((m) =>
      m.isRecorded || m.van > 0 || m.vab > 0 || m.ia > 0
    );
    if (!hasAtLeastOneMeasurement) {
      blockers.push('preencha ou registre pelo menos uma medição de campo (seja 1, 2 ou 3)');
    }

    return blockers;
  }

  // Reset Form
  const handleNewDiagnostic = () => {
    void clearDiagnosticDraft().catch((error) => console.warn('Nao foi possivel limpar o rascunho.', error));
    setInitialData({
      concessionaria: 'Energisa',
      equipe: '',
      locationName: '',
      cityState: '',
      dateTime: getDeviceDateTime(),
      utm: null,
      authors: [{ id: '1', role: 'ELETRICISTA', name: '', matricula: '' }],
      electrician1Name: '',
      electrician1Matricula: '',
      electrician2Name: '',
      electrician2Matricula: '',
      transformerTag: '',
      technicalNotes: DEFAULT_TECHNICAL_NOTES_TEMPLATE
    });

    setPhotos([]);
    setSelectedTransformer({ ...cleanTransformer });
    setCycleMode('10m');

    setMeasurements([createInitialMeasurement()]);
  };

  return (
    <HashRouter>
      <div className={`min-h-screen flex flex-col font-sans selection:bg-blue-600 selection:text-white transition-colors duration-200 ${theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
        {/* Header Bar */}
        <Header
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 py-4 space-y-4">
          <Routes>
            <Route
              path="/diagnostic"
              element={
                <DiagnosticPage
                  initialData={initialData}
                  setInitialData={setInitialData}
                  selectedTransformer={selectedTransformer}
                  setSelectedTransformer={setSelectedTransformer}
                  cycleMode={cycleMode}
                  setCycleMode={setCycleMode}
                  measurements={measurements}
                  handleMeasurementChange={handleMeasurementChange}
                  onAddMeasurement={handleAddMeasurement}
                  onRemoveMeasurement={handleRemoveMeasurement}
                  onSetMeasurementsCount={handleSetMeasurementsCount}
                  analysis={analysis}
                  handleExportPdf={handleExportPdf}
                  handleExportExcel={handleExportExcel}
                  handleNewDiagnostic={handleNewDiagnostic}
                  photos={photos}
                  setPhotos={setPhotos}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  onHexCanvasRendered={(url: string) => {
                    hexDataUrlRef.current = url;
                  }}
                />
              }
            />
            <Route
              path="/norms"
              element={<NormsPage />}
            />
            <Route path="*" element={<Navigate to="/diagnostic" replace />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 text-center text-xs text-slate-600 dark:text-slate-400 transition-colors duration-200">
          <p className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Desenvolvido por Ferracine
          </p>
        </footer>
      </div>
    </HashRouter>
  );
}
