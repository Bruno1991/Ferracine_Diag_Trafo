import React, { useState, useEffect, useRef } from 'react';
import { Timer, Unlock, Play, Pause, Trash2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
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

  // Estados de liberação de cada medição (M1, M2, M3)
  // TODAS as células iniciam estritamente ocultas, exceto se já foram validadas/registradas anteriormente (draft)
  const [unlocked, setUnlocked] = useState<boolean[]>(() => [
    Boolean(measurements[0]?.isRecorded),
    Boolean(measurements[1]?.isRecorded),
    Boolean(measurements[2]?.isRecorded)
  ]);

  // Se receber restauração de rascunho onde medições já foram gravadas, ou limpeza geral
  useEffect(() => {
    const allClean = measurements.every(
      (m) => !m.isRecorded && (m.van || 0) === 0 && (m.vab || 0) === 0 && (m.ia || 0) === 0
    );
    if (allClean) {
      setUnlocked([false, false, false]);
      setCountdownTarget(0);
      setIsTimerRunning(false);
      return;
    }

    setUnlocked((prev) => [
      prev[0] || Boolean(measurements[0]?.isRecorded),
      prev[1] || Boolean(measurements[1]?.isRecorded),
      prev[2] || Boolean(measurements[2]?.isRecorded)
    ]);
  }, [measurements]);

  // Cronômetro Central
  // countdownTarget: 0 para M1 (pós-fechamento), 1 para M2, 2 para M3, ou null se nenhum ativo
  const getInitialTarget = (): number | null => {
    if (!measurements[0]?.isRecorded) return 0;
    if (measurements.length >= 2 && !measurements[1]?.isRecorded) return 1;
    if (measurements.length === 3 && !measurements[2]?.isRecorded) return 2;
    return null;
  };

  const [countdownTarget, setCountdownTarget] = useState<number | null>(getInitialTarget);
  const [timerSeconds, setTimerSeconds] = useState<number>(() => getCycleDurationSeconds(cycleMode));
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [validationMsg, setValidationMsg] = useState<{ index: number; text: string; isError: boolean } | null>(null);

  // Quando o usuário altera o ciclo e o timer não estiver rodando, ajusta os segundos
  const prevCycleModeRef = useRef<MeasurementCycleMode>(cycleMode);
  useEffect(() => {
    if (prevCycleModeRef.current !== cycleMode) {
      prevCycleModeRef.current = cycleMode;
      if (!isTimerRunning) {
        setTimerSeconds(getCycleDurationSeconds(cycleMode));
      }
    }
  }, [cycleMode, isTimerRunning]);

  // Efeito do Contador Regressivo
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (isTimerRunning && timerSeconds <= 0) {
      setIsTimerRunning(false);
      if (countdownTarget !== null) {
        // Desbloqueia a medição alvo
        const target = countdownTarget;
        setUnlocked((prev) => {
          const updated = [...prev];
          updated[target] = true;
          return updated;
        });
        setCountdownTarget(null);

        // Garante que isLocked fique false na medição desbloqueada
        if (measurements[target]) {
          onChangeMeasurement(target, {
            ...measurements[target],
            isLocked: false
          });
        }
      }
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds, countdownTarget, measurements, onChangeMeasurement]);

  // Controles do Cronômetro Central
  const handleStartTimer = () => {
    if (timerSeconds <= 0) {
      setTimerSeconds(getCycleDurationSeconds(cycleMode));
    }
    if (countdownTarget === null) {
      if (!unlocked[0]) setCountdownTarget(0);
      else if (measurements.length >= 2 && !unlocked[1]) setCountdownTarget(1);
      else if (measurements.length === 3 && !unlocked[2]) setCountdownTarget(2);
      else setCountdownTarget(0);
    }
    setIsTimerRunning(true);
  };

  const handleStopTimer = () => {
    setIsTimerRunning(false);
  };

  const handleBypassUnlockNow = () => {
    setIsTimerRunning(false);
    const target = countdownTarget ?? (!unlocked[0] ? 0 : (!unlocked[1] && measurements.length >= 2) ? 1 : (!unlocked[2] && measurements.length === 3) ? 2 : 0);
    setUnlocked((prev) => {
      const updated = [...prev];
      updated[target] = true;
      return updated;
    });
    setCountdownTarget(null);

    if (measurements[target]) {
      onChangeMeasurement(target, {
        ...measurements[target],
        isLocked: false
      });
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

  // Botão "VALIDAR DADOS": valida as grandezas da célula atual e, se houver próximo teste, dispara o cronômetro para liberar a próxima célula!
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
      setCountdownTarget(nextIndex);
      const cycleSecs = getCycleDurationSeconds(cycleMode);
      setTimerSeconds(cycleSecs);
      setIsTimerRunning(true);
    } else if (nextIndex >= measurements.length) {
      // Concluiu todos os testes da campanha
      setCountdownTarget(null);
      setIsTimerRunning(false);
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

  const visibleCount = measurements.filter((_, idx) => unlocked[idx]).length;

  return (
    <div className="bg-white dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-800 p-4 shadow-xs space-y-4">
      {/* Cabeçalho do Módulo */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                3. MEDIÇÕES TEMPORIZADAS (1 A 3 TESTES - INTERVALO DE {cycleLabel})
              </h2>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                ({measurements.length} medição{measurements.length > 1 ? 'ões' : ''})
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Coleta de tensões e correntes — a 1ª medição ocorre pós-fechamento do transformador. As células permanecem ocultas e surgem apenas ao término de cada cronômetro.
            </p>
          </div>
        </div>
      </div>

      {/* PAINEL DE PRÉ-CONFIGURAÇÃO DO TESTE & CRONÔMETRO CENTRAL */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2.5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-700/80">
          {/* 1. SELETOR DE QUANTIDADE DE TESTES - BOTÕES COMPACTOS */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider block">
              1. QUANTIDADE DE TESTES (1 A 3 MEDIÇÕES)
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleSetCount(1)}
                className={`h-7 px-2 rounded text-xs font-bold font-mono transition cursor-pointer flex items-center justify-center ${
                  measurements.length === 1
                    ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-500'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>1 TESTE</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetCount(2)}
                className={`h-7 px-2 rounded text-xs font-bold font-mono transition cursor-pointer flex items-center justify-center ${
                  measurements.length === 2
                    ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-500'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>2 TESTES</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetCount(3)}
                className={`h-7 px-2 rounded text-xs font-bold font-mono transition cursor-pointer flex items-center justify-center ${
                  measurements.length === 3
                    ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-500'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>3 TESTES</span>
              </button>
            </div>
          </div>

          {/* 2. SELETOR DE INTERVALO DE CICLO - BOTÕES COMPACTOS & RÓTULO PROVISÓRIO */}
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

        {/* 3. CRONÔMETRO CENTRAL E CONTROLES INTEGRADOS */}
        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 shadow-xs">
          <div className="flex items-center gap-3">
            {/* Display Digital do Contador: Fundo Claro no tema Light, Fundo Escuro no tema Dark */}
            <div className="bg-amber-50 dark:bg-slate-950 text-amber-800 dark:text-amber-400 font-mono font-extrabold text-2xl py-1 px-3.5 rounded shadow-inner border border-amber-300 dark:border-slate-800 tracking-widest flex items-center gap-2">
              <Timer className={`w-5 h-5 ${isTimerRunning ? 'text-amber-600 dark:text-amber-400 animate-pulse' : 'text-amber-700/60 dark:text-slate-500'}`} />
              <span>{formatTimer(timerSeconds)}</span>
            </div>

            {/* Status Descritivo */}
            <div className="space-y-0.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                {isTimerRunning
                  ? `CRONÔMETRO EM ANDAMENTO — LIBERANDO ${(countdownTarget ?? 0) + 1}ª CÉLULA`
                  : countdownTarget !== null
                  ? `CRONÔMETRO PRONTO — PARA ${(countdownTarget ?? 0) + 1}ª CÉLULA`
                  : 'CAMPANHA DE MEDIÇÕES TEMPORIZADAS'}
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isTimerRunning ? (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-mono">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block"></span>
                    Contagem regressiva em andamento... A célula surgirá ao zerar.
                  </span>
                ) : countdownTarget !== null ? (
                  <span>Clique em "INICIAR CONTADOR" para disparar o tempo e liberar a célula.</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Célula liberada para inserção e validação de dados.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* BOTÕES DE CONTROLE JUNTO DO CRONÔMETRO */}
          <div className="flex items-center gap-2 flex-wrap justify-end w-full sm:w-auto">
            {!isTimerRunning ? (
              <button
                type="button"
                onClick={handleStartTimer}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>INICIAR CONTADOR</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopTimer}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>PARAR CONTADOR</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleBypassUnlockNow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-xs transition cursor-pointer"
              title="Liberar a célula imediatamente sem aguardar o cronômetro zerar"
            >
              <Unlock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>LIBERAR AGORA</span>
            </button>
          </div>
        </div>
      </div>

      {/* SE NENHUMA CÉLULA ESTIVER LIBERADA AINDA (TODAS OCULTAS ATÉ TÉRMINO DO 1º CONTADOR) */}
      {!unlocked[0] && (
        <div className="p-6 sm:p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center space-y-3">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 rounded-full border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400">
            <Clock className="w-7 h-7 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 font-mono">
              CAMPANHA DE MEDIÇÕES TEMPORIZADAS (CÉLULAS OCULTAS)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md font-mono">
              Todas as células estão ocultas. A 1ª Célula de Medição surgirá automaticamente assim que o primeiro cronômetro ({cycleLabel}) terminar, pós-fechamento do transformador.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1 flex-wrap justify-center">
            {!isTimerRunning ? (
              <button
                type="button"
                onClick={handleStartTimer}
                className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>INICIAR CONTADOR (1º CICLO)</span>
              </button>
            ) : (
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 font-mono flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/50 px-3 py-1.5 rounded border border-amber-200 dark:border-amber-800">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping inline-block"></span>
                Contagem em andamento... A 1ª célula surgirá ao zerar o tempo.
              </span>
            )}
            <button
              type="button"
              onClick={handleBypassUnlockNow}
              className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-xs transition cursor-pointer"
              title="Liberar imediatamente a 1ª célula sem aguardar o tempo"
            >
              <Unlock className="w-3.5 h-3.5 text-blue-600" />
              <span>LIBERAR 1ª CÉLULA AGORA</span>
            </button>
          </div>
        </div>
      )}

      {/* CARDS DE MEDIÇÃO: EXIBE SOMENTE AS CÉLULAS LIBERADAS */}
      {unlocked[0] && (
        <div className={`grid grid-cols-1 ${visibleCount === 2 ? 'md:grid-cols-2' : visibleCount >= 3 ? 'md:grid-cols-3' : 'max-w-2xl mx-auto'} gap-3`}>
          {measurements.map((meas, idx) => {
            // Células bloqueadas permanecem 100% ocultas até o término do contador
            if (!unlocked[idx]) return null;
            const measNum = idx + 1;

            // Rótulo da medição sem abreviações
            const offsetStr = idx === 0
              ? `${cycleMode === '1s' ? '1 segundo' : cycleMode === '5s' ? '5 segundos' : cycleMode === '5m' ? '5 minutos' : '10 minutos'} pós-fechamento`
              : idx === 1
              ? `${cycleMode === '1s' ? '2 segundos' : cycleMode === '5s' ? '10 segundos' : cycleMode === '5m' ? '10 minutos' : '20 minutos'}`
              : `${cycleMode === '1s' ? '3 segundos' : cycleMode === '5s' ? '15 segundos' : cycleMode === '5m' ? '15 minutos' : '30 minutos'}`;

            return (
              <div
                key={meas.id}
                className="rounded border p-3.5 relative flex flex-col justify-between shadow-xs bg-slate-50 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700"
              >
                <div className="space-y-2.5">
                  {/* Header do Card */}
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
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
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
      )}

      {/* Aviso quando há medições pendentes para a campanha */}
      {unlocked[0] && measurements.length > visibleCount && (
        <div className="p-3 bg-blue-50/80 dark:bg-blue-950/50 rounded border border-blue-200 dark:border-blue-800 text-xs font-mono text-blue-800 dark:text-blue-300 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              {isTimerRunning
                ? `Aguarde o término do contador (${formatTimer(timerSeconds)}) para liberação da ${visibleCount + 1}ª Medição.`
                : `A ${visibleCount + 1}ª Medição está oculta. Ela surgirá automaticamente após o término do contador regressivo iniciado ao validar os dados da medição anterior.`}
            </span>
          </div>
          <button
            type="button"
            onClick={handleBypassUnlockNow}
            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] transition cursor-pointer"
          >
            LIBERAR PRÓXIMA AGORA
          </button>
        </div>
      )}
    </div>
  );
};

