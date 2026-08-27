import React, { useEffect, useRef } from 'react';
import { MeasurementCycleMode, SingleMeasurement, TransformerSpec } from '../types';
import { performFullDiagnosticAnalysis } from '../utils/electricalCalculations';
import { classifyProdistVoltage } from '../utils/sqliteAndSplitLoader';

interface IticCbemaCurveProps {
  measurements: SingleMeasurement[];
  selectedTransformer: TransformerSpec;
  cycleMode: MeasurementCycleMode;
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  onCanvasRendered?: (dataUrl: string) => void;
}

/**
 * O nome do componente foi preservado para não quebrar imports antigos. O gráfico agora é
 * uma triagem temporal PRODIST; ITIC não é inferida sem duração de eventos transitórios.
 */
export const IticCbemaCurve: React.FC<IticCbemaCurveProps> = ({
  measurements,
  selectedTransformer,
  cycleMode,
  width = 880,
  height = 520,
  theme = 'light',
  onCanvasRendered
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const dark = theme === 'dark';
    const bg = dark ? '#0f172a' : '#ffffff';
    const text = dark ? '#f8fafc' : '#0f172a';
    const muted = dark ? '#94a3b8' : '#475569';
    const grid = dark ? '#334155' : '#e2e8f0';
    const green = dark ? '#22c55e' : '#15803d';
    const amber = dark ? '#fbbf24' : '#b45309';
    const red = dark ? '#fb7185' : '#be123c';
    const purple = dark ? '#c084fc' : '#7e22ce';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const valid = measurements.filter((m) => m.avgVoltagePhasePhase > 0 || m.avgVoltagePhaseNeutral > 0);
    const analysis = performFullDiagnosticAnalysis(measurements, selectedTransformer, cycleMode);
    const nominal = selectedTransformer.secondaryVoltageV || 220;
    const representative = classifyProdistVoltage(nominal, nominal, 'FF');
    const range = representative?.range;
    const adequateMin = range ? range.adequateMinV / nominal * 100 : 93;
    const adequateMax = range ? range.adequateMaxV / nominal * 100 : 105;
    const precariousMin = range ? range.precariousLowMinV / nominal * 100 : 90;
    const precariousMax = range ? range.precariousHighMaxV / nominal * 100 : 107;
    const severity = { ADEQUADA: 0, PRECARIA: 1, CRITICA: 2 } as const;
    const voltagePoints = valid.map((m) => {
      const voltage = m.avgVoltagePhasePhase || m.avgVoltagePhaseNeutral * Math.sqrt(3);
      const phaseVoltages = selectedTransformer.phaseType === 'TRIFASICO' ? [m.vab, m.vbc, m.vca].filter((value) => value > 0) : [voltage];
      const phaseResults = phaseVoltages.map((value) => ({ value, classification: classifyProdistVoltage(value, nominal, 'FF') }));
      const worst = phaseResults.sort((a, b) => severity[b.classification?.status || 'CRITICA'] - severity[a.classification?.status || 'CRITICA'])[0];
      return { m, voltage, percent: voltage / nominal * 100, phaseVoltages, classification: worst?.classification };
    });

    ctx.fillStyle = text;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TRIAGEM TEMPORAL DE TENSÃO E CORRENTE — FAIXAS PRODIST', width / 2, 23);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = analysis.dataQuality.status === 'INCONSISTENTE' ? red : analysis.dataQuality.status === 'ALERTA' ? amber : green;
    const cycleText = cycleMode === '5s' ? '5 s (MODO DE TESTE)' : cycleMode === '5m' ? '5 min' : '10 min';
    ctx.fillText(`QUALIDADE DOS DADOS: ${analysis.dataQuality.status} | CICLO: ${cycleText} | ANOMALIAS: ${analysis.dataQuality.issues.length}`, width / 2, 41);

    const left = 82;
    const right = 82;
    const top = 60;
    const bottom = 72;
    const chartW = width - left - right;
    const chartH = height - top - bottom;
    const measuredPercents = voltagePoints.map((point) => point.percent);
    const minPercent = Math.min(80, precariousMin - 3, ...measuredPercents);
    const maxPercent = Math.max(115, precariousMax + 3, ...measuredPercents);
    const yV = (percent: number) => top + chartH - (percent - minPercent) / (maxPercent - minPercent) * chartH;
    const maxCurrent = Math.max(10, ...valid.map((m) => m.avgCurrent)) * 1.15;
    const yI = (current: number) => top + chartH - current / maxCurrent * chartH;
    const x = (index: number) => valid.length <= 1 ? left + chartW / 2 : left + index / (valid.length - 1) * chartW;

    const fillBand = (from: number, to: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(left, yV(to), chartW, yV(from) - yV(to));
    };
    fillBand(minPercent, precariousMin, dark ? 'rgba(244,63,94,.16)' : 'rgba(244,63,94,.09)');
    fillBand(precariousMin, adequateMin, dark ? 'rgba(245,158,11,.16)' : 'rgba(245,158,11,.10)');
    fillBand(adequateMin, adequateMax, dark ? 'rgba(34,197,94,.16)' : 'rgba(34,197,94,.10)');
    fillBand(adequateMax, precariousMax, dark ? 'rgba(245,158,11,.16)' : 'rgba(245,158,11,.10)');
    fillBand(precariousMax, maxPercent, dark ? 'rgba(244,63,94,.16)' : 'rgba(244,63,94,.09)');

    const ticks = Array.from({ length: 9 }, (_, index) => minPercent + (maxPercent - minPercent) * index / 8);
    ticks.forEach((tick) => {
      ctx.strokeStyle = grid;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(left, yV(tick));
      ctx.lineTo(width - right, yV(tick));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = muted;
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${tick.toFixed(1)}%`, left - 7, yV(tick) + 3);
    });

    [adequateMin, adequateMax].forEach((limit) => {
      ctx.strokeStyle = green;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(left, yV(limit));
      ctx.lineTo(width - right, yV(limit));
      ctx.stroke();
    });
    [precariousMin, precariousMax].forEach((limit) => {
      ctx.strokeStyle = red;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(left, yV(limit));
      ctx.lineTo(width - right, yV(limit));
      ctx.stroke();
      ctx.setLineDash([]);
    });

    if (valid.length === 0) {
      ctx.fillStyle = muted;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AGUARDANDO MEDIÇÕES', width / 2, height / 2);
    } else {
      ctx.strokeStyle = purple;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      valid.forEach((m, index) => index === 0 ? ctx.moveTo(x(index), yI(m.avgCurrent)) : ctx.lineTo(x(index), yI(m.avgCurrent)));
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = dark ? '#38bdf8' : '#0369a1';
      ctx.lineWidth = 3;
      ctx.beginPath();
      voltagePoints.forEach((point, index) => index === 0 ? ctx.moveTo(x(index), yV(point.percent)) : ctx.lineTo(x(index), yV(point.percent)));
      ctx.stroke();

      voltagePoints.forEach((point, index) => {
        const status = point.classification?.status || 'CRITICA';
        const color = status === 'ADEQUADA' ? green : status === 'PRECARIA' ? amber : red;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x(index), yV(point.percent), 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = text;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        const voltageLabel = point.phaseVoltages.length > 1
          ? `${Math.min(...point.phaseVoltages).toFixed(0)}–${Math.max(...point.phaseVoltages).toFixed(0)} V`
          : `${point.voltage.toFixed(1)} V`;
        ctx.fillText(`${voltageLabel} | PIOR: ${status}`, x(index), yV(point.percent) + 20);

        ctx.fillStyle = purple;
        ctx.beginPath();
        ctx.moveTo(x(index), yI(point.m.avgCurrent) - 6);
        ctx.lineTo(x(index) + 6, yI(point.m.avgCurrent));
        ctx.lineTo(x(index), yI(point.m.avgCurrent) + 6);
        ctx.lineTo(x(index) - 6, yI(point.m.avgCurrent));
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = purple;
        const currentLabelY = Math.abs(yI(point.m.avgCurrent) - yV(point.percent)) < 30
          ? yI(point.m.avgCurrent) - 27
          : yI(point.m.avgCurrent) - 10;
        ctx.fillText(`${point.m.avgCurrent.toFixed(1)} A`, x(index), currentLabelY);

        ctx.fillStyle = text;
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`M${point.m.id} ${point.m.timestamp || 'sem horário'}`, x(index), height - bottom + 22);
      });
    }

    ctx.fillStyle = muted;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const rangeText = range
      ? `Sistema ${range.system}: adequada ${range.adequateMinV}–${range.adequateMaxV} V; precária ${range.precariousLowMinV}–${range.precariousHighMaxV} V; fora disso, crítica.`
      : 'Faixas proporcionais de contingência; confirme o banco offline.';
    ctx.fillText(rangeText, width / 2, height - 26);
    ctx.fillText('Verde: adequada | Amarelo: precária | Vermelho: crítica | Roxo: corrente', width / 2, height - 10);

    onCanvasRendered?.(canvas.toDataURL('image/png'));
  }, [measurements, selectedTransformer, cycleMode, width, height, theme, onCanvasRendered]);

  return (
    <div className="w-full flex flex-col items-center justify-center space-y-2">
      <canvas
        ref={canvasRef}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-950 max-w-full h-auto transition-colors duration-200"
      />
    </div>
  );
};
