import React from 'react';
import {
  InitialDiagnosticData,
  TransformerSpec,
  InmetroTransformerModel,
  SingleMeasurement,
  MeasurementCycleMode,
  DiagnosticAnalysis,
} from '../types';
import { TransformerSelector } from '../components/TransformerSelector';
import { GpsLocationForm } from '../components/GpsLocationForm';
import { TimedMeasurements } from '../components/TimedMeasurements';
import { DiagnosticSummary } from '../components/DiagnosticSummary';
import { HexagonalDiagram } from '../components/HexagonalDiagram';
import { PhotoUploader } from '../components/PhotoUploader';
import { FileSpreadsheet, FileText, RotateCcw } from 'lucide-react';

interface DiagnosticPageProps {
  initialData: InitialDiagnosticData;
  setInitialData: React.Dispatch<React.SetStateAction<InitialDiagnosticData>>;
  transformers: TransformerSpec[];
  setTransformers: React.Dispatch<React.SetStateAction<TransformerSpec[]>>;
  inmetroModels: InmetroTransformerModel[];
  setInmetroModels: React.Dispatch<React.SetStateAction<InmetroTransformerModel[]>>;
  selectedTransformer: TransformerSpec;
  setSelectedTransformer: React.Dispatch<React.SetStateAction<TransformerSpec>>;
  selectedTap: string;
  setSelectedTap: React.Dispatch<React.SetStateAction<string>>;
  cycleMode: MeasurementCycleMode;
  setCycleMode: React.Dispatch<React.SetStateAction<MeasurementCycleMode>>;
  measurements: SingleMeasurement[];
  handleMeasurementChange: (index: number, updated: SingleMeasurement) => void;
  onAddMeasurement?: () => void;
  onRemoveMeasurement?: (index: number) => void;
  analysis: DiagnosticAnalysis;
  handleExportPdf: () => void;
  handleExportExcel: () => void;
  handleNewDiagnostic?: () => void;
  photos: string[];
  setPhotos: (photos: string[]) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  handleAddTransformer: (newTrafo: TransformerSpec) => void;
  handleUpdateTransformers: (updated: TransformerSpec[]) => void;
  handleSyncApplied: (
    communityTransformers: TransformerSpec[],
    normativeTransformers: TransformerSpec[] | null,
    status: any
  ) => void;
  onHexCanvasRendered?: (url: string) => void;
}

export const DiagnosticPage: React.FC<DiagnosticPageProps> = (props) => {
  const {
    initialData,
    setInitialData,
    transformers,
    selectedTransformer,
    setSelectedTransformer,
    selectedTap,
    setSelectedTap,
    cycleMode,
    setCycleMode,
    measurements,
    handleMeasurementChange,
    analysis,
    handleExportPdf,
    handleExportExcel,
    handleNewDiagnostic,
    photos,
    setPhotos,
    theme,
    handleAddTransformer,
    onHexCanvasRendered
  } = props;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Dados Iniciais e Localização GPS / UTM */}
      <GpsLocationForm initialData={initialData} onChange={setInitialData} />

      {/* 2. Seleção e Dados de Placa do Transformador */}
      <TransformerSelector
        selectedTransformer={selectedTransformer}
        onSelectTransformer={setSelectedTransformer}
        selectedTap={selectedTap}
        onTapChange={setSelectedTap}
        allTransformers={transformers}
        onAddTransformer={handleAddTransformer}
        initialData={initialData}
        onChangeInitialData={setInitialData}
      />

      {/* 3. Medições Temporizadas */}
      <TimedMeasurements
        measurements={measurements}
        onChangeMeasurement={handleMeasurementChange}
        onAddMeasurement={props.onAddMeasurement}
        onRemoveMeasurement={props.onRemoveMeasurement}
        selectedTransformer={selectedTransformer}
        cycleMode={cycleMode}
        onCycleModeChange={setCycleMode}
      />

      {/* 4. Resumo Diagnóstico e Compliance PRODIST */}
      <DiagnosticSummary
        analysis={analysis}
        transformer={selectedTransformer}
        initialData={initialData}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
      />

      {/* 5. Diagrama Fasorial Hexagonal de Tensão e Corrente (Fase-Fase e Fase-Neutro) */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
              5. Diagrama Fasorial Hexagonal de Tensão e Corrente (Fase-Fase e Fase-Neutro)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Representação vetorial com tensões fase-fase (Vab, Vbc, Vca), tensões fase-neutro (Van, Vbn, Vcn) e correntes (Ia, Ib, Ic, In).
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
            height={540}
            theme={theme}
            onCanvasRendered={onHexCanvasRendered}
          />
        </div>
      </div>

      {/* 6. Registros Fotográficos do Transformador */}
      <PhotoUploader photos={photos} onPhotosChange={setPhotos} />

      {/* 7. Anotações e Observações Técnicas do Eletricista */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3 transition-colors duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              7. ANOTAÇÕES / OBSERVAÇÕES TÉCNICAS (RELATÓRIO DO ELETRICISTA)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Campo livre para o eletricista registrar inspeções visuais de campo, anomalias, estado de conservação, ruídos, vazamento de óleo ou parecer técnico para o laudo.
            </p>
          </div>
          <span className={`self-start sm:self-center text-xs font-mono font-bold px-2.5 py-1 rounded border transition-colors ${
            (initialData.technicalNotes || '').length >= 980
              ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700'
              : (initialData.technicalNotes || '').length >= 850
              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}>
            {(initialData.technicalNotes || '').length} / 1000 caracteres
          </span>
        </div>

        <div>
          <textarea
            rows={5}
            maxLength={1000}
            value={initialData.technicalNotes || ''}
            onChange={(e) => setInitialData({ ...initialData, technicalNotes: e.target.value })}
            placeholder="Descreva aqui o parecer técnico, observações da instalação, integridade física do transformador, inspeção das buchas, testes de aterramento ou anomalias encontradas durante a medição (limite de 1000 caracteres)..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md p-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-mono focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none transition resize-y"
          />
        </div>
      </div>

      {/* 8. Painel de Finalização e Exportação */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg p-4 sm:p-5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 mt-2 transition-colors duration-200">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400 inline-block"></span>
            Painel de Exportação e Finalização do Diagnóstico
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Gere o laudo técnico completo em PDF, exporte a planilha Excel com todas as abas normativas ou inicie um novo teste.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          {handleNewDiagnostic && (
            <button
              type="button"
              onClick={handleNewDiagnostic}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-300 dark:border-slate-700 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>NOVO TESTE</span>
            </button>
          )}

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
    </div>
  );
};
