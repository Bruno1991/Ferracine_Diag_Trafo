import React from 'react';
import { Clock } from 'lucide-react';
import { MeasurementCycleMode } from '../types';

interface MeasurementTimerControlsProps {
  measurementsCount: number;
  cycleMode: MeasurementCycleMode;
  onSetCount: (count: number) => void;
  onCycleModeChange: (mode: MeasurementCycleMode) => void;
}

export const MeasurementTimerControls: React.FC<MeasurementTimerControlsProps> = ({
  measurementsCount,
  cycleMode,
  onSetCount,
  onCycleModeChange
}) => {
  const cycleLabel = cycleMode === '1s'
    ? '1 SEGUNDO'
    : cycleMode === '5s'
    ? '5 SEGUNDOS'
    : cycleMode === '5m'
    ? '5 MINUTOS'
    : '10 MINUTOS';

  return (
    <>
      {/* Cabeçalho do Módulo */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                3. MEDIÇÕES TEMPORIZADAS (1 A 3 TESTES — INTERVALO DE {cycleLabel})
              </h2>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                ({measurementsCount} teste{measurementsCount > 1 ? 's' : ''})
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              O cronômetro opera diretamente no espaço de cada célula. A célula surge imediatamente ao término da contagem, mantida ativa mesmo com tela bloqueada.
            </p>
          </div>
        </div>
      </div>

      {/* PAINEL DE CONFIGURAÇÃO DE TESTES E INTERVALO */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2.5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* 1. SELETOR DE QUANTIDADE DE TESTES */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider block">
              1. QUANTIDADE DE TESTES (1 A 3 MEDIÇÕES)
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => onSetCount(num)}
                  className={`h-7 px-2 rounded text-xs font-bold font-mono transition cursor-pointer flex items-center justify-center ${
                    measurementsCount === num
                      ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-500'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{num} {num === 1 ? 'TESTE' : 'TESTES'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. SELETOR DE INTERVALO DE CICLO */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider block">
              2. INTERVALO DE CICLO TEMPORIZADO
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onCycleModeChange('1s')}
                title="Opção temporária para testes rápidos de bancada. Esta função será removida do aplicativo futuramente."
                className={`h-7 px-1.5 rounded text-[11px] font-bold font-mono transition cursor-pointer flex items-center justify-center truncate ${
                  cycleMode === '1s'
                    ? 'bg-amber-600 text-white shadow-xs ring-1 ring-amber-500'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="truncate">1s (TESTE PROVISÓRIO)</span>
              </button>

              <button
                type="button"
                onClick={() => onCycleModeChange('5m')}
                className={`h-7 px-1.5 rounded text-xs font-bold font-mono transition cursor-pointer flex items-center justify-center ${
                  cycleMode === '5m'
                    ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-500'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>5 MINUTOS</span>
              </button>

              <button
                type="button"
                onClick={() => onCycleModeChange('10m')}
                className={`h-7 px-1.5 rounded text-xs font-bold font-mono transition cursor-pointer flex items-center justify-center ${
                  cycleMode === '10m'
                    ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-500'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>10 MIN (RECOMENDADO)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
