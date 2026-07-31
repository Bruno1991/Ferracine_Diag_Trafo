import React, { useEffect, useRef, useState } from 'react';
import { SingleMeasurement, TransformerSpec } from '../types';
import { evaluateIticBlock } from '../utils/electricalCalculations';

interface IticCbemaCurveProps {
  measurements: SingleMeasurement[];
  selectedTransformer: TransformerSpec;
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  onCanvasRendered?: (dataUrl: string) => void;
}

export const IticCbemaCurve: React.FC<IticCbemaCurveProps> = ({
  measurements,
  selectedTransformer,
  width = 880,
  height = 520,
  theme = 'light',
  onCanvasRendered
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawCurve = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isDark = theme === 'dark';

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Canvas Background
    ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
    ctx.fillRect(0, 0, width, height);

    drawTemporal3PointChart(ctx, width, height, isDark);

    if (onCanvasRendered) {
      onCanvasRendered(canvas.toDataURL('image/png'));
    }
  };

  /**
   * Renderiza o Gráfico da Janela de 15 min (3 Medições consecutivas a cada 5 min)
   * - Eixo X: Timestamps reais (ex: 14:00, 14:05, 14:10)
   * - Eixo Y1 (Esquerda): Tensão em % (80% a 120%)
   * - Eixo Y2 (Direita): Corrente em A (Escala de Carga)
   * - Linhas Horizontais de Referência: 110% (Sobretensão - Vermelho), 90% (Subtensão - Vermelho), 100% (Nominal - Verde)
   * - Pontos de Tensão: Vermelho se fora dos limites (90%-110%), Verde/Azul se na Zona Segura
   */
  const drawTemporal3PointChart = (ctx: CanvasRenderingContext2D, width: number, height: number, isDark: boolean) => {
    const padLeft = 85;
    const padRight = 85;
    const padTop = 50;
    const padBottom = 65;

    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const nomSecV = selectedTransformer.secondaryVoltageV || 220;
    const iticAnalysis = evaluateIticBlock(measurements, selectedTransformer);

    // Color theme variables
    const titleText = isDark ? '#f8fafc' : '#0f172a';
    const gridLineColor = isDark ? '#1e293b' : '#e2e8f0';
    const vertLineColor = isDark ? '#334155' : '#cbd5e1';
    const tickTextColor = isDark ? '#64748b' : '#475569';
    const axisTitleColor = isDark ? '#cbd5e1' : '#334155';
    const timestampTextColor = isDark ? '#cbd5e1' : '#1e293b';
    const purpleColor = isDark ? '#c084fc' : '#9333ea';
    const legendBg = isDark ? '#1e293b' : '#f1f5f9';

    // Title & Status Badge
    ctx.fillStyle = titleText;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CURVA ITIC — JANELA DE MEDIÇÃO (3 MEDIÇÕES / 15 MIN - REGIME PERMANENTE)', width / 2, 24);

    // Status Banner Subtitle
    if (iticAnalysis.hasViolation) {
      ctx.fillStyle = isDark ? '#ef4444' : '#dc2626';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`[ALERTA DE VIOLAÇÃO ITIC] — ${iticAnalysis.violationCount} medição(ões) fora dos limites (90% - 110%)`, width / 2, 40);
    } else {
      ctx.fillStyle = isDark ? '#22c55e' : '#16a34a';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('[DENTRO DOS LIMITES ITIC] — Todas as medições na Zona Segura em Regime Permanente (90% - 110%)', width / 2, 40);
    }

    // Y1 Axis Scale: Fixed 80% to 120%
    const minVp = 80;
    const maxVp = 120;

    const getY1 = (vp: number) => {
      const ratio = (vp - minVp) / (maxVp - minVp);
      return padTop + chartH - Math.max(0, Math.min(1, ratio)) * chartH;
    };

    // Calculate Y2 (Current A) Scale
    const validMeas = measurements.filter(m => m.avgVoltagePhasePhase > 0 || m.avgVoltagePhaseNeutral > 0);
    const listToDraw = validMeas;
    const maxI = validMeas.length > 0 ? Math.max(...validMeas.map(m => m.avgCurrent), 10) : 100;
    const maxI_scale = Math.ceil((maxI * 1.2) / 10) * 10; // Round up to next 10A

    const getY2 = (iA: number) => {
      const ratio = iA / maxI_scale;
      return padTop + chartH - Math.max(0, Math.min(1, ratio)) * chartH;
    };

    // Draw Shaded Safe Zone Band (90% to 110%)
    const y110 = getY1(110);
    const y90 = getY1(90);
    ctx.fillStyle = isDark ? 'rgba(34, 197, 94, 0.12)' : 'rgba(22, 163, 74, 0.12)'; // Soft green
    ctx.fillRect(padLeft, y110, chartW, y90 - y110);

    // Draw Shaded Overvoltage & Undervoltage Danger Regions
    ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.10)' : 'rgba(220, 38, 38, 0.08)'; // Soft red upper
    ctx.fillRect(padLeft, padTop, chartW, y110 - padTop);
    ctx.fillRect(padLeft, y90, chartW, (padTop + chartH) - y90);

    // Grid Lines for Y1 (Voltage %)
    const y1Ticks = [80, 85, 90, 95, 100, 105, 110, 115, 120];
    ctx.lineWidth = 1;

    y1Ticks.forEach((vp) => {
      const y = getY1(vp);

      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);

      if (vp === 110 || vp === 90) {
        ctx.strokeStyle = isDark ? '#ef4444' : '#dc2626'; // Red dashed limit line
        ctx.setLineDash([6, 4]);
      } else if (vp === 100) {
        ctx.strokeStyle = isDark ? '#22c55e' : '#16a34a'; // Green dashed nominal line
        ctx.setLineDash([4, 3]);
      } else {
        ctx.strokeStyle = gridLineColor; // Grid
        ctx.setLineDash([2, 4]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Y1 Left Ticks Text
      if (vp === 110) {
        ctx.fillStyle = isDark ? '#ef4444' : '#dc2626';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('110% (Máx)', padLeft - 8, y);
      } else if (vp === 90) {
        ctx.fillStyle = isDark ? '#ef4444' : '#dc2626';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('90% (Mín)', padLeft - 8, y);
      } else if (vp === 100) {
        ctx.fillStyle = isDark ? '#22c55e' : '#16a34a';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('100% (Nom)', padLeft - 8, y);
      } else {
        ctx.fillStyle = tickTextColor;
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${vp}%`, padLeft - 8, y);
      }
    });

    // Y2 Right Ticks Text (Current A)
    const y2Ticks = [0, maxI_scale * 0.25, maxI_scale * 0.5, maxI_scale * 0.75, maxI_scale];
    y2Ticks.forEach((iVal) => {
      const y = getY2(iVal);
      ctx.fillStyle = purpleColor; // Purple for Y2
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(iVal)} A`, width - padRight + 8, y);
    });

    ctx.textBaseline = 'alphabetic';

    if (validMeas.length === 0) {
      ctx.fillStyle = axisTitleColor;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EIXO TEMPORAL — HORÁRIO DAS MEDIÇÕES (JANELA DE 15 MIN / INTERVALOS DE 5 MIN)', width / 2, height - 16);

      ctx.save();
      ctx.translate(20, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText('TENSÃO MEDIDA (% NOMINAL)', 0, 0);
      ctx.restore();

      ctx.save();
      ctx.translate(width - 18, height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillStyle = purpleColor;
      ctx.fillText('CORRENTE DE CARGA (A)', 0, 0);
      ctx.restore();

      ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AGUARDANDO REGISTRO DE MEDIÇÕES', width / 2, height / 2 - 10);
      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = '11px sans-serif';
      ctx.fillText('Insira os dados na 1ª Medição para iniciar a plotagem da curva ITIC / CBEMA', width / 2, height / 2 + 12);

      const legendY = height - 28;
      ctx.fillStyle = legendBg;
      ctx.fillRect(12, legendY - 10, width - 24, 30);
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.fillText('Nenhuma medição registrada no momento (Gráfico limpo)', width / 2, legendY + 8);

      return;
    }

    // X Axis Timestamps
    const count = listToDraw.length;
    const getX = (idx: number) => {
      if (count === 1) return padLeft + chartW / 2;
      return padLeft + (idx / (count - 1)) * chartW;
    };

    // Draw Vertical Time Grid Lines
    listToDraw.forEach((m, idx) => {
      const x = getX(idx);
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + chartH);
      ctx.strokeStyle = vertLineColor;
      ctx.setLineDash([2, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      const ts = m.timestamp || `14:0${idx * 5}`;
      ctx.fillStyle = timestampTextColor;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`M${m.id} (${ts})`, x, height - padBottom + 20);
    });

    // Axis Titles
    ctx.fillStyle = axisTitleColor;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EIXO TEMPORAL — HORÁRIO DAS MEDIÇÕES (JANELA DE 15 MIN / INTERVALOS DE 5 MIN)', width / 2, height - 16);

    // Left Y Axis Title
    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('TENSÃO MEDIDA (% NOMINAL)', 0, 0);
    ctx.restore();

    // Right Y Axis Title
    ctx.save();
    ctx.translate(width - 18, height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = purpleColor;
    ctx.fillText('CORRENTE DE CARGA (A)', 0, 0);
    ctx.restore();

    // --- PLOT CURVE 1: LOAD CURRENT A (Y2 Secondary Axis) ---
    ctx.beginPath();
    listToDraw.forEach((m, idx) => {
      const x = getX(idx);
      const y = getY2(m.avgCurrent);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = isDark ? '#a855f7' : '#9333ea'; // Purple line for current
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Current Points (Purple Diamonds)
    listToDraw.forEach((m, idx) => {
      const x = getX(idx);
      const y = getY2(m.avgCurrent);

      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.fillStyle = purpleColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Current Tag
      ctx.fillStyle = isDark ? '#e9d5ff' : '#6b21a8';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${m.avgCurrent}A`, x, y - 10);
    });

    // --- PLOT CURVE 2: VOLTAGE % V_percent (Y1 Primary Axis) ---
    ctx.beginPath();
    listToDraw.forEach((m, idx) => {
      const measV = m.avgVoltagePhasePhase > 0 ? m.avgVoltagePhasePhase : m.avgVoltagePhaseNeutral * Math.sqrt(3);
      const vPercent = (measV / nomSecV) * 100;
      const x = getX(idx);
      const y = getY1(vPercent);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = isDark ? '#38bdf8' : '#0284c7'; // Sky blue / ocean blue line
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw Voltage Points & Color Violations Red
    listToDraw.forEach((m, idx) => {
      const measV = m.avgVoltagePhasePhase > 0 ? m.avgVoltagePhasePhase : m.avgVoltagePhaseNeutral * Math.sqrt(3);
      const vPercent = (measV / nomSecV) * 100;
      const x = getX(idx);
      const y = getY1(vPercent);

      const isViolation = vPercent < 90 || vPercent > 110;
      const pointColor = isViolation
        ? (isDark ? '#ef4444' : '#dc2626')
        : (isDark ? '#22c55e' : '#16a34a'); // Red if outside 90%-110%, Green if safe

      // Outer halo for points
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, 2 * Math.PI);
      ctx.fillStyle = isViolation ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)';
      ctx.fill();

      // Point circle
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = pointColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Voltage Text Label Tag
      ctx.fillStyle = isViolation
        ? (isDark ? '#fca5a5' : '#dc2626')
        : (isDark ? '#f8fafc' : '#0f172a');
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const labelText = `${vPercent.toFixed(1)}% (${Math.round(measV)}V)`;
      ctx.fillText(labelText, x, y + 18);
    });

    // Legend at Bottom
    const legendY = height - 28;
    ctx.fillStyle = legendBg;
    ctx.fillRect(12, legendY - 10, width - 24, 30);

    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = isDark ? '#22c55e' : '#16a34a'; ctx.fillText('■ Zona Segura (90%-110%)', 24, legendY + 8);
    ctx.fillStyle = isDark ? '#ef4444' : '#dc2626'; ctx.fillText('--- Limite ITIC (90%/110%)', 180, legendY + 8);
    ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7'; ctx.fillText('● Curva Tensão (%)', 360, legendY + 8);
    ctx.fillStyle = purpleColor; ctx.fillText('◆ Curva Corrente (A)', 500, legendY + 8);
  };

  useEffect(() => {
    drawCurve();
  }, [measurements, selectedTransformer, width, height, theme]);

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
