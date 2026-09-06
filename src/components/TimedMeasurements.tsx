import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Play, RotateCcw, Trash2, Clock, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { MeasurementCycleMode, SingleMeasurement, TransformerSpec } from '../types';
import { getMissingMeasurementFields, processSingleMeasurement } from '../utils/electricalCalculations';

interface TimedMeasurementsProps {
  measurements: SingleMeasurement[];
  onChangeMeasurement: (index: number, updated: SingleMeasurement) => void;
  onAddMeasurement?: () => void;
  onRemoveMeasurement?: (index: number) => void;
  onSetMeasurementsCount?: (count: number) => void;
  selectedTransformer: TransformerSpec;
  cycleMode: MeasurementCycleMode;
  onCycleModeChange: (mode: MeasurementCycleMode) => void;
  onAllCompleted?: () => void;
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

const STORAGE_TIMER_KEY = 'ferracine_active_countdown';

export const TimedMeasurements: React.FC<TimedMeasurementsProps> = ({
  measurements,
  onChangeMeasurement,
  onAddMeasurement,
  onRemoveMeasurement,
  onSetMeasurementsCount,
  selectedTransformer,
  cycleMode,
  onCycleModeChange,
  onAllCompleted
}) => {
  const isTri = selectedTransformer.phaseType === 'TRIFASICO';

  // Estado de liberação individual de cada célula (M1, M2, M3)
  // Iniciam desbloqueadas apenas se já possuem dados gravados / restaurados do rascunho
  const [unlocked, setUnlocked] = useState<boolean[]>(() => [
    Boolean(measurements[0]?.isRecorded || (measurements[0]?.van || 0) > 0 || (measurements[0]?.vab || 0) > 0),
    Boolean(measurements[1]?.isRecorded || (measurements[1]?.van || 0) > 0 || (measurements[1]?.vab || 0) > 0),
    Boolean(measurements[2]?.isRecorded || (measurements[2]?.van || 0) > 0 || (measurements[2]?.vab || 0) > 0)
  ]);

  // Identifica qual célula deve ser a próxima a ser medida / aguardando cronômetro
  const activeTargetIndex = unlocked[0]
    ? measurements.length >= 2 && !unlocked[1]
      ? 1
      : measurements.length === 3 && !unlocked[2]
      ? 2
      : null
    : 0;

  const [timerSeconds, setTimerSeconds] = useState<number>(() => getCycleDurationSeconds(cycleMode));
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [validationMsg, setValidationMsg] = useState<{ index: number; text: string; isError: boolean } | null>(null);

  // Refs para controle temporal absoluto e background
  const targetEndTimeRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const workerRef = useRef<Worker | null>(null);

  // Efeito para ajustar o tempo inicial quando o modo de ciclo for alterado e o timer estiver parado
  const prevCycleModeRef = useRef<MeasurementCycleMode>(cycleMode);
  useEffect(() => {
    if (prevCycleModeRef.current !== cycleMode) {
      prevCycleModeRef.current = cycleMode;
      if (!isTimerRunning) {
        setTimerSeconds(getCycleDurationSeconds(cycleMode));
        targetEndTimeRef.current = null;
        try {
          localStorage.removeItem(STORAGE_TIMER_KEY);
        } catch {
          // ignore
        }
      }
    }
  }, [cycleMode, isTimerRunning]);

  // Função para liberar a medição alvo quando o tempo expira
  const unlockTargetMeasurement = useCallback((targetIdx: number) => {
    setUnlocked((prev) => {
      const updated = [...prev];
      updated[targetIdx] = true;
      return updated;
    });

    if (measurements[targetIdx]) {
      onChangeMeasurement(targetIdx, {
        ...measurements[targetIdx],
        isLocked: false
      });
    }

    setIsTimerRunning(false);
    targetEndTimeRef.current = null;
    try {
      localStorage.removeItem(STORAGE_TIMER_KEY);
    } catch {
      // ignore
    }

    // Libera Wake Lock se houver
    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
      } catch {
        // ignore
      }
      wakeLockRef.current = null;
    }

    // Prepara o timer com o valor padrão para o próximo ciclo
    setTimerSeconds(getCycleDurationSeconds(cycleMode));
  }, [cycleMode, measurements, onChangeMeasurement]);

  // Função central de sincronização temporal (Tick & Retorno de segundo plano)
  const syncTimerState = useCallback(() => {
    if (!targetEndTimeRef.current) return;
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((targetEndTimeRef.current - now) / 1000));

    if (remaining <= 0) {
      const currentTarget = activeTargetIndex ?? 0;
      unlockTargetMeasurement(currentTarget);
    } else {
      setTimerSeconds(remaining);
    }
  }, [activeTargetIndex, unlockTargetMeasurement]);

  // Gerenciamento de Web Worker inline em Blob para tick em segundo plano
  useEffect(() => {
    const workerScript = `
      let interval = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (interval) clearInterval(interval);
          interval = setInterval(function() {
            self.postMessage('tick');
          }, 500);
        } else if (e.data === 'stop') {
          if (interval) clearInterval(interval);
          interval = null;
        }
      };
    `;

    try {
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));
      workerRef.current = worker;

      worker.onmessage = (e) => {
        if (e.data === 'tick') {
          syncTimerState();
        }
      };

      return () => {
        worker.terminate();
        workerRef.current = null;
      };
    } catch {
      return undefined;
    }
  }, [syncTimerState]);

  // Listener para sincronização imediata em segundo plano / tela bloqueada
  useEffect(() => {
    const handleResume = () => {
      syncTimerState();
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);
    window.addEventListener('pageshow', handleResume);

    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('pageshow', handleResume);
    };
  }, [syncTimerState]);

  // Fallback com setInterval na thread principal
  useEffect(() => {
    let mainInterval: any = null;
    if (isTimerRunning) {
      mainInterval = setInterval(() => {
        syncTimerState();
      }, 500);
    }
    return () => {
      if (mainInterval) clearInterval(mainInterval);
    };
  }, [isTimerRunning, syncTimerState]);

  // Iniciar Contador
  const handleStartTimer = (cellIndex: number) => {
    const duration = timerSeconds > 0 ? timerSeconds : getCycleDurationSeconds(cycleMode);
    const end = Date.now() + duration * 1000;
    targetEndTimeRef.current = end;
    setTimerSeconds(duration);
    setIsTimerRunning(true);

    // Persiste no localStorage para resistir a reloads ou fechamentos acidentais
    try {
      localStorage.setItem(STORAGE_TIMER_KEY, JSON.stringify({ cellIndex, end }));
    } catch {
      // ignore
    }

    // Inicia worker
    if (workerRef.current) {
      workerRef.current.postMessage('start');
    }

    // Requisita Wake Lock de tela se disponível
    if ('wakeLock' in navigator && (navigator as any).wakeLock?.request) {
      (navigator as any).wakeLock.request('screen').then((lock: any) => {
        wakeLockRef.current = lock;
      }).catch(() => {});
    }
  };

  // Parar Contador: RESETA para o valor inicial do ciclo (NÃO pausa)
  const handleStopAndResetTimer = () => {
    setIsTimerRunning(false);
    targetEndTimeRef.current = null;
    const defaultDuration = getCycleDurationSeconds(cycleMode);
    setTimerSeconds(defaultDuration);

    try {
      localStorage.removeItem(STORAGE_TIMER_KEY);
    } catch {
      // ignore
    }

    if (workerRef.current) {
      workerRef.current.postMessage('stop');
    }

    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
      } catch {
        // ignore
      }
      wakeLockRef.current = null;
    }
  };

  // Alteração de Quantidade de Medições (1, 2 ou 3)
  const handleSetCount = (targetCount: number) => {
    if (onSetMeasurementsCount) {
      onSetMeasurementsCount(targetCount);
      return;
    }
    if (targetCount === 1) {
      if (measurements.length === 3 && onRemoveMeasurement) {
        onRemoveMeasurement(2);
        onRemoveMeasurement(1);
      } else if (measurements.length === 2 && onRemoveMeasurement) {
        onRemoveMeasurement(1);
      }
    } else if (targetCount === 2) {
      if (measurements.length === 1 && onAddMeasurement) {
        onAddMeasurement();
      } else if (measurements.length === 3 && onRemoveMeasurement) {
        onRemoveMeasurement(2);
      }
    } else if (targetCount === 3) {
      if (measurements.length === 1 && onAddMeasurement) {
        onAddMeasurement();
        setTimeout(() => onAddMeasurement?.(), 60);
      } else if (measurements.length === 2 && onAddMeasurement) {
        onAddMeasurement();
      }
    }
  };

  // Limpeza de Medição Específica: "APAGAR DADOS DA CÉLULA"
  const handleClearCellData = (measIndex: number) => {
    const current = measurements[measIndex];
    const cleared: SingleMeasurement = {
      ...current,
      van: 0,
      vbn: 0,
      vcn: 0,
      vab: 0,
      vbc: 0,
      vca: 0,
      ia: 0,
      ib: 0,
      ic: 0,
      in: 0,
      totalKva: 0,
      avgVoltagePhasePhase: 0,
      avgVoltagePhaseNeutral: 0,
      avgCurrent: 0,
      loadingPercent: 0,
      fdtpPercent: 0,
      timestamp: '',
      isRecorded: false
    };
    onChangeMeasurement(measIndex, cleared);
    setValidationMsg(null);
  };

  // Manipulação de Valores Digitados
  const handleValueChange = (
    measIndex: number,
    field: keyof SingleMeasurement,
    val: string
  ) => {
    const num = parseFloat(val) || 0;
    const current = measurements[measIndex];

    const updatedRaw = {
      ...current,
      [field]: num
    };

    // Auto-cálculo de tensões correspondentes para agilizar preenchimento
    if (selectedTransformer.phaseType === 'TRIFASICO') {
      if (field === 'van' && num > 0 && current.vab === 0) updatedRaw.vab = Math.round(num * Math.sqrt(3));
      if (field === 'vbn' && num > 0 && current.vbc === 0) updatedRaw.vbc = Math.round(num * Math.sqrt(3));
      if (field === 'vcn' && num > 0 && current.vca === 0) updatedRaw.vca = Math.round(num * Math.sqrt(3));
    } else {
      if (field === 'van' && num > 0 && current.vab === 0) {
        updatedRaw.vab = current.vbn > 0 ? num + current.vbn : num * 2;
      }
      if (field === 'vbn' && num > 0 && current.vab === 0) {
        updatedRaw.vab = current.van > 0 ? current.van + num : num * 2;
      }
    }

    const processed = processSingleMeasurement(updatedRaw, selectedTransformer);
    onChangeMeasurement(measIndex, processed);
  };

  // Botão "VALIDAR DADOS": valida as grandezas da célula atual e, se houver próximo teste, prepara o cronômetro para o próximo ciclo!
  const handleValidateAndProceed = (measIndex: number) => {
    const meas = measurements[measIndex];
    if (!meas) return;

    const missing = getMissingMeasurementFields(meas, selectedTransformer);
    if (missing.length > 0) {
      setValidationMsg({
        index: measIndex,
        text: `Por favor, preencha todos os campos obrigatórios antes de validar: ${missing.join(', ')}.`,
        isError: true
      });
      return;
    }

    setValidationMsg({
      index: measIndex,
      text: `Dados da ${measIndex + 1}ª Medição validados com sucesso!`,
      isError: false
    });

    const updated: SingleMeasurement = {
      ...meas,
      isRecorded: true,
      timestamp: new Date().toLocaleTimeString('pt-BR')
    };
    onChangeMeasurement(measIndex, updated);

    // Se houver próxima medição na campanha que ainda não está desbloqueada:
    const nextIndex = measIndex + 1;
    if (nextIndex < measurements.length && !unlocked[nextIndex]) {
      const cycleSecs = getCycleDurationSeconds(cycleMode);
      setTimerSeconds(cycleSecs);
      // Dispara automaticamente a contagem para a próxima medição
      handleStartTimer(nextIndex);
    } else if (nextIndex >= measurements.length) {
      // Concluiu todos os testes da campanha
      setIsTimerRunning(false);
      targetEndTimeRef.current = null;
      onAllCompleted?.();
    }
  };

  // Rótulo do ciclo por extenso
  const cycleLabel = cycleMode === '1s'
    ? '1 SEGUNDO'
    : cycleMode === '5s'
    ? '5 SEGUNDOS'
    : cycleMode === '5m'
    ? '5 MINUTOS'
    : '10 MINUTOS';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-800 p-4 shadow-xs space-y-4">
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
                ({measurements.length} teste{measurements.length > 1 ? 's' : ''})
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
                  onClick={() => handleSetCount(num)}
                  className={`h-7 px-2 rounded text-xs font-bold font-mono transition cursor-pointer flex items-center justify-center ${
                    measurements.length === num
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

      {/* GRADE DE CÉLULAS E CRONÔMETROS INTEGRADOS (1, 2 OU 3 SLOTS) */}
      <div
        className={`grid grid-cols-1 ${
          measurements.length === 2 ? 'md:grid-cols-2' : measurements.length >= 3 ? 'md:grid-cols-3' : 'max-w-2xl mx-auto'
        } gap-3`}
      >
        {measurements.map((meas, idx) => {
          const measNum = idx + 1;
          const isUnlocked = unlocked[idx];
          const isCurrentActiveTarget = activeTargetIndex === idx;

          const offsetStr = idx === 0
            ? `${cycleMode === '1s' ? '1 segundo' : cycleMode === '5s' ? '5 segundos' : cycleMode === '5m' ? '5 minutos' : '10 minutos'} pós-fechamento`
            : idx === 1
            ? `${cycleMode === '1s' ? '2 segundos' : cycleMode === '5s' ? '10 segundos' : cycleMode === '5m' ? '10 minutos' : '20 minutos'}`
            : `${cycleMode === '1s' ? '3 segundos' : cycleMode === '5s' ? '15 segundos' : cycleMode === '5m' ? '15 minutos' : '30 minutos'}`;

          // CENÁRIO 1: CÉLULA AINDA NÃO LIBERADA PELO CRONÔMETRO
          // Renderiza o CARD DE CRONÔMETRO GRANDE no exato espaço da célula
          if (!isUnlocked) {
            const isWaitingPrevious = idx > 0 && !unlocked[idx - 1];

            return (
              <div
                key={meas.id || idx}
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

                  {/* DISPLAY DIGITAL DO CRONÔMETRO: Fundo Claro no Light, Fundo Escuro no Dark */}
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
                        ? `Aguardando Validação da ${idx}ª Medição`
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

                {/* BOTÕES DE CONTROLE NO ESPAÇO DA CÉLULA */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  {isWaitingPrevious ? (
                    <div className="w-full py-2 px-3 text-center text-xs font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 rounded border border-slate-200 dark:border-slate-700">
                      AGUARDANDO MEDIÇÃO ANTERIOR
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {/* BOTÃO INICIAR CONTADOR */}
                      <button
                        type="button"
                        onClick={() => handleStartTimer(idx)}
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

                      {/* BOTÃO PARAR CONTADOR (RESETA O CRONÔMETRO) */}
                      <button
                        type="button"
                        onClick={handleStopAndResetTimer}
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
          // Renderiza os campos de inserção de grandezas elétricas
          return (
            <div
              key={meas.id || idx}
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
                    {/* Botão APAGAR DADOS DA CÉLULA */}
                    <button
                      type="button"
                      onClick={() => handleClearCellData(idx)}
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
                        onChange={(e) => handleValueChange(idx, 'van', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vbn</span>
                      <input
                        type="number"
                        value={meas.vbn || ''}
                        onChange={(e) => handleValueChange(idx, 'vbn', e.target.value)}
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
                          onChange={(e) => handleValueChange(idx, 'vcn', e.target.value)}
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
                        onChange={(e) => handleValueChange(idx, 'vab', e.target.value)}
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
                            onChange={(e) => handleValueChange(idx, 'vbc', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vca</span>
                          <input
                            type="number"
                            value={meas.vca || ''}
                            onChange={(e) => handleValueChange(idx, 'vca', e.target.value)}
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
                        onChange={(e) => handleValueChange(idx, 'ia', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Ib</span>
                      <input
                        type="number"
                        value={meas.ib || ''}
                        onChange={(e) => handleValueChange(idx, 'ib', e.target.value)}
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
                          onChange={(e) => handleValueChange(idx, 'ic', e.target.value)}
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
                        onChange={(e) => handleValueChange(idx, 'in', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Rodapé do Card com Métricas Instantâneas Sem Abreviações */}
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
                  onClick={() => handleValidateAndProceed(idx)}
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
                      : idx + 1 < measurements.length
                      ? 'VALIDAR DADOS'
                      : 'VALIDAR DADOS E CONCLUIR'}
                  </span>
                </button>

                {validationMsg && validationMsg.index === idx && (
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
        })}
      </div>
    </div>
  );
};
