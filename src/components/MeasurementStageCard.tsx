import React from 'react';
import { Timer, Play, RotateCcw, Trash2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { MeasurementCycleMode, SingleMeasurement } from '../types';

interface MeasurementStageCardProps {
  index: number;
  meas: SingleMeasurement;
  isTri: boolean;
  isUnlocked: boolean;
  isWaitingPrevious: boolean;
  isCurrentActiveTarget: boolean;
  isTimerRunning: boolean;
  timerSeconds: number;
  cycleMode: MeasurementCycleMode;
  validationMsg: { index: number; text: string; isError: boolean } | null;
  isLastMeasurement: boolean;
  onStartTimer: (index: number) => void;
  onStopAndResetTimer: () => void;
  onClearCellData: (index: number) => void;
  onValueChange: (index: number, field: keyof SingleMeasurement, val: string) => void;
  onValidateAndProceed: (index: number) => void;
}

function getCycleDurationSeconds(mode: MeasurementCycleMode): number {
  switch (mode) {
    case '1s': return 1;
    case '5s': return 5;
    case '5m': return 300;
    case '10m': return 600;
    default: return 600;
  }
}

function formatTimer(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const MeasurementStageCard: React.FC<MeasurementStageCardProps> = ({
  index,
  meas,
  isTri,
  isUnlocked,
  isWaitingPrevious,
  isCurrentActiveTarget,
  isTimerRunning,
  timerSeconds,
  cycleMode,
  validationMsg,
  isLastMeasurement,
  onStartTimer,
  onStopAndResetTimer,
  onClearCellData,
  onValueChange,
  onValidateAndProceed
}) => {
  const measNum = index + 1;

  const offsetStr = index === 0
    ? `${cycleMode === '1s' ? '1 segundo' : cycleMode === '5s' ? '5 segundos' : cycleMode === '5m' ? '5 minutos' : '10 minutos'} pós-fechamento`
    : index === 1
    ? `${cycleMode === '1s' ? '2 segundos' : cycleMode === '5s' ? '10 segundos' : cycleMode === '5m' ? '10 minutos' : '20 minutos'}`
    : `${cycleMode === '1s' ? '3 segundos' : cycleMode === '5s' ? '15 segundos' : cycleMode === '5m' ? '15 minutos' : '30 minutos'}`;

  // CENÁRIO 1: CÉLULA AINDA NÃO LIBERADA PELO CRONÔMETRO
  if (!isUnlocked) {
    return (
      <div
        key={meas.id || index}
        className="rounded-lg border p-4 relative flex flex-col justify-between shadow-xs bg-slate-50 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 min-h-[420px]"
      >
        {/* Cabeçalho do Card */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 gap-1.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full font-bold text-xs flex items-center justify-center font-mono bg-amber-600 text-white">
              {measNum}
            </span>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">
              {measNum}ª Medição ({offsetStr})
            </h3>
          </div>

          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
            <Clock className="w-3 h-3" /> CÉLULA BLOQUEADA
          </span>
        </div>

        {/* CENTRO: DISPLAY GRANDE DO CRONÔMETRO */}
        <div className="my-auto py-6 flex flex-col items-center justify-center text-center space-y-3">
          <div className="p-3 bg-amber-50 dark:bg-slate-950 rounded-full border border-amber-300 dark:border-slate-800 text-amber-700 dark:text-amber-400 shadow-inner">
            <Timer className={`w-8 h-8 ${isCurrentActiveTarget && isTimerRunning ? 'animate-pulse text-amber-600' : ''}`} />
          </div>

          {/* DISPLAY DIGITAL DO CRONÔMETRO */}
          <div className="w-full max-w-xs bg-amber-50 dark:bg-slate-950 border-2 border-amber-400 dark:border-amber-600/60 text-amber-900 dark:text-amber-300 font-mono font-black text-4xl sm:text-5xl py-3 px-4 rounded-xl shadow-inner tracking-widest flex items-center justify-center">
            <span>
              {isCurrentActiveTarget ? formatTimer(timerSeconds) : formatTimer(getCycleDurationSeconds(cycleMode))}
            </span>
          </div>

          {/* Status Informativo */}
          <div className="space-y-1 max-w-xs">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {isCurrentActiveTarget && isTimerRunning
                ? 'Contagem Regressiva em Andamento'
                : isWaitingPrevious
                ? `Aguardando Validação da ${index}ª Medição`
                : `Cronômetro da ${measNum}ª Medição Pronto`}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              {isCurrentActiveTarget && isTimerRunning ? (
                <span className="text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block"></span>
                  A célula surgirá automaticamente ao zerar o tempo.
                </span>
              ) : isWaitingPrevious ? (
                'Preencha e valide a medição anterior para habilitar esta contagem.'
              ) : (
                'Clique em "INICIAR CONTADOR" para disparar o ciclo.'
              )}
            </p>
          </div>
        </div>

        {/* BOTÕES DE CONTROLE */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          {isWaitingPrevious ? (
            <div className="w-full py-2 px-3 text-center text-xs font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 rounded border border-slate-200 dark:border-slate-700">
              AGUARDANDO MEDIÇÃO ANTERIOR
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onStartTimer(index)}
                disabled={isTimerRunning && isCurrentActiveTarget}
                className={`py-2 px-3 rounded text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer ${
                  isTimerRunning && isCurrentActiveTarget
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-700/20'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>INICIAR CONTADOR</span>
              </button>

              <button
                type="button"
                onClick={onStopAndResetTimer}
                title="Para a contagem e reseta o cronômetro para o tempo inicial do ciclo"
                className="py-2 px-3 rounded text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer bg-rose-600 hover:bg-rose-700 text-white shadow-rose-700/20"
              >
                <RotateCcw className="w-4 h-4" />
                <span>PARAR CONTADOR</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // CENÁRIO 2: CÉLULA LIBERADA PELO CRONÔMETRO
  return (
    <div
      key={meas.id || index}
      className="rounded-lg border p-3.5 relative flex flex-col justify-between shadow-xs bg-slate-50 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 min-h-[420px]"
    >
      <div className="space-y-2.5">
        {/* Header do Card Liberado */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700 gap-1.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full font-bold text-xs flex items-center justify-center font-mono bg-blue-600 text-white">
              {measNum}
            </span>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">
              {measNum}ª Medição ({offsetStr})
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onClearCellData(index)}
              title={`Apagar todos os dados da ${measNum}ª Medição`}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800 transition cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>APAGAR DADOS</span>
            </button>

            {meas.isRecorded ? (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> DADOS VALIDADOS
              </span>
            ) : (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                <Clock className="w-3 h-3" /> AGUARDANDO VALIDAÇÃO
              </span>
            )}
          </div>
        </div>

        {/* Inputs Tensões Fase-Neutro */}
        <div>
          <label className="label-xs mb-1 block text-slate-600 dark:text-slate-400 font-bold">
            TENSÕES FASE-NEUTRO [V]
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Van</span>
              <input
                type="number"
                value={meas.van || ''}
                onChange={(e) => onValueChange(index, 'van', e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vbn</span>
              <input
                type="number"
                value={meas.vbn || ''}
                onChange={(e) => onValueChange(index, 'vbn', e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="0"
              />
            </div>
            {isTri && (
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vcn</span>
                <input
                  type="number"
                  value={meas.vcn || ''}
                  onChange={(e) => onValueChange(index, 'vcn', e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  placeholder="0"
                />
              </div>
            )}
          </div>
        </div>

        {/* Inputs Tensões Fase-Fase */}
        <div>
          <label className="label-xs mb-1 block text-slate-600 dark:text-slate-400 font-bold">
            TENSÕES FASE-FASE [V]
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vab</span>
              <input
                type="number"
                value={meas.vab || ''}
                onChange={(e) => onValueChange(index, 'vab', e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="0"
              />
            </div>
            {isTri && (
              <>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vbc</span>
                  <input
                    type="number"
                    value={meas.vbc || ''}
                    onChange={(e) => onValueChange(index, 'vbc', e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vca</span>
                  <input
                    type="number"
                    value={meas.vca || ''}
                    onChange={(e) => onValueChange(index, 'vca', e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Inputs Correntes */}
        <div>
          <label className="label-xs mb-1 block text-slate-600 dark:text-slate-400 font-bold">
            CORRENTES DE LINHA [A]
          </label>
          <div className={`grid ${isTri ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5`}>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Ia</span>
              <input
                type="number"
                value={meas.ia || ''}
                onChange={(e) => onValueChange(index, 'ia', e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Ib</span>
              <input
                type="number"
                value={meas.ib || ''}
                onChange={(e) => onValueChange(index, 'ib', e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="0"
              />
            </div>
            {isTri && (
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Ic</span>
                <input
                  type="number"
                  value={meas.ic || ''}
                  onChange={(e) => onValueChange(index, 'ic', e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  placeholder="0"
                />
              </div>
            )}
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">In (Neutro)</span>
              <input
                type="number"
                value={meas.in || ''}
                onChange={(e) => onValueChange(index, 'in', e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé do Card com Métricas Instantâneas */}
      <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700/80 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-600 dark:text-slate-400">
        <div>
          <span className="block text-[9px] text-slate-400 uppercase tracking-wider font-sans font-semibold">Tensão Média Fase-Fase</span>
          <strong className="text-slate-800 dark:text-slate-200 text-xs">{meas.avgVoltagePhasePhase} V</strong>
        </div>
        <div>
          <span className="block text-[9px] text-slate-400 uppercase tracking-wider font-sans font-semibold">Carregamento</span>
          <strong className={`text-xs ${meas.loadingPercent > 100 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-800 dark:text-slate-200'}`}>
            {meas.loadingPercent}%
          </strong>
        </div>
        <div>
          <span className="block text-[9px] text-slate-400 uppercase tracking-wider font-sans font-semibold">Corrente Média</span>
          <strong className="text-slate-800 dark:text-slate-200 text-xs">{meas.avgCurrent} A</strong>
        </div>
        <div>
          <span className="block text-[9px] text-slate-400 uppercase tracking-wider font-sans font-semibold">Potência Aparente Total</span>
          <strong className="text-slate-800 dark:text-slate-200 text-xs">{meas.totalKva} kVA</strong>
        </div>
      </div>

      {/* BOTÃO DE VALIDAÇÃO DOS DADOS DA CÉLULA */}
      <div className="pt-2.5 mt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-1.5">
        <button
          type="button"
          onClick={() => onValidateAndProceed(index)}
          className={`w-full py-2 px-3 rounded text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer ${
            meas.isRecorded
              ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-700/20'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          <span>
            {meas.isRecorded
              ? 'DADOS VALIDADOS (CLIQUE PARA REVALIDAR)'
              : !isLastMeasurement
              ? 'VALIDAR DADOS'
              : 'VALIDAR DADOS E CONCLUIR'}
          </span>
        </button>

        {validationMsg && validationMsg.index === index && (
          <div
            className={`p-2 rounded text-[11px] font-mono flex items-start gap-1.5 ${
              validationMsg.isError
                ? 'bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                : 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {validationMsg.isError ? (
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            )}
            <span>{validationMsg.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};
