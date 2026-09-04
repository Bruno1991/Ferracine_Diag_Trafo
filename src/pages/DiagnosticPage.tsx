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
import { IticCbemaCurve } from '../components/IticCbemaCurve';
import { PhotoUploader } from '../components/PhotoUploader';

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
  analysis: DiagnosticAnalysis;
  handleExportPdf: () => void;
  handleExportExcel: () => void;
  photos: string[];
  setPhotos: React.Dispatch<React.SetStateAction<string[]>>;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  handleAddTransformer: (newTrafo: TransformerSpec) => void;
  handleUpdateTransformers: (updated: TransformerSpec[]) => void;
  handleSyncApplied: (
    communityTransformers: TransformerSpec[],
    normativeTransformers: TransformerSpec[] | null,
    status: any
  ) => void;
}

export const DiagnosticPage: React.FC<DiagnosticPageProps> = (props) => {
  const {
    initialData,
    setInitialData,
    transformers,
    setTransformers,
    inmetroModels,
    setInmetroModels,
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
    photos,
    setPhotos,
    theme,
    onToggleTheme,
    handleAddTransformer,
    handleUpdateTransformers,
    handleSyncApplied,
  } = props;

  return (
    <div className="flex flex-col gap-4">
      <TransformerSelector
        transformers={transformers}
        setTransformers={setTransformers}
        inmetroModels={inmetroModels}
        setInmetroModels={setInmetroModels}
        selectedTransformer={selectedTransformer}
        setSelectedTransformer={setSelectedTransformer}
        selectedTap={selectedTap}
        setSelectedTap={setSelectedTap}
        handleAddTransformer={handleAddTransformer}
        handleUpdateTransformers={handleUpdateTransformers}
        handleSyncApplied={handleSyncApplied}
      />
      <GpsLocationForm initialData={initialData} onChange={setInitialData} />
      <TimedMeasurements
        measurements={measurements}
        onChange={handleMeasurementChange}
        cycleMode={cycleMode}
        setCycleMode={setCycleMode}
      />
      <DiagnosticSummary analysis={analysis} initialData={initialData} />
      <HexagonalDiagram measurements={measurements} transformer={selectedTransformer} />
      <IticCbemaCurve measurements={measurements} transformer={selectedTransformer} cycleMode={cycleMode} />
      <PhotoUploader photos={photos} setPhotos={setPhotos} />
      <div className="flex gap-2 mt-4">
        <button
          onClick={handleExportPdf}
          className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Export PDF
        </button>
        <button
          onClick={handleExportExcel}
          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Export Excel
        </button>
      </div>
    </div>
  );
};
