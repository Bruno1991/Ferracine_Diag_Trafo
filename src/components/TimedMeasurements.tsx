import React, { useState, useEffect } from 'react';
import { Timer, Lock, Unlock, Play, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { SingleMeasurement, TransformerSpec } from '../types';
import { processSingleMeasurement } from '../utils/electricalCalculations';

interface TimedMeasurementsProps {
  measurements: SingleMeasurement[];
  onChangeMeasurement: (index: number, updated: SingleMeasurement) => void;
  selectedTransformer: TransformerSpec;
  onAllCompleted?: () => void;
}

export const TimedMeasurements: React.FC<TimedMeasurementsProps> = ({
  measurements,
  onChangeMeasurement,
  selectedTransformer,
  onAllCompleted
}) => {
  // Configurable interval cycle (5 seg, 5 min, or 10 min)
  const [cycleMode, setCycleMode] = useState<'5s' | '5m' | '10m'>('5m');
  const intervalSeconds = cycleMode === '5s' ? 5 : cycleMode === '5m' ? 300 : 600;
  const intervalMinutes = cycleMode === '5s' ? 0.0833 : cycleMode === '5m' ? 5 : 10;

  // Timer 1 (Between Meas 1 and Meas 2)
  const [timer1Seconds, setTimer1Seconds] = useState<number>(300);
  const [isTimer1Running, setIsTimer1Running] = useState<boolean>(false);

  // Timer 2 (Between Meas 2 and Meas 3)
  const [timer2Seconds, setTimer2Seconds] = useState<number>(300);
  const [isTimer2Running, setIsTimer2Running] = useState<boolean>(false);

  // Effect for Timer 1
  useEffect(() => {
    let interval: any = null;
    if (isTimer1Running && timer1Seconds > 0) {
      interval = setInterval(() => {
        setTimer1Seconds((prev) => prev - 1);
      }, 1000);
    } else if (timer1Seconds === 0 && isTimer1Running) {
      setIsTimer1Running(false);
      // Unlock Measurement 2
      const updatedMeas2 = {
        ...measurements[1],
        isLocked: false
      };
      onChangeMeasurement(1, updatedMeas2);
    }
    return () => clearInterval(interval);
  }, [isTimer1Running, timer1Seconds]);

  // Effect for Timer 2
  useEffect(() => {
    let interval: any = null;
    if (isTimer2Running && timer2Seconds > 0) {
      interval = setInterval(() => {
        setTimer2Seconds((prev) => prev - 1);
      }, 1000);
    } else if (timer2Seconds === 0 && isTimer2Running) {
      setIsTimer2Running(false);
      // Unlock Measurement 3
      const updatedMeas3 = {
        ...measurements[2],
        isLocked: false
      };
      onChangeMeasurement(2, updatedMeas3);
    }
    return () => clearInterval(interval);
  }, [isTimer2Running, timer2Seconds]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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

    // Auto-calculate phase-phase if phase-neutral entered, or vice versa
    if (selectedTransformer.phaseType === 'TRIFASICO') {
      if (field === 'van' && num > 0 && current.vab === 0) updatedRaw.vab = Math.round(num * Math.sqrt(3));
      if (field === 'vbn' && num > 0 && current.vbc === 0) updatedRaw.vbc = Math.round(num * Math.sqrt(3));
      if (field === 'vcn' && num > 0 && current.vca === 0) updatedRaw.vca = Math.round(num * Math.sqrt(3));
    } else {
      // Monofásico 3 fios (e.g., 120/240V ou 127/254V)
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

  const handleSaveMeas1 = () => {
    const timestamp = new Date().toLocaleTimeString();
    const updated = processSingleMeasurement(
      { ...measurements[0], timestamp },
      selectedTransformer
    );
    onChangeMeasurement(0, updated);

    // Start interval timer for Meas 2
    setTimer1Seconds(intervalSeconds);
    setIsTimer1Running(true);
  };

  const handleSaveMeas2 = () => {
    const timestamp = new Date().toLocaleTimeString();
    const updated = processSingleMeasurement(
      { ...measurements[1], timestamp },
      selectedTransformer
    );
    onChangeMeasurement(1, updated);

    // Start interval timer for Meas 3
    setTimer2Seconds(intervalSeconds);
    setIsTimer2Running(true);
  };

  const handleSaveMeas3 = () => {
    const timestamp = new Date().toLocaleTimeString();
    const updated = processSingleMeasurement(
      { ...measurements[2], timestamp },
      selectedTransformer
    );
    onChangeMeasurement(2, updated);

    if (onAllCompleted) {
      onAllCompleted();
    }
  };

  const handleBypassTimer1 = () => {
    setIsTimer1Running(false);
    setTimer1Seconds(0);
    onChangeMeasurement(1, { ...measurements[1], isLocked: false });
  };

  const handleBypassTimer2 = () => {
    setIsTimer2Running(false);
    setTimer2Seconds(0);
    onChangeMeasurement(2, { ...measurements[2], isLocked: false });
  };

  const isTri = selectedTransformer.phaseType === 'TRIFASICO';

  return (
    <div className="bg-white dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-800 p-4 shadow-xs">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              3. MEDIÇÕES TEMPORIZADAS (3 TESTES - INTERVALO DE {cycleMode === '5s' ? '5 SEG' : cycleMode === '5m' ? '5 MINUTOS' : '10 MINUTOS'})
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Coleta de tensões fase-neutro, fase-fase e correntes para diagnóstico contínuo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded border border-slate-300 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 px-1 font-mono uppercase">CICLO:</span>
            <button
              type="button"
              onClick={() => {
                setCycleMode('5s');
                if (!isTimer1Running) setTimer1Seconds(5);
                if (!isTimer2Running) setTimer2Seconds(5);
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono transition cursor-pointer ${
                cycleMode === '5s'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              5 SEG
            </button>
            <button
              type="button"
              onClick={() => {
                setCycleMode('5m');
                if (!isTimer1Running) setTimer1Seconds(300);
                if (!isTimer2Running) setTimer2Seconds(300);
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono transition cursor-pointer ${
                cycleMode === '5m'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              5 MIN
            </button>
            <button
              type="button"
              onClick={() => {
                setCycleMode('10m');
                if (!isTimer1Running) setTimer1Seconds(600);
                if (!isTimer2Running) setTimer2Seconds(600);
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono transition cursor-pointer ${
                cycleMode === '10m'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              10 MIN
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200">
            <Timer className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-[11px] font-mono font-bold">
              TEMPO RECOMENDADO: {cycleMode === '5s' ? '10 SEG' : cycleMode === '5m' ? '10 MIN' : '20 MIN'}
            </span>
          </div>
        </div>
      </div>

      {/* 3 Columns Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* COLUNA 1: MEDIÇÃO 1 */}
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-300 dark:border-slate-700 p-3 relative flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center font-mono">
                  1
                </span>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">
                  1ª Medição (T = 0 min)
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                LIBERADO
              </span>
            </div>

            {/* Inputs Van, Vbn, Vcn */}
            <div className="mb-2.5">
              <label className="label-xs mb-1 block text-slate-600 dark:text-slate-400">
                TENSÕES FASE-NEUTRO [V]
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Van</span>
                  <input
                    type="number"
                    value={measurements[0].van || ''}
                    onChange={(e) => handleValueChange(0, 'van', e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder=""
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vbn</span>
                  <input
                    type="number"
                    value={measurements[0].vbn || ''}
                    onChange={(e) => handleValueChange(0, 'vbn', e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder=""
                  />
                </div>
                {isTri && (
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vcn</span>
                    <input
                      type="number"
                      value={measurements[0].vcn || ''}
                      onChange={(e) => handleValueChange(0, 'vcn', e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                      placeholder=""
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Inputs Vab, Vbc, Vca */}
            <div className="mb-2.5">
              <label className="label-xs mb-1 block text-slate-600 dark:text-slate-400">
                TENSÕES FASE-FASE [V]
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vab</span>
                  <input
                    type="number"
                    value={measurements[0].vab || ''}
                    onChange={(e) => handleValueChange(0, 'vab', e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder=""
                  />
                </div>
                {isTri && (
                  <>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vbc</span>
                      <input
                        type="number"
                        value={measurements[0].vbc || ''}
                        onChange={(e) => handleValueChange(0, 'vbc', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                        placeholder=""
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vca</span>
                      <input
                        type="number"
                        value={measurements[0].vca || ''}
                        onChange={(e) => handleValueChange(0, 'vca', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                        placeholder=""
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Inputs Ia, Ib, Ic, In */}
            <div className="mb-2.5">
              <label className="label-xs mb-1 block text-slate-600 dark:text-slate-400">
                CORRENTES SECUNDÁRIAS [A]
              </label>
              <div className={`grid gap-1.5 ${isTri ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Ia</span>
                  <input
                    type="number"
                    value={measurements[0].ia || ''}
                    onChange={(e) => handleValueChange(0, 'ia', e.target.value)}
                    className="w-full bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded px-2 py-1 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:outline-none focus:border-amber-500"
                    placeholder=""
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Ib</span>
                  <input
                    type="number"
                    value={measurements[0].ib || ''}
                    onChange={(e) => handleValueChange(0, 'ib', e.target.value)}
                    className="w-full bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded px-2 py-1 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:outline-none focus:border-amber-500"
                    placeholder=""
                  />
                </div>
                {isTri && (
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Ic</span>
                    <input
                      type="number"
                      value={measurements[0].ic || ''}
                      onChange={(e) => handleValueChange(0, 'ic', e.target.value)}
                      className="w-full bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded px-2 py-1 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:outline-none focus:border-amber-500"
                      placeholder=""
                    />
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">In (Neutro)</span>
                  <input
                    type="number"
                    value={measurements[0].in || ''}
                    onChange={(e) => handleValueChange(0, 'in', e.target.value)}
                    className="w-full bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded px-2 py-1 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:outline-none focus:border-amber-500"
                    placeholder=""
                  />
                </div>
              </div>
            </div>

            {/* Calculated Mini Specs */}
            <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 mb-2.5 text-[11px] grid grid-cols-2 gap-1 font-mono text-slate-700 dark:text-slate-300">
              <div>V Média F-F: <span className="text-slate-900 dark:text-slate-100 font-bold">{measurements[0].avgVoltagePhasePhase > 0 ? `${measurements[0].avgVoltagePhasePhase}V` : '—'}</span></div>
              <div>I Média: <span className="text-slate-900 dark:text-slate-100 font-bold">{measurements[0].avgCurrent > 0 ? `${measurements[0].avgCurrent}A` : '—'}</span></div>
              <div>kVA Total: <span className="text-blue-700 dark:text-blue-400 font-bold">{measurements[0].totalKva > 0 ? measurements[0].totalKva : '—'}</span></div>
              <div>Carga: <span className="text-emerald-700 dark:text-emerald-400 font-bold">{measurements[0].loadingPercent > 0 ? `${measurements[0].loadingPercent}%` : '—'}</span></div>
            </div>
          </div>

          <button
            onClick={handleSaveMeas1}
            className="w-full py-1.5 px-3 rounded text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer mt-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>REGISTRAR 1ª MEDIÇÃO (+{cycleMode === '5s' ? '5 SEG' : cycleMode === '5m' ? '5 MIN' : '10 MIN'} TIMER)</span>
          </button>
        </div>


        {/* COLUNA 2: MEDIÇÃO 2 */}
        <div className={`rounded border p-3 relative flex flex-col justify-between transition-all ${
          measurements[1].isLocked
            ? 'bg-slate-100/90 dark:bg-slate-900/80 border-slate-300 dark:border-slate-800'
            : 'bg-slate-50 dark:bg-slate-800/60 border-purple-300 dark:border-purple-800'
        }`}>
          <div>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full font-bold text-xs flex items-center justify-center font-mono ${
                  measurements[1].isLocked ? 'bg-slate-400 text-white' : 'bg-purple-600 text-white'
                }`}>
                  2
                </span>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">
                  2ª Medição (T = {cycleMode === '5s' ? '5 seg' : cycleMode === '5m' ? '5 min' : '10 min'})
                </h3>
              </div>

              {measurements[1].isLocked ? (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> BLOQUEADO
                </span>
              ) : (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <Unlock className="w-3 h-3" /> LIBERADO
                </span>
              )}
            </div>

            {/* If locked, display active countdown timer */}
            {measurements[1].isLocked ? (
              <div className="py-6 text-center flex flex-col items-center justify-center">
                <div className="w-full bg-slate-900 dark:bg-slate-950 text-yellow-400 font-mono font-bold text-xl py-2 px-3 rounded text-center my-2 shadow-inner border border-slate-800 dark:border-slate-700 tracking-widest flex items-center justify-center gap-2">
                  <Timer className="w-5 h-5 text-yellow-400 animate-pulse" />
                  <span>{isTimer1Running ? formatTimer(timer1Seconds) : formatTimer(intervalSeconds)}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono mt-1">
                  {isTimer1Running
                    ? `Aguardando intervalo de ${cycleMode === '5s' ? '5 seg' : `${intervalMinutes} min`}...`
                    : 'Registre a 1ª medição para iniciar o cronômetro.'}
                </p>
              </div>
            ) : (
              <>
                {/* Inputs Van, Vbn, Vcn */}
                <div className="mb-2.5">
                  <label className="label-xs mb-1 block text-slate-600 dark:text-slate-400">
                    TENSÕES FASE-NEUTRO [V]
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Van</span>
                      <input
                        type="number"
                        value={measurements[1].van || ''}
                        onChange={(e) => handleValueChange(1, 'van', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                        placeholder=""
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vbn</span>
                      <input
                        type="number"
                        value={measurements[1].vbn || ''}
                        onChange={(e) => handleValueChange(1, 'vbn', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                        placeholder=""
                      />
                    </div>
                    {isTri && (
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vcn</span>
                        <input
                          type="number"
                          value={measurements[1].vcn || ''}
                          onChange={(e) => handleValueChange(1, 'vcn', e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                          placeholder=""
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Inputs Vab, Vbc, Vca */}
                <div className="mb-2.5">
                  <label className="label-xs mb-1 block text-slate-600 dark:text-slate-400">
                    TENSÕES FASE-FASE [V]
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vab</span>
                      <input
                        type="number"
                        value={measurements[1].vab || ''}
                        onChange={(e) => handleValueChange(1, 'vab', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                        placeholder=""
                      />
                    </div>
                    {isTri && (
                      <>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vbc</span>
                          <input
                            type="number"
                            value={measurements[1].vbc || ''}
                            onChange={(e) => handleValueChange(1, 'vbc', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                            placeholder=""
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vca</span>
                          <input
                            type="number"
                            value={measurements[1].vca || ''}
                            onChange={(e) => handleValueChange(1, 'vca', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                            placeholder=""
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Inputs Ia, Ib, Ic, In */}
                <div className="mb-2.5">
                  <label className="label-xs mb-1 block text-slate-600 dark:text-slate-400">
                    CORRENTES SECUNDÁRIAS [A]
                  </label>
                  <div className={`grid gap-1.5 ${isTri ? 'grid-cols-4' : 'grid-cols-3'}`}>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Ia</span>
                      <input
                        type="number"
                        value={measurements[1].ia || ''}
                        onChange={(e) => handleValueChange(1, 'ia', e.target.value)}
                        className="w-full bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded px-2 py-1 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:outline-none focus:border-purple-500"
                        placeholder=""
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Ib</span>
                      <input
                        type="number"
                        value={measurements[1].ib || ''}
                        onChange={(e) => handleValueChange(1, 'ib', e.target.value)}
                        className="w-full bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded px-2 py-1 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:outline-none focus:border-purple-500"
                        placeholder=""
                      />
                    </div>
                    {isTri && (
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Ic</span>
                        <input
                          type="number"
                          value={measurements[1].ic || ''}
                          onChange={(e) => handleValueChange(1, 'ic', e.target.value)}
                          className="w-full bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded px-2 py-1 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:outline-none focus:border-purple-500"
                          placeholder=""
                        />
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">In (Neutro)</span>
                      <input
                        type="number"
                        value={measurements[1].in || ''}
                        onChange={(e) => handleValueChange(1, 'in', e.target.value)}
                        className="w-full bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded px-2 py-1 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:outline-none focus:border-purple-500"
                        placeholder=""
                      />
                    </div>
                  </div>
                </div>

                {/* Calculated Mini Specs */}
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 mb-2.5 text-[11px] grid grid-cols-2 gap-1 font-mono text-slate-700 dark:text-slate-300">
                  <div>V Média F-F: <span className="text-slate-900 dark:text-slate-100 font-bold">{measurements[1].avgVoltagePhasePhase > 0 ? `${measurements[1].avgVoltagePhasePhase}V` : '—'}</span></div>
                  <div>I Média: <span className="text-slate-900 dark:text-slate-100 font-bold">{measurements[1].avgCurrent > 0 ? `${measurements[1].avgCurrent}A` : '—'}</span></div>
                  <div>kVA Total: <span className="text-blue-700 dark:text-blue-400 font-bold">{measurements[1].totalKva > 0 ? measurements[1].totalKva : '—'}</span></div>
                  <div>Carga: <span className="text-emerald-700 dark:text-emerald-400 font-bold">{measurements[1].loadingPercent > 0 ? `${measurements[1].loadingPercent}%` : '—'}</span></div>
                </div>

                <button
                  onClick={handleSaveMeas2}
                  className="w-full py-1.5 px-3 rounded text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer mt-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>REGISTRAR 2ª MEDIÇÃO (+{cycleMode === '5s' ? '5 SEG' : cycleMode === '5m' ? '5 MIN' : '10 MIN'} TIMER)</span>
                </button>
              </>
            )}
          </div>
        </div>


        {/* COLUNA 3: MEDIÇÃO 3 */}
        <div className={`rounded border p-3 relative flex flex-col justify-between transition-all ${
          measurements[2].isLocked
            ? 'bg-slate-100/90 dark:bg-slate-900/80 border-slate-300 dark:border-slate-800'
            : 'bg-slate-50 dark:bg-slate-800/60 border-emerald-300 dark:border-emerald-800'
        }`}>
          <div>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full font-bold text-xs flex items-center justify-center font-mono ${
                  measurements[2].isLocked ? 'bg-slate-400 text-white' : 'bg-emerald-600 text-white'
                }`}>
                  3
                </span>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">
                  3ª Medição (T = {cycleMode === '5s' ? '10 seg' : cycleMode === '5m' ? '10 min' : '20 min'})
                </h3>
              </div>

              {measurements[2].isLocked ? (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> BLOQUEADO
                </span>
              ) : (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <Unlock className="w-3 h-3" /> LIBERADO
                </span>
              )}
            </div>

            {/* If locked, display active countdown timer */}
            {measurements[2].isLocked ? (
              <div className="py-6 text-center flex flex-col items-center justify-center">
                <div className="w-full bg-slate-900 dark:bg-slate-950 text-yellow-400 font-mono font-bold text-xl py-2 px-3 rounded text-center my-2 shadow-inner border border-slate-800 dark:border-slate-700 tracking-widest flex items-center justify-center gap-2">
                  <Timer className="w-5 h-5 text-yellow-400 animate-pulse" />
                  <span>{isTimer2Running ? formatTimer(timer2Seconds) : formatTimer(intervalSeconds)}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono mt-1">
                  {isTimer2Running
                    ? `Aguardando intervalo de ${cycleMode === '5s' ? '5 seg' : `${intervalMinutes} min`} para a 3ª medição...`
                    : 'Registre a 2ª medição para liberar o timer final.'}
                </p>
              </div>
            ) : (
              <>
                {/* Inputs Van, Vbn, Vcn */}
                <div className="mb-2.5">
                  <label className="label-xs mb-1 block text-slate-600 dark:text-slate-400">
                    TENSÕES FASE-NEUTRO [V]
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Van</span>
                      <input
                        type="number"
                        value={measurements[2].van || ''}
                        onChange={(e) => handleValueChange(2, 'van', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                        placeholder=""
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vbn</span>
                      <input
                        type="number"
                        value={measurements[2].vbn || ''}
                        onChange={(e) => handleValueChange(2, 'vbn', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                        placeholder=""
                      />
                    </div>
                    {isTri && (
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vcn</span>
                        <input
                          type="number"
                          value={measurements[2].vcn || ''}
                          onChange={(e) => handleValueChange(2, 'vcn', e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                          placeholder=""
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Inputs Vab, Vbc, Vca */}
                <div className="mb-2.5">
                  <label className="label-xs mb-1 block text-slate-600 dark:text-slate-400">
                    TENSÕES FASE-FASE [V]
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vab</span>
                      <input
                        type="number"
                        value={measurements[2].vab || ''}
                        onChange={(e) => handleValueChange(2, 'vab', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                        placeholder=""
                      />
                    </div>
                    {isTri && (
                      <>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vbc</span>
                          <input
                            type="number"
                            value={measurements[2].vbc || ''}
                            onChange={(e) => handleValueChange(2, 'vbc', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                            placeholder=""
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Vca</span>
                          <input
                            type="number"
                            value={measurements[2].vca || ''}
                            onChange={(e) => handleValueChange(2, 'vca', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                            placeholder=""
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Inputs Ia, Ib, Ic, In */}
                <div className="mb-2.5">
                  <label className="label-xs mb-1 block text-slate-600 dark:text-slate-400">
                    CORRENTES SECUNDÁRIAS [A]
                  </label>
                  <div className={`grid gap-1.5 ${isTri ? 'grid-cols-4' : 'grid-cols-3'}`}>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Ia</span>
                      <input
                        type="number"
                        value={measurements[2].ia || ''}
                        onChange={(e) => handleValueChange(2, 'ia', e.target.value)}
                        className="w-full bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded px-2 py-1 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:outline-none focus:border-emerald-500"
                        placeholder=""
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Ib</span>
                      <input
                        type="number"
                        value={measurements[2].ib || ''}
                        onChange={(e) => handleValueChange(2, 'ib', e.target.value)}
                        className="w-full bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded px-2 py-1 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:outline-none focus:border-emerald-500"
                        placeholder=""
                      />
                    </div>
                    {isTri && (
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Ic</span>
                        <input
                          type="number"
                          value={measurements[2].ic || ''}
                          onChange={(e) => handleValueChange(2, 'ic', e.target.value)}
                          className="w-full bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded px-2 py-1 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:outline-none focus:border-emerald-500"
                          placeholder=""
                        />
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">In (Neutro)</span>
                      <input
                        type="number"
                        value={measurements[2].in || ''}
                        onChange={(e) => handleValueChange(2, 'in', e.target.value)}
                        className="w-full bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 rounded px-2 py-1 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:outline-none focus:border-emerald-500"
                        placeholder=""
                      />
                    </div>
                  </div>
                </div>

                {/* Calculated Mini Specs */}
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 mb-2.5 text-[11px] grid grid-cols-2 gap-1 font-mono text-slate-700 dark:text-slate-300">
                  <div>V Média F-F: <span className="text-slate-900 dark:text-slate-100 font-bold">{measurements[2].avgVoltagePhasePhase > 0 ? `${measurements[2].avgVoltagePhasePhase}V` : '—'}</span></div>
                  <div>I Média: <span className="text-slate-900 dark:text-slate-100 font-bold">{measurements[2].avgCurrent > 0 ? `${measurements[2].avgCurrent}A` : '—'}</span></div>
                  <div>kVA Total: <span className="text-blue-700 dark:text-blue-400 font-bold">{measurements[2].totalKva > 0 ? measurements[2].totalKva : '—'}</span></div>
                  <div>Carga: <span className="text-emerald-700 dark:text-emerald-400 font-bold">{measurements[2].loadingPercent > 0 ? `${measurements[2].loadingPercent}%` : '—'}</span></div>
                </div>

                <button
                  onClick={handleSaveMeas3}
                  className="w-full py-1.5 px-3 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer mt-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>FINALIZAR 3ª MEDIÇÃO & LAUDO</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
