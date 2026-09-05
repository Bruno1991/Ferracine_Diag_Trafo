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
  height = 540,
  theme = 'light',
  onCanvasRendered
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pega a última medição válida ou calcula médias
  const valid = (measurements || []).filter(
    (m) =>
      (m.avgVoltagePhasePhase || 0) > 0 ||
      (m.avgVoltagePhaseNeutral || 0) > 0 ||
      (m.van || 0) > 0 ||
      (m.vab || 0) > 0 ||
      (m.ia || 0) > 0
  );
  const currentMeas = valid[valid.length - 1] || (measurements && measurements[0]) || {
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
    const centerY = height / 2 - 24;
    const radius = Math.min(width, height) / 2 - 68;

    // Configuração Visual: Fundo SEMPRE branco e linhas cinzas mais escuras para contraste nítido
    const bgFill = '#ffffff';
    const titleText = '#0f172a';
    const gridAxes = '#475569';
    const outerHexColor = '#1e293b';
    const innerHexColor = '#64748b';
    const intermediateAxes = '#94a3b8';
    const legendBg = '#f8fafc';
    const legendBorder = '#cbd5e1';
    const legendSubText = '#334155';

    // Background (Sempre Branco)
    ctx.fillStyle = bgFill;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = titleText;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isTri
        ? 'DIAGRAMA FASORIAL HEXAGONAL — MEDIÇÕES FASE-FASE, FASE-NEUTRO E CORRENTES'
        : 'DIAGRAMA FASORIAL MONOFÁSICO — MEDIÇÕES FASE E NEUTRO',
      centerX,
      24
    );

    // Draw Hexagonal Grid Matrix (6 axes spaced 60 deg)
    ctx.strokeStyle = gridAxes;
    ctx.lineWidth = 1.2;

    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle));
      ctx.stroke();
    }

    // Intermediate 30° dashed axes for phase-phase alignment
    ctx.strokeStyle = intermediateAxes;
    ctx.setLineDash([2, 4]);
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 + Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle));
      ctx.stroke();
    }
    ctx.setLineDash([]);

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
      ctx.lineWidth = scale === 1.0 ? 1.5 : 1;
      ctx.setLineDash(scale === 1.0 ? [] : [3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    const hasData =
      (currentMeas.vab || 0) > 0 ||
      (currentMeas.van || 0) > 0 ||
      (currentMeas.vbn || 0) > 0 ||
      (currentMeas.vcn || 0) > 0 ||
      (currentMeas.ia || 0) > 0;

    if (!hasData) {
      ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AGUARDANDO REGISTRO DE MEDIÇÕES', centerX, centerY - 10);
      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = '11px sans-serif';
      ctx.fillText(
        'Insira as medições de tensão (F-F / F-N) e corrente para plotagem do diagrama fasorial',
        centerX,
        centerY + 12
      );

      const legendY = height - 42;
      ctx.fillStyle = legendBg;
      ctx.fillRect(12, legendY, width - 24, 34);
      ctx.strokeStyle = legendBorder;
      ctx.strokeRect(12, legendY, width - 24, 34);
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = legendSubText;
      ctx.fillText(
        'Nenhum vetor ativo no momento (Aguardando inserção de medições)',
        width / 2,
        legendY + 21
      );

      if (onCanvasRendered) {
        onCanvasRendered(canvas.toDataURL('image/png'));
      }
      return;
    }

    // Helper: Draw Vector with Arrowhead
    const drawVector = (
      name: string,
      val: number,
      angleDeg: number,
      scale: number,
      color: string,
      isDashed: boolean = false,
      unit: string = 'V',
      lineWidth: number = 2.5,
      labelOffset: number = 18
    ) => {
      if (!val || val <= 0) return;
      const rad = (angleDeg * Math.PI) / 180;
      const len = Math.min(val * scale, radius * 1.05);
      const endX = centerX + len * Math.cos(rad);
      const endY = centerY + len * Math.sin(rad);

      if (!isFinite(endX) || !isFinite(endY)) return;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      if (isDashed) ctx.setLineDash([4, 3]);
      ctx.stroke();
      if (isDashed) ctx.setLineDash([]);

      // Arrowhead
      const headLen = lineWidth > 2 ? 8 : 6;
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
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Label
      ctx.fillStyle = color;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      const lx = centerX + (len + labelOffset) * Math.cos(rad);
      const ly = centerY + (len + labelOffset) * Math.sin(rad) + 3;
      if (isFinite(lx) && isFinite(ly)) {
        ctx.fillText(`${name}: ${Math.round(val)}${unit}`, lx, ly);
      }
    };

    if (!isTri) {
      // MONOFÁSICO: Vetores Fase-Neutro (Van e Vbn/Neutro) + Correntes
      const nomV =
        selectedTransformer?.secondaryNeutralV ||
        selectedTransformer?.secondaryVoltageV ||
        127;
      const scaleV = radius / (nomV * 1.3 || 1);
      const vanVal = currentMeas.van || 0;
      const vbnVal = currentMeas.vbn || 0;
      const vabVal = currentMeas.vab || (vanVal + vbnVal);
      const iaVal = currentMeas.ia || 0;
      const inVal = currentMeas.in || 0;

      // Van (Fase A - Neutro, 0°)
      if (vanVal > 0) {
        drawVector('Van', vanVal, 0, scaleV, '#d97706', false, 'V', 3);
      }

      // Vbn (Fase B / Retorno Neutro, 180°)
      if (vbnVal > 0) {
        drawVector('Vbn', vbnVal, 180, scaleV, '#0284c7', false, 'V', 3);
      }

      // Correntes
      const maxI = Math.max(iaVal, inVal, 10);
      const scaleI = (radius * 0.75) / maxI;
      if (iaVal > 0) {
        drawVector('Ia', iaVal, 23, scaleI, '#ea580c', true, 'A', 2);
      }
      if (inVal > 0) {
        drawVector('In', inVal, 180 + 23, scaleI, '#8b5cf6', true, 'A', 2);
      }

      // Bottom Legend Box
      const legendY = height - 44;
      ctx.fillStyle = legendBg;
      ctx.fillRect(12, legendY, width - 24, 36);
      ctx.strokeStyle = legendBorder;
      ctx.strokeRect(12, legendY, width - 24, 36);

      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';

      ctx.fillStyle = '#d97706';
      ctx.fillText(`■ Van (F-N): ${Math.round(vanVal)}V`, 24, legendY + 22);
      if (vbnVal > 0) {
        ctx.fillStyle = '#0284c7';
        ctx.fillText(`■ Vbn (F-N): ${Math.round(vbnVal)}V`, 180, legendY + 22);
      }
      if (vabVal > 0) {
        ctx.fillStyle = '#16a34a';
        ctx.fillText(`■ Vab Total: ${Math.round(vabVal)}V`, 340, legendY + 22);
      }
      if (iaVal > 0) {
        ctx.fillStyle = '#ea580c';
        ctx.fillText(`■ Ia: ${Math.round(iaVal)}A`, 490, legendY + 22);
      }
      if (inVal > 0) {
        ctx.fillStyle = '#8b5cf6';
        ctx.fillText(`■ In (Neutro): ${Math.round(inVal)}A`, 600, legendY + 22);
      }

      if (onCanvasRendered) {
        onCanvasRendered(canvas.toDataURL('image/png'));
      }
      return;
    }

    // ==============================================================
    // TRIFÁSICO: FASE-FASE (Vab, Vbc, Vca) + FASE-NEUTRO (Van, Vbn, Vcn) + CORRENTES (Ia, Ib, Ic, In)
    // ==============================================================
    const nomVff = selectedTransformer?.secondaryVoltageV || 220;
    const maxV = nomVff * 1.25 || 275;
    const vScale = radius / maxV;

    // Phase-to-Neutral Voltages (F-N)
    const vanVal = currentMeas.van || (currentMeas.vab ? currentMeas.vab / Math.sqrt(3) : 0);
    const vbnVal = currentMeas.vbn || (currentMeas.vbc ? currentMeas.vbc / Math.sqrt(3) : 0);
    const vcnVal = currentMeas.vcn || (currentMeas.vca ? currentMeas.vca / Math.sqrt(3) : 0);

    // Phase-to-Phase Voltages (F-F)
    const vabVal = currentMeas.vab || (vanVal ? vanVal * Math.sqrt(3) : 0);
    const vbcVal = currentMeas.vbc || (vbnVal ? vbnVal * Math.sqrt(3) : 0);
    const vcaVal = currentMeas.vca || (vcnVal ? vcnVal * Math.sqrt(3) : 0);

    // 1) Vetores Fase-Neutro (Van, Vbn, Vcn):
    // Eixos simétricos 120°: Van = 0°, Vbn = 240°, Vcn = 120°
    const fnVectors = [
      { name: 'Van', val: vanVal, angleDeg: 0, color: '#d97706' },   // Âmbar / Fase A
      { name: 'Vbn', val: vbnVal, angleDeg: 240, color: '#059669' }, // Esmeralda / Fase B
      { name: 'Vcn', val: vcnVal, angleDeg: 120, color: '#0284c7' }  // Azul Céu / Fase C
    ];

    // Desenha Polígono Estrela de Fase-Neutro
    const fnPoints: { x: number; y: number }[] = [];
    fnVectors.forEach((v) => {
      const rad = (v.angleDeg * Math.PI) / 180;
      const len = Math.min(v.val * vScale, radius * 1.05);
      fnPoints.push({
        x: centerX + len * Math.cos(rad),
        y: centerY + len * Math.sin(rad)
      });
    });

    if (fnPoints.length >= 3 && fnPoints.every((p) => isFinite(p.x) && isFinite(p.y))) {
      ctx.beginPath();
      ctx.moveTo(fnPoints[0].x, fnPoints[0].y);
      ctx.lineTo(fnPoints[2].x, fnPoints[2].y);
      ctx.lineTo(fnPoints[1].x, fnPoints[1].y);
      ctx.closePath();
      ctx.fillStyle = isDark ? 'rgba(217, 119, 6, 0.08)' : 'rgba(217, 119, 6, 0.06)';
      ctx.fill();
      ctx.strokeStyle = isDark ? 'rgba(217, 119, 6, 0.3)' : 'rgba(217, 119, 6, 0.4)';
      ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2) Vetores Fase-Fase (Vab, Vbc, Vca):
    // Ângulos resultantes delta: Vab = 30°, Vbc = 270°, Vca = 150°
    const ffVectors = [
      { name: 'Vab', val: vabVal, angleDeg: 30, color: '#dc2626' },  // Vermelho
      { name: 'Vbc', val: vbcVal, angleDeg: 270, color: '#16a34a' }, // Verde
      { name: 'Vca', val: vcaVal, angleDeg: 150, color: '#2563eb' }  // Azul
    ];

    // Desenha Polígono Delta de Fase-Fase
    const ffPoints: { x: number; y: number }[] = [];
    ffVectors.forEach((v) => {
      const rad = (v.angleDeg * Math.PI) / 180;
      const len = Math.min(v.val * vScale, radius * 1.05);
      ffPoints.push({
        x: centerX + len * Math.cos(rad),
        y: centerY + len * Math.sin(rad)
      });
    });

    if (ffPoints.length >= 3 && ffPoints.every((p) => isFinite(p.x) && isFinite(p.y))) {
      ctx.beginPath();
      ctx.moveTo(ffPoints[0].x, ffPoints[0].y);
      ctx.lineTo(ffPoints[2].x, ffPoints[2].y);
      ctx.lineTo(ffPoints[1].x, ffPoints[1].y);
      ctx.closePath();
      ctx.fillStyle = isDark ? 'rgba(37, 99, 235, 0.08)' : 'rgba(37, 99, 235, 0.05)';
      ctx.fill();
      ctx.strokeStyle = isDark ? 'rgba(59, 130, 246, 0.35)' : 'rgba(37, 99, 235, 0.35)';
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Plota Vetores Fase-Fase (Linha cheia destacada, 2.5px)
    ffVectors.forEach((v) => {
      drawVector(v.name, v.val, v.angleDeg, vScale, v.color, false, 'V', 2.5, 20);
    });

    // Plota Vetores Fase-Neutro (Linha sólida com ponto, 2.5px)
    fnVectors.forEach((v) => {
      drawVector(v.name, v.val, v.angleDeg, vScale, v.color, false, 'V', 2.5, 20);
    });

    // 3) Vetores de Corrente (Ia, Ib, Ic e In)
    const powKva = selectedTransformer?.powerKva || 45;
    const secVoltage = selectedTransformer?.secondaryVoltageV || 220;
    const nomI = (powKva * 1000) / (Math.sqrt(3) * (secVoltage || 1));
    const maxI = Math.max(
      currentMeas.ia || 0,
      currentMeas.ib || 0,
      currentMeas.ic || 0,
      currentMeas.in || 0,
      nomI * 1.2,
      1
    );
    const iScale = (radius * 0.75) / maxI;

    const pfRaw = currentMeas.powerFactor;
    const pf =
      typeof pfRaw === 'number' && !isNaN(pfRaw) && pfRaw <= 1 && pfRaw >= -1
        ? pfRaw
        : 0.92;
    const pfAngleDeg = (Math.acos(pf) * 180) / Math.PI;

    const iVectors = [
      { name: 'Ia', val: currentMeas.ia || 0, angleDeg: 0 - pfAngleDeg, color: '#ea580c' },
      { name: 'Ib', val: currentMeas.ib || 0, angleDeg: 240 - pfAngleDeg, color: '#84cc16' },
      { name: 'Ic', val: currentMeas.ic || 0, angleDeg: 120 - pfAngleDeg, color: '#06b6d4' }
    ];

    iVectors.forEach((iv) => {
      drawVector(iv.name, iv.val, iv.angleDeg, iScale, iv.color, true, 'A', 2, 16);
    });

    // Corrente no Neutro (In) se presente
    const inVal = currentMeas.in || 0;
    if (inVal > 0) {
      const inAngleDeg = 180 - pfAngleDeg;
      drawVector('In', inVal, inAngleDeg, iScale, '#a855f7', true, 'A', 2, 16);
    }

    // ==============================================================
    // Legenda Completa e Painel Analítico
    // ==============================================================
    const legendY = height - 48;
    ctx.fillStyle = legendBg;
    ctx.fillRect(10, legendY, width - 20, 40);
    ctx.strokeStyle = legendBorder;
    ctx.strokeRect(10, legendY, width - 20, 40);

    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';

    // Linha 1: Tensões Fase-Neutro (F-N) e Fase-Fase (F-F)
    ctx.fillStyle = '#d97706';
    ctx.fillText(`Van: ${Math.round(vanVal)}V`, 18, legendY + 16);
    ctx.fillStyle = '#059669';
    ctx.fillText(`Vbn: ${Math.round(vbnVal)}V`, 95, legendY + 16);
    ctx.fillStyle = '#0284c7';
    ctx.fillText(`Vcn: ${Math.round(vcnVal)}V`, 172, legendY + 16);

    ctx.fillStyle = '#dc2626';
    ctx.fillText(`Vab: ${Math.round(vabVal)}V`, 260, legendY + 16);
    ctx.fillStyle = '#16a34a';
    ctx.fillText(`Vbc: ${Math.round(vbcVal)}V`, 335, legendY + 16);
    ctx.fillStyle = '#2563eb';
    ctx.fillText(`Vca: ${Math.round(vcaVal)}V`, 410, legendY + 16);

    // Linha 2: Correntes e Fator de Desbalanço
    ctx.fillStyle = '#ea580c';
    ctx.fillText(`Ia: ${Math.round(currentMeas.ia || 0)}A`, 18, legendY + 31);
    ctx.fillStyle = '#84cc16';
    ctx.fillText(`Ib: ${Math.round(currentMeas.ib || 0)}A`, 95, legendY + 31);
    ctx.fillStyle = '#06b6d4';
    ctx.fillText(`Ic: ${Math.round(currentMeas.ic || 0)}A`, 172, legendY + 31);
    ctx.fillStyle = '#a855f7';
    ctx.fillText(`In (Neutro): ${Math.round(inVal)}A`, 260, legendY + 31);

    ctx.fillStyle = legendSubText;
    const fdtpVal =
      typeof currentMeas.fdtpPercent === 'number' && !isNaN(currentMeas.fdtpPercent)
        ? currentMeas.fdtpPercent
        : 0;
    ctx.fillText(
      `FDTP: ${fdtpVal.toFixed(2)}% | FP: ${pf.toFixed(2)}`,
      width - 200,
      legendY + 24
    );

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
        className="rounded-lg border border-slate-300 shadow-sm bg-white max-w-full h-auto"
      />
    </div>
  );
};
