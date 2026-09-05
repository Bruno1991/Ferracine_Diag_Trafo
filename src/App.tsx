import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DiagnosticPage } from './pages/DiagnosticPage';
import { DatabasePage } from './pages/DatabasePage';
import { NormsPage } from './pages/NormsPage';
import { SettingsPage } from './pages/SettingsPage';

import {
  InitialDiagnosticData,
  InmetroTransformerModel,
  TransformerSpec,
  SingleMeasurement,
  MeasurementCycleMode
} from './types';
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

  const initialDbStatus = getOfflineDatabaseStatus();
  const [offlineDatabaseState, setOfflineDatabaseState] = useState({
    loading: !initialDbStatus.loaded,
    error: '',
    transformerCount: initialDbStatus.transformerCount,
    inmetroModelCount: initialDbStatus.inmetroModelCount,
    fuseCount: initialDbStatus.fuseCount,
    schemaVersion: initialDbStatus.schemaVersion,
    generatedAt: initialDbStatus.generatedAt,
    source: initialDbStatus.source
  });

  const [inmetroModels, setInmetroModels] = useState<InmetroTransformerModel[]>(() => getOfflineInmetroModels());

  const applyDatabaseStatus = (status: OfflineDatabaseStatus, error = '') => {
    setOfflineDatabaseState({
      loading: false,
      error,
      transformerCount: status.transformerCount,
      inmetroModelCount: status.inmetroModelCount,
      fuseCount: status.fuseCount,
      schemaVersion: status.schemaVersion,
      generatedAt: status.generatedAt,
      source: status.source
    });
    setInmetroModels(getOfflineInmetroModels());
  };

  useEffect(() => {
    let isMounted = true;
    setOfflineDatabaseState((prev) => ({ ...prev, loading: true, error: '' }));

    void loadBundledOfflineDatabase()
      .then((bundledTransformers) => {
        if (!isMounted) return;
        const status = getOfflineDatabaseStatus();
        applyDatabaseStatus(status);
        setTransformers((prev) => {
          const savedCommunity = prev.filter(isCommunityTransformer);
          const seen = new Set<string>();
          const merged: TransformerSpec[] = [];

          for (const item of [...bundledTransformers, ...savedCommunity]) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              merged.push(item);
            }
          }
          return sanitizeTransformersList(merged);
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        const status = getOfflineDatabaseStatus();
        applyDatabaseStatus(status, err instanceof Error ? err.message : 'Erro ao carregar banco offline');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdateTransformers = (updatedList: TransformerSpec[]) => {
    const cleanList = sanitizeTransformersList(updatedList);
    setTransformers(cleanList);
    try {
      const communityOnly = cleanList.filter(isCommunityTransformer);
      localStorage.setItem('tx_analytix_transformers', JSON.stringify(communityOnly));
    } catch (e) {
      console.error('Failed to save transformers to local storage', e);
    }
  };

  const handleAddTransformer = (newTrafo: TransformerSpec) => {
    const exists = transformers.some((t) => t.id === newTrafo.id);
    let finalTrafo = { ...newTrafo, dataOrigin: newTrafo.dataOrigin || 'COMMUNITY' as const };
    if (exists) {
      finalTrafo = {
        ...finalTrafo,
        id: `${newTrafo.id}-${Date.now().toString().slice(-4)}`
      };
    }
    const updated = [finalTrafo, ...transformers];
    handleUpdateTransformers(updated);
  };

  const handleSyncApplied = (
    communityTransformers: TransformerSpec[],
    normativeTransformers: TransformerSpec[] | null,
    status: OfflineDatabaseStatus
  ) => {
    applyDatabaseStatus(status);
    setInmetroModels(getOfflineInmetroModels());
    setTransformers((prev) => {
      const baseNormative = normativeTransformers || prev.filter((item) => !isCommunityTransformer(item));
      const seen = new Set<string>();
      const merged: TransformerSpec[] = [];

      for (const item of [...baseNormative, ...communityTransformers]) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          merged.push(item);
        }
      }
      return sanitizeTransformersList(merged);
    });

    try {
      localStorage.setItem('tx_analytix_transformers', JSON.stringify(communityTransformers));
    } catch (e) {
      console.error('Failed to persist synced community transformers', e);
    }
  };

  // Initial Diagnostic Data
  const [initialData, setInitialData] = useState<InitialDiagnosticData>({
    concessionaria: 'Energisa',
    equipe: '',
    locationName: '',
    cityState: '',
    dateTime: '',
    utm: null,
    authors: [{ id: '1', role: 'ELETRICISTA', name: '', matricula: '' }],
    electrician1Name: '',
    electrician1Matricula: '',
    electrician2Name: '',
    electrician2Matricula: '',
    transformerTag: '',
    technicalNotes: ''
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
  const [selectedTap, setSelectedTap] = useState<string>('');
  const [cycleMode, setCycleMode] = useState<MeasurementCycleMode>('10m');

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
      label: '2ª Medição (T = 10 min)',
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
      label: '3ª Medição (T = 20 min)',
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
      dateTime: '',
      utm: null,
      authors: [{ id: '1', role: 'ELETRICISTA', name: '', matricula: '' }],
      electrician1Name: '',
      electrician1Matricula: '',
      electrician2Name: '',
      electrician2Matricula: '',
      transformerTag: '',
      technicalNotes: ''
    });

    setPhotos([]);
    setSelectedTransformer({ ...cleanTransformer });
    setSelectedTap('');
    setCycleMode('10m');

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
          id: 2, label: '2ª Medição (T = 10 min)', timestamp: '', isLocked: true, isRecorded: false,
          van: 0, vbn: 0, vcn: 0, vab: 0, vbc: 0, vca: 0, ia: 0, ib: 0, ic: 0, in: 0,
          powerFactor: 0.92, avgVoltagePhaseNeutral: 0, avgVoltagePhasePhase: 0,
          avgCurrent: 0, totalKva: 0, loadingPercent: 0, fdtpPercent: 0
        },
        cleanTransformer
      ),
      processSingleMeasurement(
        {
          id: 3, label: '3ª Medição (T = 20 min)', timestamp: '', isLocked: true, isRecorded: false,
          van: 0, vbn: 0, vcn: 0, vab: 0, vbc: 0, vca: 0, ia: 0, ib: 0, ic: 0, in: 0,
          powerFactor: 0.92, avgVoltagePhaseNeutral: 0, avgVoltagePhasePhase: 0,
          avgCurrent: 0, totalKva: 0, loadingPercent: 0, fdtpPercent: 0
        },
        cleanTransformer
      )
    ]);
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
                  handleNewDiagnostic={handleNewDiagnostic}
                  photos={photos}
                  setPhotos={setPhotos}
                  theme={theme}
                  onToggleTheme={toggleTheme}
                  handleAddTransformer={handleAddTransformer}
                  handleUpdateTransformers={handleUpdateTransformers}
                  handleSyncApplied={handleSyncApplied}
                  onHexCanvasRendered={(url) => {
                    hexDataUrlRef.current = url;
                  }}
                />
              }
            />
            <Route
              path="/database"
              element={
                <DatabasePage
                  transformers={transformers}
                  setTransformers={setTransformers}
                  inmetroModels={inmetroModels}
                  setInmetroModels={setInmetroModels}
                  handleAddTransformer={handleAddTransformer}
                  handleUpdateTransformers={handleUpdateTransformers}
                />
              }
            />
            <Route
              path="/norms"
              element={<NormsPage />}
            />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  transformers={transformers}
                  databaseState={offlineDatabaseState}
                  handleSyncApplied={handleSyncApplied}
                />
              }
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
