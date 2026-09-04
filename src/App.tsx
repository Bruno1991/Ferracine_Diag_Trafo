import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FileText, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { Header } from './components/Header';
import { GpsLocationForm } from './components/GpsLocationForm';
import { TransformerSelector } from './components/TransformerSelector';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DiagnosticPage } from './pages/DiagnosticPage';
import { DatabasePage } from './pages/DatabasePage';
import { NormsPage } from './pages/NormsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TimedMeasurements } from './components/TimedMeasurements';
import { DiagnosticSummary } from './components/DiagnosticSummary';
import { HexagonalDiagram } from './components/HexagonalDiagram';
import { IticCbemaCurve } from './components/IticCbemaCurve';
import { PhotoUploader } from './components/PhotoUploader';
import { DatabaseExplorer } from './components/DatabaseExplorer';
import { NormsAndCalculationsView } from './components/NormsAndCalculationsView';
import { SettingsView } from './components/SettingsView';

import { InitialDiagnosticData, InmetroTransformerModel, TransformerSpec, SingleMeasurement, MeasurementCycleMode } from './types';
import { processSingleMeasurement, performFullDiagnosticAnalysis } from './utils/electricalCalculations';
import { generateTransformerDiagnosticPdf } from './utils/pdfGenerator';
import { exportDiagnosticToExcel } from './utils/excelExporter';
import {
  getOfflineDatabaseStatus,
  getOfflineInmetroModels,
  loadBundledOfflineDatabase,
  type OfflineDatabaseStatus
} from './utils/sqliteAndSplitLoader';
import { isCommunityTransformer } from './utils/githubSync';
import {
  clearDiagnosticDraft,
  loadDiagnosticDraft,
  saveDiagnosticDraft
} from './utils/diagnosticDraft';

export default function App() {
  // Navigation is now handled by React Router

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
  const sanitizeTransformersList = (list: TransformerSpec[]): TransformerSpec[] => {
    const seen = new Set<string>();
    return list.map((item, idx) => {
      let baseId = item.id || `TRAFO-${idx}`;
      let uniqueId = baseId;
      let counter = 1;
      while (seen.has(uniqueId)) {
        uniqueId = `${baseId}-${counter}`;
        counter++;
      }
      seen.add(uniqueId);
      return {
        ...item,
        id: uniqueId,
        dataOrigin: item.dataOrigin || (item.state === 'REFERENCIA_NORMATIVA' ? 'NORMATIVE' : 'COMMUNITY')
      };
    });
  };

  // Database of transformers with local persistence
  const [transformers, setTransformers] = useState<TransformerSpec[]>(() => {
    try {
      const saved = localStorage.getItem('tx_analytix_transformers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return sanitizeTransformersList(parsed);
      }
    } catch (e) {
      console.error('Failed to parse local transformers', e);
    }
    return [];
  });

  const [offlineDatabaseState, setOfflineDatabaseState] = useState({
    loading: true,
    error: '',
    transformerCount: 0,
    inmetroModelCount: 0,
    fuseCount: 0,
    schemaVersion: 0,
    generatedAt: '',
    source: 'BUNDLED' as OfflineDatabaseStatus['source']
  });
  const [inmetroModels, setInmetroModels] = useState<InmetroTransformerModel[]>([]);

  // Load the single bundled SQLite database on mount.
  useEffect(() => {
    async function loadOfflineDatabaseOnMount() {
      try {
        const normativeTrafos = await loadBundledOfflineDatabase();
        if (normativeTrafos.length > 0) {
          setTransformers((prevLocal) => {
            const map = new Map<string, TransformerSpec>();
            prevLocal.forEach((t) => { if (t && t.id) map.set(t.id, t); });
            normativeTrafos.forEach((t) => { if (t && t.id) map.set(t.id, t); });
            const merged = sanitizeTransformersList(Array.from(map.values()));
            try {
              localStorage.setItem('tx_analytix_transformers', JSON.stringify(merged));
            } catch (e) {
              console.error('Falha ao salvar os transformadores offline', e);
            }
            return merged;
          });
        }
        const status = getOfflineDatabaseStatus();
        setInmetroModels(getOfflineInmetroModels());
        setOfflineDatabaseState({
          loading: false,
          error: '',
          transformerCount: status.transformerCount,
          inmetroModelCount: status.inmetroModelCount,
          fuseCount: status.fuseCount,
          schemaVersion: status.schemaVersion,
          generatedAt: status.generatedAt,
          source: status.source
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha ao abrir o banco SQLite offline.';
        setOfflineDatabaseState((current) => ({ ...current, loading: false, error: message }));
        console.error('Banco SQLite offline indisponível:', err);
      }
    }
    void loadOfflineDatabaseOnMount();
  }, []);

  const handleAddTransformer = (newTrafo: TransformerSpec) => {
    let uniqueId = newTrafo.id || 'TRAFO-0';
    let counter = 1;
    while (transformers.some((t) => t.id === uniqueId)) {
      uniqueId = `${newTrafo.id || 'TRAFO'}-${counter}`;
      counter++;
    }
    const trafoWithUniqueId = {
      ...newTrafo,
      id: uniqueId,
      dataOrigin: 'COMMUNITY' as const,
      updatedAt: new Date().toISOString()
    };
    const updated = [trafoWithUniqueId, ...transformers];
    setTransformers(updated);
    try {
      localStorage.setItem('tx_analytix_transformers', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save transformer to localStorage', e);
    }

  };

  const handleUpdateTransformers = (updated: TransformerSpec[]) => {
    setTransformers(updated);
    try {
      localStorage.setItem('tx_analytix_transformers', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to update transformers in localStorage', e);
    }
  };

  const handleSyncApplied = (
    communityTransformers: TransformerSpec[],
    normativeTransformers: TransformerSpec[] | null,
    status: OfflineDatabaseStatus
  ) => {
    const normative = normativeTransformers || transformers.filter((item) => !isCommunityTransformer(item));
    const map = new Map<string, TransformerSpec>();
    normative.forEach((item) => map.set(item.id, { ...item, dataOrigin: 'NORMATIVE' }));
    communityTransformers.forEach((item) => map.set(item.id, { ...item, dataOrigin: 'COMMUNITY' }));
    const merged = sanitizeTransformersList(Array.from(map.values()));
    setInmetroModels(getOfflineInmetroModels());
    setTransformers(merged);
    localStorage.setItem('tx_analytix_transformers', JSON.stringify(merged));
    setOfflineDatabaseState({
      loading: false,
      error: '',
      transformerCount: status.transformerCount,
      inmetroModelCount: status.inmetroModelCount,
      fuseCount: status.fuseCount,
      schemaVersion: status.schemaVersion,
      generatedAt: status.generatedAt,
      source: status.source
    });
  };

  // Initial Diagnostic Data State
  const [initialData, setInitialData] = useState<InitialDiagnosticData>({
    concessionaria: 'Energisa',
    locationName: '',
    cityState: '',
    dateTime: '',
    utm: null,
    electrician1Name: '',
    electrician1Matricula: '',
    electrician2Name: '',
    electrician2Matricula: '',
    transformerTag: ''
  });

  // Selected Transformer Model State (Clean default)
  const cleanTransformer: TransformerSpec = {
    id: '',
    category: 'NOVO',
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
  const [selectedTap, setSelectedTap] = useState<string>('');
  const [cycleMode, setCycleMode] = useState<MeasurementCycleMode>('5m');

  // 3 Measurements State (Zeroed / Ready for Technician Input)
  const [measurements, setMeasurements] = useState<SingleMeasurement[]>([
    {
      id: 1,
      label: '1ª Medição (T = 0 min)',
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
    {
      id: 2,
      label: '2ª Medição (T = 5 min)',
      timestamp: '',
      isLocked: true,
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
    {
      id: 3,
      label: '3ª Medição (T = 10 min)',
      timestamp: '',
      isLocked: true,
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
    }
  ]);

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

  // Canvas PNG Data URLs for PDF export
  const hexDataUrlRef = useRef<string>('');
  const iticDataUrlRef = useRef<string>('');

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
      iticDataUrl: iticDataUrlRef.current,
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
    if (!initialData.electrician1Name.trim()) blockers.push('informe o nome do eletricista 1');
    if (!initialData.electrician1Matricula.trim()) blockers.push('informe a matrícula do eletricista 1');
    if (initialData.electrician2Name && !initialData.electrician2Matricula.trim()) blockers.push('informe a matrícula do eletricista 2');
    if (!initialData.cityState.trim()) blockers.push('informe cidade/estado');
    if (!initialData.transformerTag.trim()) blockers.push('informe a TAG do transformador');
    if (!initialData.dateTime.trim()) blockers.push('informe data e hora');
    if (!selectedTransformer.id || selectedTransformer.powerKva <= 0 || selectedTransformer.primaryVoltageV <= 0 || selectedTransformer.secondaryVoltageV <= 0) {
      blockers.push('selecione ou preencha um transformador valido');
    }
    if (!analysis.dataQuality.canIssueReport) {
      blockers.push('registre tres medicoes completas e corrija as inconsistencias criticas');
    }
    return blockers;
  }

  // Reset Form
  const handleNewDiagnostic = () => {
    void clearDiagnosticDraft().catch((error) => console.warn('Nao foi possivel limpar o rascunho.', error));
    setInitialData({
      concessionaria: 'Energisa',
      locationName: '',
      cityState: '',
      dateTime: '',
      utm: null,
      electrician1Name: '',
      electrician1Matricula: '',
      electrician2Name: '',
      electrician2Matricula: '',
      transformerTag: ''
    });

    setPhotos([]);
    setSelectedTransformer({ ...cleanTransformer });
    setSelectedTap('');
    setCycleMode('5m');

    setMeasurements([
      processSingleMeasurement(
        {
          id: 1, label: '1ª Medição (T = 0 min)', timestamp: '', isLocked: false, isRecorded: false,
          van: 0, vbn: 0, vcn: 0, vab: 0, vbc: 0, vca: 0, ia: 0, ib: 0, ic: 0, in: 0,
          powerFactor: 0.92, avgVoltagePhaseNeutral: 0, avgVoltagePhasePhase: 0,
          avgCurrent: 0, totalKva: 0, loadingPercent: 0, fdtpPercent: 0
        },
        cleanTransformer
      ),
      processSingleMeasurement(
        {
          id: 2, label: '2ª Medição (T = 5 min)', timestamp: '', isLocked: true, isRecorded: false,
          van: 0, vbn: 0, vcn: 0, vab: 0, vbc: 0, vca: 0, ia: 0, ib: 0, ic: 0, in: 0,
          powerFactor: 0.92, avgVoltagePhaseNeutral: 0, avgVoltagePhasePhase: 0,
          avgCurrent: 0, totalKva: 0, loadingPercent: 0, fdtpPercent: 0
        },
        cleanTransformer
      ),
      processSingleMeasurement(
        {
          id: 3, label: '3ª Medição (T = 10 min)', timestamp: '', isLocked: true, isRecorded: false,
          van: 0, vbn: 0, vcn: 0, vab: 0, vbc: 0, vca: 0, ia: 0, ib: 0, ic: 0, in: 0,
          powerFactor: 0.92, avgVoltagePhaseNeutral: 0, avgVoltagePhasePhase: 0,
          avgCurrent: 0, totalKva: 0, loadingPercent: 0, fdtpPercent: 0
        },
        cleanTransformer
      )
    ]);
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-blue-600 selection:text-white transition-colors duration-200 ${theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      {/* Header Bar */}
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <BrowserRouter><main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 py-4 space-y-4">
        <Routes>
          <Route path="/diagnostic" element={<DiagnosticPage
            initialData={initialData}
            setInitialData={setInitialData}
            transformers={transformers}
            setTransformers={setTransformers}
            inmetroModels={inmetroModels}
            setInmetroModels={setInmetroModels}
            selectedTransformer={selectedTransformer}
            setSelectedTransformer={setSelectedTransformer}
            selectedTap={selectedTap}
            setSelectedTap={setSelectedTap}
            cycleMode={cycleMode}
            setCycleMode={setCycleMode}
            measurements={measurements}
            handleMeasurementChange={handleMeasurementChange}
            analysis={analysis}
            handleExportPdf={handleExportPdf}
            handleExportExcel={handleExportExcel}
            photos={photos}
            setPhotos={setPhotos}
            theme={theme}
            onToggleTheme={toggleTheme}
            handleAddTransformer={handleAddTransformer}
            handleUpdateTransformers={handleUpdateTransformers}
            handleSyncApplied={handleSyncApplied}
          />} />
          <Route path="/database" element={<DatabasePage
            transformers={transformers}
            setTransformers={setTransformers}
            inmetroModels={inmetroModels}
            setInmetroModels={setInmetroModels}
            handleAddTransformer={handleAddTransformer}
            handleUpdateTransformers={handleUpdateTransformers}
            handleSyncApplied={handleSyncApplied}
          />} />
          <Route path="/norms" element={<NormsPage
            // Pass any needed props here
          />} />
          <Route path="/settings" element={<SettingsPage
            transformers={transformers}
            databaseState={offlineDatabaseState}
            handleSyncApplied={handleSyncApplied}
          />} />
          <Route path="*" element={<Navigate to="/diagnostic" replace />} />
        </Routes>
      </main></BrowserRouter>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 text-center text-xs text-slate-600 dark:text-slate-400 transition-colors duration-200">
        <p className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          Desenvolvido por Ferracine
        </p>
      </footer>
    </div>
  );
}
