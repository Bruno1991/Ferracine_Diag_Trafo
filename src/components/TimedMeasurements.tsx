import React, { useState, useEffect, useRef } from 'react';
import { Timer, Lock, Unlock, Play, Pause, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import { MeasurementCycleMode, SingleMeasurement, TransformerSpec } from '../types';
import { isMeasurementComplete, processSingleMeasurement } from '../utils/electricalCalculations';

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

  // Verifica se já existem dados pré-existentes nas medições (ex: draft restaurado)
  const hasM1Data = Boolean(
    measurements[0]?.isRecorded ||
    (measurements[0]?.van || 0) > 0 ||
    (measurements[0]?.vab || 0) > 0 ||
    (measurements[0]?.ia || 0) > 0
  );
  const hasM2Data = Boolean(
    measurements[1]?.isRecorded ||
    (measurements[1]?.van || 0) > 0 ||
    (measurements[1]?.vab || 0) > 0 ||
    (measurements[1]?.ia || 0) > 0
  );
  const hasM3Data = Boolean(
    measurements[2]?.isRecorded ||
    (measurements[2]?.van || 0) > 0 ||
    (measurements[2]?.vab || 0) > 0 ||
    (measurements[2]?.ia || 0) > 0
  );

  // Estados de liberação de cada medição (M1, M2, M3) — células ficam 100% ocultas se false
  const [unlocked, setUnlocked] = useState<boolean[]>([hasM1Data, hasM2Data, hasM3Data]);

  // Se receber dados existentes posteriormente (ex: restauração de draft assíncrona), desbloqueia
  useEffect(() => {
    setUnlocked((prev) => [
      prev[0] || hasM1Data,
      prev[1] || hasM2Data,
      prev[2] || hasM3Data
    ]);
  }, [hasM1Data, hasM2Data, hasM3Data]);

  // Cronômetro Central
  // countdownTarget: 0 para M1 (pós-fechamento), 1 para M2, 2 para M3, ou null se nenhum ativo
  const initialTarget = !hasM1Data ? 0 : (measurements.length >= 2 && !hasM2Data) ? 1 : (measurements.length === 3 && !hasM3Data) ? 2 : null;
  const [countdownTarget, setCountdownTarget] = useState<number | null>(initialTarget);
  const [timerSeconds, setTimerSeconds] = useState<number>(() => getCycleDurationSeconds(cycleMode));
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

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

        // Se desbloqueou M2 ou M3, garante que isLocked fique false na medição
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

  // Regra automática: assim que o usuário preenche todos os dados coletados de tensão e corrente da medição atual,
  // se houver medição seguinte na campanha, inicia automaticamente o contador para ela!
  const hasTriggeredM2Ref = useRef<boolean>(false);
  const hasTriggeredM3Ref = useRef<boolean>(false);

  useEffect(() => {
    // Para M2 (se campanha tiver 2 ou 3 testes)
    if (measurements.length >= 2 && unlocked[0] && !unlocked[1] && !hasTriggeredM2Ref.current) {
      const m1Complete = isMeasurementComplete(measurements[0], selectedTransformer);
      if (m1Complete) {
        hasTriggeredM2Ref.current = true;
        setCountdownTarget(1);
        setTimerSeconds(getCycleDurationSeconds(cycleMode));
        setIsTimerRunning(true);
      }
    }

    // Para M3 (se campanha tiver 3 testes)
    if (measurements.length === 3 && unlocked[1] && !unlocked[2] && !hasTriggeredM3Ref.current) {
      const m2Complete = isMeasurementComplete(measurements[1], selectedTransformer);
      if (m2Complete) {
        hasTriggeredM3Ref.current = true;
        setCountdownTarget(2);
        setTimerSeconds(getCycleDurationSeconds(cycleMode));
        setIsTimerRunning(true);
      }
    }
  }, [measurements, unlocked, selectedTransformer, cycleMode]);

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
    const target = countdownTarget ?? (unlocked[0] ? (unlocked[1] ? 2 : 1) : 0);
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

    // Se limpar M1 ou M2, reseta a trava do auto-trigger para poder disparar novamente se preenchido
    if (measIndex === 0) hasTriggeredM2Ref.current = false;
    if (measIndex === 1) hasTriggeredM3Ref.current = false;
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
              Coleta de tensões e correntes — a 1ª medição ocorre pós-fechamento do transformador. 1 medição é validada como medição instantânea.
            </p>
          </div>
        </div>
      </div>

      {/* PAINEL DE PRÉ-CONFIGURAÇÃO DO TESTE & CRONÔMETRO CENTRAL */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3 border-b border-slate-200 dark:border-slate-700/80">
          {/* 1. SELETOR DE QUANTIDADE DE TESTES */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider block">
              1. QUANTIDADE DE TESTES (1 A 3 MEDIÇÕES)
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleSetCount(1)}
                className={`py-1.5 px-2 rounded text-xs font-bold font-mono transition cursor-pointer flex flex-col items-center justify-center ${
                  measurements.length === 1
                    ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/40'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>1 TESTE</span>
                <span className="text-[9px] font-normal opacity-80">(Instantâneo)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetCount(2)}
                className={`py-1.5 px-2 rounded text-xs font-bold font-mono transition cursor-pointer flex flex-col items-center justify-center ${
                  measurements.length === 2
                    ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/40'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>2 TESTES</span>
                <span className="text-[9px] font-normal opacity-80">(Duplo)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetCount(3)}
                className={`py-1.5 px-2 rounded text-xs font-bold font-mono transition cursor-pointer flex flex-col items-center justify-center ${
                  measurements.length === 3
                    ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/40'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>3 TESTES</span>
                <span className="text-[9px] font-normal opacity-80">(Campanha)</span>
              </button>
            </div>
          </div>

          {/* 2. SELETOR DE INTERVALO DE CICLO */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider block">
              2. INTERVALO DE CICLO TEMPORIZADO
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onCycleModeChange('1s')}
                className={`py-1.5 px-1.5 rounded text-xs font-bold font-mono transition cursor-pointer flex flex-col items-center justify-center ${
                  cycleMode === '1s'
                    ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-500/40'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>1 SEGUNDO</span>
                <span className="text-[9px] font-normal opacity-80">(Teste Rápido)</span>
              </button>

              <button
                type="button"
                onClick={() => onCycleModeChange('5m')}
                className={`py-1.5 px-1.5 rounded text-xs font-bold font-mono transition cursor-pointer flex flex-col items-center justify-center ${
                  cycleMode === '5m'
                    ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/40'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>5 MINUTOS</span>
                <span className="text-[9px] font-normal opacity-80">(Intermediário)</span>
              </button>

              <button
                type="button"
                onClick={() => onCycleModeChange('10m')}
                className={`py-1.5 px-1.5 rounded text-xs font-bold font-mono transition cursor-pointer flex flex-col items-center justify-center ${
                  cycleMode === '10m'
                    ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/40'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>10 MINUTOS</span>
                <span className="text-[9px] font-normal opacity-80">(Recomendado)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. CRONÔMETRO CENTRAL E CONTROLES INTEGRADOS */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            {/* Display Digital do Contador */}
            <div className="bg-slate-950 text-amber-400 font-mono font-extrabold text-2xl py-1.5 px-3.5 rounded shadow-inner border border-slate-800 tracking-widest flex items-center gap-2">
              <Timer className={`w-5 h-5 ${isTimerRunning ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
              <span>{formatTimer(timerSeconds)}</span>
            </div>

            {/* Status Descritivo */}
            <div className="space-y-0.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                {isTimerRunning
                  ? `CONTADOR EM ANDAMENTO — LIBERANDO ${(countdownTarget ?? 0) + 1}ª MEDIÇÃO`
                  : countdownTarget !== null
                  ? `CONTADOR PRONTO — PARA ${(countdownTarget ?? 0) + 1}ª MEDIÇÃO`
                  : 'STATUS DA CAMPANHA TEMPORIZADA'}
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isTimerRunning ? (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block"></span>
                    Aguardando contagem regressiva para liberar a célula...
                  </span>
                ) : countdownTarget !== null ? (
                  <span>Clique em "INICIAR CONTADOR" para disparar a contagem e liberar a célula.</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Célula liberada para inserção de dados coletados.
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
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>INICIAR CONTADOR</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopTimer}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>PARAR CONTADOR</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleBypassUnlockNow}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-xs transition cursor-pointer"
              title="Liberar imediatamente sem aguardar o contador"
            >
              <Unlock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>LIBERAR AGORA</span>
            </button>
          </div>
        </div>
      </div>

      {/* SE NENHUMA CÉLULA ESTIVER LIBERADA AINDA (OCULTA ATÉ TÉRMINO DO CONTADOR) */}
      {!unlocked[0] && (
        <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center space-y-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/60 rounded-full border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 font-mono">
              CÉLULAS DE MEDIÇÃO OCULTAS (AGUARDANDO TÉRMINO DO CONTADOR)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md font-mono">
              A 1ª Célula de Medição está oculta e será exibida automaticamente após a conclusão do contador regressivo ({cycleLabel}), pós-fechamento do transformador.
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
                <span>INICIAR CONTADOR AGORA</span>
              </button>
            ) : (
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping inline-block"></span>
                Contagem em andamento... A célula surgirá ao zerar o tempo.
              </span>
            )}
            <button
              type="button"
              onClick={handleBypassUnlockNow}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-xs transition cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5 text-blue-600" />
              <span>LIBERAR AGORA SEM AGUARDAR</span>
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
                <div>
                  {/* Header do Card */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700 gap-1.5 flex-wrap">
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
                        <span>APAGAR DADOS DA CÉLULA</span>
                      </button>

                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                        <Unlock className="w-3 h-3" /> LIBERADA
                      </span>
                    </div>
                  </div>

                  {/* Inputs Tensões Fase-Neutro */}
                  <div className="mb-2.5">
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
                  <div className="mb-2.5">
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
                  <div className="mb-2.5">
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

                {/* Rodapé do Card com Métricas Instantâneas daquela Medição Sem Abreviações */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-600 dark:text-slate-400">
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
              </div>
            );
          })}
        </div>
      )}

      {/* Aviso quando há medições pendentes para a campanha */}
      {unlocked[0] && measurements.length > visibleCount && (
        <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded border border-blue-200 dark:border-blue-800 text-xs font-mono text-blue-800 dark:text-blue-300 flex items-center justify-between gap-2 flex-wrap">
          <span>
            {measurements.length - visibleCount === 1
              ? `A ${visibleCount + 1}ª Medição está oculta e surgirá automaticamente assim que o próximo ciclo do contador terminar.`
              : `Restam ${measurements.length - visibleCount} medições ocultas que surgirão sequencialmente conforme os ciclos temporizados terminarem.`}
          </span>
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
