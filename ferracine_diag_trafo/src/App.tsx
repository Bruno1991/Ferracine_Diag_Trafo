import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FileText, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { Header } from './components/Header';
import { GpsLocationForm } from './components/GpsLocationForm';
import { TransformerSelector } from './components/TransformerSelector';
import { TimedMeasurements } from './components/TimedMeasurements';
import { DiagnosticSummary } from './components/DiagnosticSummary';
import { HexagonalDiagram } from './components/HexagonalDiagram';
import { IticCbemaCurve } from './components/IticCbemaCurve';
import { PhotoUploader } from './components/PhotoUploader';
import { DatabaseExplorer } from './components/DatabaseExplorer';
import { NormsAndCalculationsView } from './components/NormsAndCalculationsView';
import { SettingsView } from './components/SettingsView';

import { InitialDiagnosticData, TransformerSpec, SingleMeasurement, MeasurementCycleMode } from './types';
import { processSingleMeasurement, performFullDiagnosticAnalysis } from './utils/electricalCalculations';
import { generateTransformerDiagnosticPdf } from './utils/pdfGenerator';
import { exportDiagnosticToExcel } from './utils/excelExporter';
import { getOfflineDatabaseStatus, loadBundledOfflineDatabase, type OfflineDatabaseStatus } from './utils/sqliteAndSplitLoader';
import { isCommunityTransformer } from './utils/githubSync';

export default function App() {
  const [activeTab, setActiveTab] = useState<'DIAGNOSTIC' | 'DATABASE' | 'NORMS' | 'SETTINGS'>('DIAGNOSTIC');

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
    fuseCount: 0,
    schemaVersion: 0,
    generatedAt: '',
    source: 'BUNDLED' as OfflineDatabaseStatus['source']
  });

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
        setOfflineDatabaseState({
          loading: false,
          error: '',
          transformerCount: status.transformerCount,
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
    setTransformers(merged);
    localStorage.setItem('tx_analytix_transformers', JSON.stringify(merged));
    setOfflineDatabaseState({
      loading: false,
      error: '',
      transformerCount: status.transformerCount,
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
    technicianName: '',
    technicianCreaCft: '',
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
    exportDiagnosticToExcel({
      initialData,
      transformer: selectedTransformer,
      measurements,
      analysis
    });
  };

  // Reset Form
  const handleNewDiagnostic = () => {
    setInitialData({
      concessionaria: 'Energisa',
      locationName: '',
      cityState: '',
      dateTime: '',
      utm: null,
      technicianName: '',
      technicianCreaCft: '',
      transformerTag: ''
    });

    setPhotos([]);

    setMeasurements([
      processSingleMeasurement(
        {
          id: 1, label: '1ª Medição (T = 0 min)', timestamp: '', isLocked: false,
          van: 0, vbn: 0, vcn: 0, vab: 0, vbc: 0, vca: 0, ia: 0, ib: 0, ic: 0, in: 0,
          powerFactor: 0.92, avgVoltagePhaseNeutral: 0, avgVoltagePhasePhase: 0,
          avgCurrent: 0, totalKva: 0, loadingPercent: 0, fdtpPercent: 0
        },
        selectedTransformer
      ),
      processSingleMeasurement(
        {
          id: 2, label: '2ª Medição (T = 5 min)', timestamp: '', isLocked: true,
          van: 0, vbn: 0, vcn: 0, vab: 0, vbc: 0, vca: 0, ia: 0, ib: 0, ic: 0, in: 0,
          powerFactor: 0.92, avgVoltagePhaseNeutral: 0, avgVoltagePhasePhase: 0,
          avgCurrent: 0, totalKva: 0, loadingPercent: 0, fdtpPercent: 0
        },
        selectedTransformer
      ),
      processSingleMeasurement(
        {
          id: 3, label: '3ª Medição (T = 10 min)', timestamp: '', isLocked: true,
          van: 0, vbn: 0, vcn: 0, vab: 0, vbc: 0, vca: 0, ia: 0, ib: 0, ic: 0, in: 0,
          powerFactor: 0.92, avgVoltagePhaseNeutral: 0, avgVoltagePhasePhase: 0,
          avgCurrent: 0, totalKva: 0, loadingPercent: 0, fdtpPercent: 0
        },
        selectedTransformer
      )
    ]);
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-blue-600 selection:text-white transition-colors duration-200 ${theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      {/* Header Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 py-4 space-y-4">
        {activeTab === 'DIAGNOSTIC' && (
          <>
            {/* Section 1: Initial Diagnostic Data & GPS UTM */}
            <GpsLocationForm
              initialData={initialData}
              onChange={setInitialData}
            />

            {/* Section 2: Transformer Model Database Selection */}
            <TransformerSelector
              selectedTransformer={selectedTransformer}
              onSelectTransformer={(trafo) => {
                setSelectedTransformer(trafo);
                // Recalculate measurements with new transformer nominals
                const updatedList = measurements.map((m) => processSingleMeasurement(m, trafo));
                setMeasurements(updatedList);
              }}
              selectedTap={selectedTap}
              onTapChange={setSelectedTap}
              allTransformers={transformers}
              onAddTransformer={handleAddTransformer}
              initialData={initialData}
              onChangeInitialData={setInitialData}
            />

            {/* Section 3: 3 Timed Measurements (5 min interval) */}
            <TimedMeasurements
              measurements={measurements}
              onChangeMeasurement={handleMeasurementChange}
              selectedTransformer={selectedTransformer}
              cycleMode={cycleMode}
              onCycleModeChange={setCycleMode}
            />

            {/* Section 4: Diagnostic Analysis & PRODIST Status */}
            <DiagnosticSummary
              analysis={analysis}
              transformer={selectedTransformer}
              initialData={initialData}
              onExportPdf={handleExportPdf}
              onExportExcel={handleExportExcel}
            />

            {/* Section 5: Diagrama Fasorial Hexagonal (Full-width Card Page) */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                    6. Diagrama Fasorial Hexagonal de Tensão e Corrente (Simetria e Desbalanço)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Representação vetorial trifásica com defasagem de 120°, módulo de tensão F-F/F-N e correntes com deslocamento de fator de potência.
                  </p>
                </div>
                <span className="self-start sm:self-center text-xs font-mono font-bold px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  PRODIST Módulo 8 ANEEL
                </span>
              </div>

              <div className="w-full overflow-x-auto flex justify-center bg-slate-50 dark:bg-slate-950 p-3 sm:p-4 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors duration-200">
                <HexagonalDiagram
                  measurements={measurements}
                  selectedTransformer={selectedTransformer}
                  width={880}
                  height={520}
                  theme={theme}
                  onCanvasRendered={(url) => {
                    hexDataUrlRef.current = url;
                  }}
                />
              </div>
            </div>

            {/* Section 6: Triagem temporal PRODIST (Full-width Card Page) */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
                    7. Tendência Temporal de Tensão e Corrente
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Cada ponto é classificado nas faixas exatas do PRODIST; incoerências de entrada são destacadas no diagnóstico.
                  </p>
                </div>
                <span className="self-start sm:self-center text-xs font-mono font-bold px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  PRODIST Módulo 8
                </span>
              </div>

              <div className="w-full overflow-x-auto flex justify-center bg-slate-50 dark:bg-slate-950 p-3 sm:p-4 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors duration-200">
                <IticCbemaCurve
                  measurements={measurements}
                  selectedTransformer={selectedTransformer}
                  cycleMode={cycleMode}
                  width={880}
                  height={520}
                  theme={theme}
                  onCanvasRendered={(url) => {
                    iticDataUrlRef.current = url;
                  }}
                />
              </div>
            </div>

            {/* Section 7: Registros Fotográficos do Transformador (Up to 5 Photos) */}
            <PhotoUploader
              photos={photos}
              onPhotosChange={setPhotos}
            />

            {/* Section 8: Painel Final de Ações (Gerar PDF, Exportar Excel, Novo Teste) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg p-4 sm:p-5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 transition-colors duration-200">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400 inline-block"></span>
                  Painel de Exportação e Finalização do Diagnóstico
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Gere o laudo técnico completo em PDF (incluindo laudo, gráficos e fotos), exporte a planilha Excel ou inicie um novo teste.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleNewDiagnostic}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-300 dark:border-slate-700 transition cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>NOVO TESTE</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>EXPORTAR EXCEL</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold shadow-md transition cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>GERAR LAUDO PDF</span>
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'DATABASE' && (
          <DatabaseExplorer
            transformers={transformers}
            onAddTransformer={handleAddTransformer}
            onUpdateTransformers={handleUpdateTransformers}
          />
        )}

        {activeTab === 'NORMS' && <NormsAndCalculationsView />}

        {activeTab === 'SETTINGS' && (
          <SettingsView
            transformers={transformers}
            databaseState={offlineDatabaseState}
            onSyncApplied={handleSyncApplied}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 text-center text-xs text-slate-600 dark:text-slate-400 transition-colors duration-200">
        <p className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          Desenvolvido por Ferracine
        </p>
      </footer>
    </div>
  );
}
