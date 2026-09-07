import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MeasurementCycleMode, SingleMeasurement, TransformerSpec } from '../types';
import { getMissingMeasurementFields, processSingleMeasurement } from '../utils/electricalCalculations';
import { MeasurementTimerControls } from './MeasurementTimerControls';
import { MeasurementStageCard } from './MeasurementStageCard';

export interface TimedMeasurementsProps {
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

  // Ajusta o tempo inicial quando o modo de ciclo for alterado e o timer estiver parado
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

    try {
      localStorage.setItem(STORAGE_TIMER_KEY, JSON.stringify({ cellIndex, end }));
    } catch {
      // ignore
    }

    if (workerRef.current) {
      workerRef.current.postMessage('start');
    }

    if ('wakeLock' in navigator && (navigator as any).wakeLock?.request) {
      (navigator as any).wakeLock.request('screen').then((lock: any) => {
        wakeLockRef.current = lock;
      }).catch(() => {});
    }
  };

  // Parar Contador: RESETA para o valor inicial do ciclo
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

  // Limpeza de Medição Específica
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

  // Botão "VALIDAR DADOS"
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

    const nextIndex = measIndex + 1;
    if (nextIndex < measurements.length && !unlocked[nextIndex]) {
      const cycleSecs = getCycleDurationSeconds(cycleMode);
      setTimerSeconds(cycleSecs);
      handleStartTimer(nextIndex);
    } else if (nextIndex >= measurements.length) {
      setIsTimerRunning(false);
      targetEndTimeRef.current = null;
      onAllCompleted?.();
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-800 p-4 shadow-xs space-y-4">
      <MeasurementTimerControls
        measurementsCount={measurements.length}
        cycleMode={cycleMode}
        onSetCount={handleSetCount}
        onCycleModeChange={onCycleModeChange}
      />

      {/* GRADE DE CÉLULAS E CRONÔMETROS INTEGRADOS (1, 2 OU 3 SLOTS) */}
      <div
        className={`grid grid-cols-1 ${
          measurements.length === 2 ? 'md:grid-cols-2' : measurements.length >= 3 ? 'md:grid-cols-3' : 'max-w-2xl mx-auto'
        } gap-3`}
      >
        {measurements.map((meas, idx) => (
          <MeasurementStageCard
            key={meas.id || idx}
            index={idx}
            meas={meas}
            isTri={isTri}
            isUnlocked={unlocked[idx]}
            isWaitingPrevious={idx > 0 && !unlocked[idx - 1]}
            isCurrentActiveTarget={activeTargetIndex === idx}
            isTimerRunning={isTimerRunning}
            timerSeconds={timerSeconds}
            cycleMode={cycleMode}
            validationMsg={validationMsg}
            isLastMeasurement={idx + 1 === measurements.length}
            onStartTimer={handleStartTimer}
            onStopAndResetTimer={handleStopAndResetTimer}
            onClearCellData={handleClearCellData}
            onValueChange={handleValueChange}
            onValidateAndProceed={handleValidateAndProceed}
          />
        ))}
      </div>
    </div>
  );
};
