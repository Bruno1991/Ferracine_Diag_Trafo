import React from 'react';
import { Zap } from 'lucide-react';
import { TransformerSpec, PhaseType, InitialDiagnosticData } from '../types';

interface TransformerSelectorProps {
  selectedTransformer: TransformerSpec;
  onSelectTransformer: (spec: TransformerSpec) => void;
  initialData?: InitialDiagnosticData;
  onChangeInitialData?: (updated: InitialDiagnosticData) => void;
}

export const TransformerSelector: React.FC<TransformerSelectorProps> = ({
  selectedTransformer,
  onSelectTransformer,
  initialData,
  onChangeInitialData
}) => {
  const phaseType = selectedTransformer.phaseType || 'TRIFASICO';
  const powerKva = selectedTransformer.powerKva || '';
  const primaryVoltageV = selectedTransformer.primaryVoltageV || '';
  const secondaryVoltageV = selectedTransformer.secondaryVoltageV || '';
  const secondaryNeutralV = selectedTransformer.secondaryNeutralV || '';

  const updateField = (patch: Partial<TransformerSpec>) => {
    const updated: TransformerSpec = {
      ...selectedTransformer,
      ...patch,
      id: initialData?.transformerTag?.trim() || selectedTransformer.id || `TRAFO-${patch.powerKva ?? selectedTransformer.powerKva ?? 0}kVA`,
      brand: initialData?.transformerBrand ?? selectedTransformer.brand,
      standardReference: 'Dados Básicos Coletados em Campo (Técnico)'
    };
    onSelectTransformer(updated);
  };

  const handlePhaseChange = (newPhase: PhaseType) => {
    updateField({ phaseType: newPhase });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-4">
      {/* Cabeçalho do Módulo */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <span>2. DADOS BÁSICOS DO TRANSFORMADOR</span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Preencha os dados básicos do equipamento coletados pelo técnico/eletricista em campo
            </p>
          </div>
        </div>
      </div>

      {/* 1. Tipo de Fase */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
        <label className="label-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
          TIPO DE FASE DO TRANSFORMADOR
        </label>
        <div className="grid grid-cols-2 gap-2 w-full sm:w-72">
          <button
            type="button"
            onClick={() => handlePhaseChange('MONOFASICO')}
            className={`py-1.5 px-3 rounded border text-center text-xs font-bold transition cursor-pointer ${
              phaseType === 'MONOFASICO'
                ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Monofásico (1Ø)
          </button>

          <button
            type="button"
            onClick={() => handlePhaseChange('TRIFASICO')}
            className={`py-1.5 px-3 rounded border text-center text-xs font-bold transition cursor-pointer ${
              phaseType === 'TRIFASICO'
                ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Trifásico (3Ø)
          </button>
        </div>
      </div>

      {/* 2. Dados Reais de Campo: Identificação e Localização */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/80 space-y-3">
        {initialData && onChangeInitialData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-700/80">
            <div>
              <label className="label-xs mb-1 block">TAG / NÚMERO DO TRANSFORMADOR</label>
              <input
                type="text"
                value={initialData.transformerTag || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onChangeInitialData({ ...initialData, transformerTag: val });
                  updateField({ id: val || selectedTransformer.id });
                }}
                placeholder="Ex: PTCA0121"
                className="w-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:bg-white dark:focus:bg-slate-950 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="label-xs mb-1 block">MARCA / FABRICANTE</label>
              <input
                type="text"
                value={initialData.transformerBrand || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onChangeInitialData({ ...initialData, transformerBrand: val });
                  updateField({ brand: val });
                }}
                placeholder="Ex: TRAEL, WEG, Romagnole"
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="label-xs mb-1 block">LOCAL / ALIMENTADOR</label>
              <input
                type="text"
                value={initialData.locationName || ''}
                onChange={(e) => onChangeInitialData({ ...initialData, locationName: e.target.value })}
                placeholder="Ex: CAC-03 (Cacoal - RO)"
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* 3. Grandezas Elétricas Básicas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Potência kVA */}
          <div>
            <label className="label-xs mb-1 block">POTÊNCIA NOMINAL (kVA)</label>
            <input
              type="number"
              step="0.5"
              value={powerKva}
              placeholder="Ex: 112.5"
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Number(e.target.value);
                const numV = val === '' ? 0 : val;
                updateField({ powerKva: numV });
              }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Tensão Primária */}
          <div>
            <label className="label-xs mb-1 block">TENSÃO PRIMÁRIA (V)</label>
            <input
              type="number"
              step="100"
              value={primaryVoltageV}
              placeholder="Ex: 13800"
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Number(e.target.value);
                updateField({ primaryVoltageV: val === '' ? 0 : val });
              }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Tensão Secundária F-F */}
          <div>
            <label className="label-xs mb-1 block">TENSÃO SECUNDÁRIA FASE-FASE (V)</label>
            <input
              type="number"
              value={secondaryVoltageV}
              placeholder="Ex: 220 ou 380"
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Number(e.target.value);
                updateField({ secondaryVoltageV: val === '' ? 0 : val });
              }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Tensão Secundária F-N */}
          <div>
            <label className="label-xs mb-1 block">TENSÃO SECUNDÁRIA FASE-NEUTRO (V)</label>
            <input
              type="number"
              value={secondaryNeutralV}
              placeholder="Ex: 127 ou 220"
              onChange={(e) => {
                const val = e.target.value === '' ? '' : Number(e.target.value);
                updateField({ secondaryNeutralV: val === '' ? 0 : val });
              }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
