import React from 'react';
import { Zap } from 'lucide-react';
import { TransformerSpec, PhaseType, InitialDiagnosticData } from '../types';

interface TransformerSelectorProps {
  selectedTransformer: TransformerSpec;
  onSelectTransformer: (spec: TransformerSpec) => void;
  initialData?: InitialDiagnosticData;
  onChangeInitialData?: (updated: InitialDiagnosticData) => void;
}

// Opções Normativas Energisa ETU-109.2 (Tabela 16)
const TRIFASICO_POWERS = [15, 30, 45, 75, 112.5, 150, 225, 300];
const MONOFASICO_POWERS = [5, 10, 15, 25, 37.5, 50];

const TRIFASICO_PRIMARY_VOLTAGES = [
  { value: 13800, label: '13.800 V (13,8 kV — Padrão Energisa)' },
  { value: 34500, label: '34.500 V (34,5 kV)' },
  { value: 11400, label: '11.400 V (11,4 kV)' },
  { value: 22000, label: '22.000 V (22,0 kV)' }
];

const MONOFASICO_PRIMARY_VOLTAGES = [
  { value: 19919, label: '19.919 V (19,9 kV)' },
  { value: 13800, label: '13.800 V (13,8 kV)' },
  { value: 12702, label: '12.702 V (12,7 kV)' },
  { value: 7967, label: '7.967 V (7,97 kV — 13,8 kV MRT)' },
  { value: 6582, label: '6.582 V (6,58 kV — 11,4 kV MRT)' }
];

// Níveis de Tensão Secundária do Grupo Energisa (PRODIST Módulo 8)
const ENERGISA_SECONDARY_FF_VOLTAGES = [
  { value: 220, label: '220 V (Padrão Principal Energisa 220/127 V)' },
  { value: 380, label: '380 V (Padrão 380/220 V)' },
  { value: 240, label: '240 V (Rede 240/120 V)' },
  { value: 254, label: '254 V (Rede 254/127 V)' },
  { value: 440, label: '440 V (Rede 440/220 V)' }
];

const ENERGISA_SECONDARY_FN_VOLTAGES = [
  { value: 127, label: '127 V (Padrão Principal Energisa)' },
  { value: 220, label: '220 V (Padrão para Rede 380 V)' },
  { value: 110, label: '110 V (Rede 220/110 V)' },
  { value: 115, label: '115 V (Rede 230/115 V)' },
  { value: 120, label: '120 V (Rede 240/120 V)' }
];

export const TransformerSelector: React.FC<TransformerSelectorProps> = ({
  selectedTransformer,
  onSelectTransformer,
  initialData,
  onChangeInitialData
}) => {
  const phaseType = selectedTransformer.phaseType || 'TRIFASICO';
  const powerKva = selectedTransformer.powerKva || 0;
  const primaryVoltageV = selectedTransformer.primaryVoltageV || 0;
  const secondaryVoltageV = selectedTransformer.secondaryVoltageV || 0;
  const secondaryNeutralV = selectedTransformer.secondaryNeutralV || 0;

  const updateField = (patch: Partial<TransformerSpec>) => {
    const updated: TransformerSpec = {
      ...selectedTransformer,
      ...patch,
      id: initialData?.transformerTag?.trim() || selectedTransformer.id || `TRAFO-${patch.powerKva ?? selectedTransformer.powerKva ?? 0}kVA`,
      brand: initialData?.transformerBrand ?? selectedTransformer.brand,
      standardReference: 'Dados Básicos Coletados em Campo (Técnico / Energisa ETU-109.2)'
    };
    onSelectTransformer(updated);
  };

  const handlePhaseChange = (newPhase: PhaseType) => {
    const defaultPower = newPhase === 'TRIFASICO' ? 112.5 : 15;
    const defaultPrimary = newPhase === 'TRIFASICO' ? 13800 : 7967;
    updateField({
      phaseType: newPhase,
      powerKva: defaultPower,
      primaryVoltageV: defaultPrimary
    });
  };

  // Listas de opções conforme a fase selecionada
  const powerList = phaseType === 'TRIFASICO' ? TRIFASICO_POWERS : MONOFASICO_POWERS;
  const primaryList = phaseType === 'TRIFASICO' ? TRIFASICO_PRIMARY_VOLTAGES : MONOFASICO_PRIMARY_VOLTAGES;

  // Handler para troca de Tensão Secundária FF com auto-sugestão do FN correspondente
  const handleSecondaryFfChange = (newFf: number) => {
    let suggestedFn = secondaryNeutralV;
    if (newFf === 220) suggestedFn = 127;
    else if (newFf === 380) suggestedFn = 220;
    else if (newFf === 440) suggestedFn = 220;
    else if (newFf === 240) suggestedFn = 120;
    else if (newFf === 254) suggestedFn = 127;

    updateField({
      secondaryVoltageV: newFf,
      secondaryNeutralV: suggestedFn
    });
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
              Padronização Energisa ETU-109.2 e PRODIST Módulo 8 — selecione rapidamente sem necessidade de digitação
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

      {/* 2. Dados Reais de Campo: Identificação e Localização (com letras maiúsculas travadas) */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/80 space-y-3">
        {initialData && onChangeInitialData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-700/80">
            <div>
              <label className="label-xs mb-1 block">TAG / NÚMERO DO TRANSFORMADOR</label>
              <input
                type="text"
                value={initialData.transformerTag || ''}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  onChangeInitialData({ ...initialData, transformerTag: val });
                  updateField({ id: val || selectedTransformer.id });
                }}
                placeholder="EX: PTCA0121"
                className="w-full uppercase bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:bg-white dark:focus:bg-slate-950 focus:border-amber-500 focus:outline-none tracking-wider"
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div>
              <label className="label-xs mb-1 block">MARCA / FABRICANTE</label>
              <input
                type="text"
                value={initialData.transformerBrand || ''}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  onChangeInitialData({ ...initialData, transformerBrand: val });
                  updateField({ brand: val });
                }}
                placeholder="EX: TRAEL, WEG, ROMAGNOLE"
                className="w-full uppercase bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none tracking-wider"
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div>
              <label className="label-xs mb-1 block">LOCAL / ALIMENTADOR</label>
              <input
                type="text"
                value={initialData.locationName || ''}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  onChangeInitialData({ ...initialData, locationName: val });
                }}
                placeholder="EX: CAC-03 (CACOAL - RO)"
                className="w-full uppercase bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none tracking-wider"
                style={{ textTransform: 'uppercase' }}
              />
            </div>
          </div>
        )}

        {/* 3. Grandezas Elétricas Básicas Selecionadas via Base Normativa Energisa ETU-109.2 / PRODIST */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Potência kVA — Lista Normativa Energisa ETU-109.2 */}
          <div>
            <label className="label-xs mb-1 block text-slate-700 dark:text-slate-300 font-bold">
              POTÊNCIA NOMINAL (kVA)
            </label>
            <select
              value={powerKva}
              onChange={(e) => updateField({ powerKva: Number(e.target.value) })}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-blue-700 dark:text-blue-300 focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              {!powerList.includes(powerKva) && powerKva > 0 && (
                <option value={powerKva}>{powerKva} kVA (Personalizado)</option>
              )}
              {powerList.map((p) => (
                <option key={p} value={p}>
                  {p.toLocaleString('pt-BR')} kVA {p === 112.5 ? '★ (Padrão NDU/ETU)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Tensão Primária — Lista Normativa Energisa ETU-109.2 */}
          <div>
            <label className="label-xs mb-1 block text-slate-700 dark:text-slate-300 font-bold">
              TENSÃO PRIMÁRIA (V)
            </label>
            <select
              value={primaryVoltageV}
              onChange={(e) => updateField({ primaryVoltageV: Number(e.target.value) })}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-blue-700 dark:text-blue-300 focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              {!primaryList.some((item) => item.value === primaryVoltageV) && primaryVoltageV > 0 && (
                <option value={primaryVoltageV}>{primaryVoltageV} V (Personalizado)</option>
              )}
              {primaryList.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tensão Secundária F-F — Grupo Energisa (PRODIST Módulo 8) */}
          <div>
            <label className="label-xs mb-1 block text-slate-700 dark:text-slate-300 font-bold">
              TENSÃO SEC. FASE-FASE (V)
            </label>
            <select
              value={secondaryVoltageV}
              onChange={(e) => handleSecondaryFfChange(Number(e.target.value))}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-blue-700 dark:text-blue-300 focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              {!ENERGISA_SECONDARY_FF_VOLTAGES.some((item) => item.value === secondaryVoltageV) && secondaryVoltageV > 0 && (
                <option value={secondaryVoltageV}>{secondaryVoltageV} V (Personalizado)</option>
              )}
              {ENERGISA_SECONDARY_FF_VOLTAGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tensão Secundária F-N — Grupo Energisa (PRODIST Módulo 8) */}
          <div>
            <label className="label-xs mb-1 block text-slate-700 dark:text-slate-300 font-bold">
              TENSÃO SEC. FASE-NEUTRO (V)
            </label>
            <select
              value={secondaryNeutralV}
              onChange={(e) => updateField({ secondaryNeutralV: Number(e.target.value) })}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-blue-700 dark:text-blue-300 focus:border-blue-500 focus:outline-none cursor-pointer"
            >
              {!ENERGISA_SECONDARY_FN_VOLTAGES.some((item) => item.value === secondaryNeutralV) && secondaryNeutralV > 0 && (
                <option value={secondaryNeutralV}>{secondaryNeutralV} V (Personalizado)</option>
              )}
              {ENERGISA_SECONDARY_FN_VOLTAGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
