import React, { useEffect, useRef } from 'react';
import { SingleMeasurement, TransformerSpec } from '../types';

interface HexagonalDiagramProps {
  measurements: SingleMeasurement[];
  selectedTransformer: TransformerSpec;
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  onCanvasRendered?: (dataUrl: string) => void;
}

export const HexagonalDiagram: React.FC<HexagonalDiagramProps> = ({
  measurements,
  selectedTransformer,
  width = 880,
  height = 520,
  theme = 'light',
  onCanvasRendered
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pega a última medição válida ou calcula médias
  const valid = (measurements || []).filter(
    (m) => (m.avgVoltagePhasePhase || 0) > 0 || (m.avgVoltagePhaseNeutral || 0) > 0 || (m.van || 0) > 0 || (m.vab || 0) > 0
  );
  const currentMeas = valid[valid.length - 1] || (measurements && measurements[0]) || {
    van: 0, vbn: 0, vcn: 0,
    vab: 0, vbc: 0, vca: 0,
    ia: 0, ib: 0, ic: 0,
    powerFactor: 0.92,
    fdtpPercent: 0
  };

  const drawDiagram = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isTri = selectedTransformer?.phaseType === 'TRIFASICO';
    const isDark = theme === 'dark';

    // Set pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const centerX = width / 2;
    const centerY = height / 2 - 12;
    const radius = Math.min(width, height) / 2 - 60;

    // Theme Color Palette
    const bgFill = isDark ? '#0f172a' : '#ffffff';
    const titleText = isDark ? '#f8fafc' : '#0f172a';
    const gridAxes = isDark ? '#334155' : '#cbd5e1';
    const outerHexColor = isDark ? '#475569' : '#94a3b8';
    const innerHexColor = isDark ? '#1e293b' : '#e2e8f0';
    const angleText = isDark ? '#94a3b8' : '#475569';
    const vectorLabelText = isDark ? '#f8fafc' : '#0f172a';
    const legendBg = isDark ? '#1e293b' : '#f1f5f9';
    const legendSubText = isDark ? '#94a3b8' : '#475569';

    // Background
    ctx.fillStyle = bgFill;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = titleText;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DIAGRAMA FASORIAL HEXAGONAL DE TENSÃO E CORRENTE', centerX, 26);

    // Draw Hexagonal Grid Matrix (6 axes spaced 60 deg)
    ctx.strokeStyle = gridAxes;
    ctx.lineWidth = 1;

    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle));
      ctx.stroke();
    }

    // Concentric Hexagons (33%, 66%, 100%)
    [0.33, 0.66, 1.0].forEach((scale) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const x = centerX + radius * scale * Math.cos(angle);
        const y = centerY + radius * scale * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = scale === 1.0 ? outerHexColor : innerHexColor;
      ctx.setLineDash(scale === 1.0 ? [] : [4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Outer Hexagon Vertex Labels (0°, 60°, 120°, 180°, 240°, 300°)
    const anglesDeg = [0, 60, 120, 180, 240, 300];
    ctx.fillStyle = angleText;
    ctx.font = '10px sans-serif';
    anglesDeg.forEach((deg) => {
      const rad = (deg * Math.PI) / 180;
      const x = centerX + (radius + 18) * Math.cos(rad);
      const y = centerY + (radius + 18) * Math.sin(rad) + 3;
      ctx.fillText(`${deg}°`, x, y);
    });

    const hasData = (currentMeas.vab || 0) > 0 || (currentMeas.van || 0) > 0 || (currentMeas.ia || 0) > 0;

    if (!hasData) {
      ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AGUARDANDO REGISTRO DE MEDIÇÕES', centerX, centerY - 10);
      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = '11px sans-serif';
      ctx.fillText('Insira os dados de tensão e corrente na 1ª Medição para plotagem do diagrama fasorial', centerX, centerY + 12);
      
      const legendY = height - 28;
      ctx.fillStyle = legendBg;
      ctx.fillRect(10, legendY - 10, width - 20, 30);
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = legendSubText;
      ctx.fillText('Nenhum vetor ativo no momento (Aguardando inserção dos dados de teste)', width / 2, legendY + 8);

      if (onCanvasRendered) {
        onCanvasRendered(canvas.toDataURL('image/png'));
      }
      return;
    }

    if (!isTri) {
      // Single Phase / Bi-phase Simple Vectors
      const nomV = selectedTransformer?.secondaryNeutralV || selectedTransformer?.secondaryVoltageV || 127;
      const scaleV = radius / (nomV * 1.3 || 1);
      const vanVal = currentMeas.van || 0;
      const vbnVal = currentMeas.vbn || 0;
      const vabVal = currentMeas.vab || (vanVal + vbnVal);

      // Vector Van (0 deg)
      if (vanVal > 0) {
        const vLenA = Math.min(vanVal * scaleV, radius);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + vLenA, centerY);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`Van = ${Math.round(vanVal)}V`, centerX + vLenA + 10, centerY);
      }

      // Vector Vbn (180 deg)
      if (vbnVal > 0) {
        const vLenB = Math.min(vbnVal * scaleV, radius);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX - vLenB, centerY);
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#2563eb';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`Vbn = ${Math.round(vbnVal)}V`, centerX - vLenB - 40, centerY);
      }

      // Bottom Legend Box
      const legendY = height - 28;
      ctx.fillStyle = legendBg;
      ctx.fillRect(10, legendY - 10, width - 20, 30);
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = legendSubText;
      ctx.fillText(`Fase Monofásica/Bifásica - Vab Total: ${Math.round(vabVal)}V`, width / 2, legendY + 8);

      if (onCanvasRendered) {
        onCanvasRendered(canvas.toDataURL('image/png'));
      }
      return;
    }

    // Nominal Scaling (Nominal secondary phase-phase or phase-neutral)
    const nomV = selectedTransformer?.secondaryVoltageV || 220;
    const maxV = nomV * 1.25 || 275;
    const vScale = radius / maxV;

    // Phase Voltages (Vab, Vbc, Vca) angles: Vab = 0°, Vbc = 120°, Vca = 240°
    const vabVal = currentMeas.vab || (currentMeas.van ? currentMeas.van * Math.sqrt(3) : 0);
    const vbcVal = currentMeas.vbc || (currentMeas.vbn ? currentMeas.vbn * Math.sqrt(3) : 0);
    const vcaVal = currentMeas.vca || (currentMeas.vcn ? currentMeas.vcn * Math.sqrt(3) : 0);

    const vVectors = [
      { name: 'Vab', val: vabVal, angleDeg: 0, color: '#dc2626' },   // Red
      { name: 'Vbc', val: vbcVal, angleDeg: 120, color: '#16a34a' }, // Green
      { name: 'Vca', val: vcaVal, angleDeg: 240, color: '#2563eb' }  // Blue
    ];

    // Draw Voltage Polygon
    ctx.beginPath();
    const polyPoints: { x: number; y: number }[] = [];
    vVectors.forEach((v) => {
      const rad = (v.angleDeg * Math.PI) / 180;
      const len = Math.min(v.val * vScale, radius * 1.1);
      const x = centerX + len * Math.cos(rad);
      const y = centerY + len * Math.sin(rad);
      polyPoints.push({ x, y });
    });

    if (polyPoints.length >= 3 && polyPoints.every(p => isFinite(p.x) && isFinite(p.y))) {
      ctx.moveTo(polyPoints[0].x, polyPoints[0].y);
      ctx.lineTo(polyPoints[1].x, polyPoints[1].y);
      ctx.lineTo(polyPoints[2].x, polyPoints[2].y);
      ctx.closePath();
      ctx.fillStyle = isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)';
      ctx.fill();
      ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(100, 116, 139, 0.4)';
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Voltage Vectors with Arrowheads
    vVectors.forEach((v) => {
      if (!v.val || v.val <= 0) return;
      const rad = (v.angleDeg * Math.PI) / 180;
      const len = Math.min(v.val * vScale, radius * 1.1);
      const endX = centerX + len * Math.cos(rad);
      const endY = centerY + len * Math.sin(rad);

      if (!isFinite(endX) || !isFinite(endY)) return;

      // Line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Arrowhead
      const headLen = 8;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLen * Math.cos(rad - Math.PI / 6),
        endY - headLen * Math.sin(rad - Math.PI / 6)
      );
      ctx.lineTo(
        endX - headLen * Math.cos(rad + Math.PI / 6),
        endY - headLen * Math.sin(rad + Math.PI / 6)
      );
      ctx.fillStyle = v.color;
      ctx.fill();

      // Text Label
      ctx.fillStyle = vectorLabelText;
      ctx.font = 'bold 11px sans-serif';
      const labelX = centerX + (len + 20) * Math.cos(rad);
      const labelY = centerY + (len + 20) * Math.sin(rad);
      if (isFinite(labelX) && isFinite(labelY)) {
        ctx.fillText(`${v.name}: ${Math.round(v.val)}V`, labelX, labelY);
      }
    });

    // Draw Current Vectors (Dashed lines, scaled to max current)
    const powKva = selectedTransformer?.powerKva || 45;
    const secVoltage = selectedTransformer?.secondaryVoltageV || 220;
    const nomI = (powKva * 1000) / (Math.sqrt(3) * (secVoltage || 1));
    const maxI = Math.max(currentMeas.ia || 0, currentMeas.ib || 0, currentMeas.ic || 0, nomI * 1.2, 1);
    const iScale = (radius * 0.8) / maxI;

    // Lag angle ~ 22.8° for PF = 0.92
    const pfRaw = currentMeas.powerFactor;
    const pf = typeof pfRaw === 'number' && !isNaN(pfRaw) && pfRaw <= 1 && pfRaw >= -1 ? pfRaw : 0.92;
    const pfAngle = Math.acos(pf);

    const iVectors = [
      { name: 'Ia', val: currentMeas.ia || 0, angleDeg: 0 + (pfAngle * 180) / Math.PI, color: '#ea580c' },
      { name: 'Ib', val: currentMeas.ib || 0, angleDeg: 120 + (pfAngle * 180) / Math.PI, color: '#65a30d' },
      { name: 'Ic', val: currentMeas.ic || 0, angleDeg: 240 + (pfAngle * 180) / Math.PI, color: '#0891b2' }
    ];

    iVectors.forEach((iv) => {
      if (!iv.val || iv.val <= 0) return;
      const rad = (iv.angleDeg * Math.PI) / 180;
      const len = Math.min(iv.val * iScale, radius * 0.9);
      const endX = centerX + len * Math.cos(rad);
      const endY = centerY + len * Math.sin(rad);

      if (!isFinite(endX) || !isFinite(endY)) return;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = iv.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = iv.color;
      ctx.font = 'bold 10px sans-serif';
      const lx = centerX + (len + 15) * Math.cos(rad);
      const ly = centerY + (len + 15) * Math.sin(rad);
      if (isFinite(lx) && isFinite(ly)) {
        ctx.fillText(`${iv.name}: ${Math.round(iv.val)}A`, lx, ly);
      }
    });

    // Bottom Legend Box
    const legendY = height - 28;
    ctx.fillStyle = legendBg;
    ctx.fillRect(10, legendY - 10, width - 20, 30);

    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';

    ctx.fillStyle = '#dc2626'; ctx.fillText('■ Vab/Ia', 20, legendY + 8);
    ctx.fillStyle = '#16a34a'; ctx.fillText('■ Vbc/Ib', 110, legendY + 8);
    ctx.fillStyle = '#2563eb'; ctx.fillText('■ Vca/Ic', 200, legendY + 8);
    ctx.fillStyle = legendSubText;
    const fdtpVal = typeof currentMeas.fdtpPercent === 'number' && !isNaN(currentMeas.fdtpPercent) ? currentMeas.fdtpPercent : 0;
    ctx.fillText(`Desbalanço FDTP: ${fdtpVal.toFixed(2)}%`, width - 180, legendY + 8);

    // Notifica callback para exportação em PDF
    if (onCanvasRendered) {
      onCanvasRendered(canvas.toDataURL('image/png'));
    }
  };

  useEffect(() => {
    drawDiagram();
  }, [measurements, selectedTransformer, width, height, theme]);

  return (
    <div className="w-full flex flex-col items-center justify-center">
      <canvas
        ref={canvasRef}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-950 max-w-full h-auto transition-colors duration-200"
      />
    </div>
  );
};
