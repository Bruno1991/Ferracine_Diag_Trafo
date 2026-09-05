import React from 'react';
import { ShieldCheck, AlertOctagon, Zap, Cpu, Activity, ArrowUpRight, CheckCircle2, FileText, FileSpreadsheet } from 'lucide-react';
import { DiagnosticAnalysis, TransformerSpec, InitialDiagnosticData } from '../types';

interface DiagnosticSummaryProps {
  analysis: DiagnosticAnalysis;
  transformer: TransformerSpec;
  initialData: InitialDiagnosticData;
  onExportPdf: () => void;
  onExportExcel: () => void;
}

export const DiagnosticSummary: React.FC<DiagnosticSummaryProps> = ({
  analysis,
  transformer,
  initialData,
  onExportPdf,
  onExportExcel
}) => {
  const isAmedir = analysis.overallAvgPhasePhaseV === 0;
  const isAdequate = !isAmedir && analysis.prodist.voltageStatus === 'ADEQUADA';
  const isPrecarious = !isAmedir && analysis.prodist.voltageStatus === 'PRECARIA';
  const isCritical = !isAmedir && analysis.prodist.voltageStatus === 'CRITICA';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              4. PARECER TÉCNICO E RESULTADOS CONSOLIDADOS
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Cálculos e parametrização extraídos exclusivamente das normas PRODIST Mód 8, NDUs/ETUs e NBR 5440
            </p>
          </div>
        </div>
      </div>

      {/* Qualidade e coerência dos dados de entrada */}
      {!isAmedir && (
        <div className={`p-3 rounded-lg border space-y-2 ${
          analysis.dataQuality.status === 'INCONSISTENTE'
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
            : analysis.dataQuality.status === 'ALERTA'
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
            : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
        }`}>
          <div className="flex items-center gap-2 text-xs font-bold uppercase">
            <AlertOctagon className="w-4 h-4" />
            <span>
              Qualidade dos dados: {analysis.dataQuality.status} — {
                analysis.cycleMode === '5s'
                  ? 'ciclo 5 s (modo de teste)'
                  : analysis.dataQuality.isInstantaneous
                    ? 'Medição Instantânea (10 min pós-fechamento)'
                    : 'ciclo 10 minutos (operação de fato)'
              }
            </span>
          </div>
          {analysis.dataQuality.issues.length === 0 ? (
            <p className="text-[11px] font-mono">Nenhuma inconsistência detectada nas medições informadas.</p>
          ) : (
            <div className="space-y-1">
              {analysis.dataQuality.issues.map((issue, index) => (
                <p key={`${issue.code}-${issue.measurementId || 0}-${index}`} className="text-[11px] font-mono">
                  <strong>{issue.severity === 'CRITICAL' ? 'CRÍTICO' : 'ALERTA'} — {issue.title}:</strong> {issue.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Phase Specific Validation Alerts */}
      {analysis.phaseAlerts && analysis.phaseAlerts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-3 rounded-lg space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
            <AlertOctagon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>ALERTAS DE VALIDAÇÃO DE FASE ({analysis.phaseTypeEvaluated})</span>
          </div>
          <div className="space-y-1.5">
            {analysis.phaseAlerts.map((alert, idx) => (
              <div
                key={idx}
                className={`p-2 rounded border text-xs font-mono font-bold flex items-start gap-2 ${
                  alert.severity === 'CRITICAL'
                    ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                    : 'bg-amber-100 dark:bg-amber-900/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                }`}
              >
                <span className="shrink-0 font-bold px-1.5 py-0.5 rounded bg-white/60 dark:bg-slate-900/60 border border-current text-[10px]">
                  {alert.type}
                </span>
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Status Badges Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Status 1: Tensão PRODIST Mód 8 */}
        <div className={`p-3 rounded-lg border flex flex-col justify-between ${
          isAmedir
            ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            : isAdequate
            ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
            : isPrecarious
            ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
            : 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200'
        }`}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-400">
              PRODIST MÓD. 8 (ANEEL)
            </div>
            <div className={`text-lg font-extrabold font-mono flex items-center gap-1.5 ${
              isAmedir ? 'text-slate-600 dark:text-slate-400' : isAdequate ? 'text-emerald-700 dark:text-emerald-300' : isPrecarious ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'
            }`}>
              {isAmedir && <Activity className="w-5 h-5 shrink-0 text-slate-500 dark:text-slate-400" />}
              {isAdequate && <ShieldCheck className="w-5 h-5 shrink-0" />}
              {isPrecarious && <AlertOctagon className="w-5 h-5 shrink-0" />}
              {isCritical && <AlertOctagon className="w-5 h-5 shrink-0 animate-pulse" />}
              <span>{isAmedir ? 'A MEDIR' : analysis.prodist.voltageStatus}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-700 dark:text-slate-300 font-mono mt-2 font-medium">
            Tensão Méd. Medida: <span className="font-bold text-slate-900 dark:text-slate-100">{isAmedir ? '—' : `${analysis.overallAvgPhasePhaseV}V`}</span> (Nominal: {transformer.secondaryVoltageV}V)
          </p>
        </div>

        {/* Status 2: Classificação de Tensão PRODIST */}
        <div className={`p-3 rounded-lg border flex flex-col justify-between ${
          isAmedir
            ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            : isCritical || isPrecarious
            ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200'
            : 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
        }`}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-600 dark:text-slate-400">
              STATUS DE TENSÃO PRODIST (MÓD. 8)
            </div>
            <div className={`text-sm font-extrabold font-mono flex items-center gap-1.5 ${
              isAmedir
                ? 'text-slate-600 dark:text-slate-400'
                : isCritical || isPrecarious
                ? 'text-rose-700 dark:text-rose-300'
                : 'text-emerald-700 dark:text-emerald-300'
            }`}>
              {isAmedir ? (
                <Activity className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
              ) : isCritical || isPrecarious ? (
                <AlertOctagon className="w-4 h-4 shrink-0 animate-pulse text-rose-600 dark:text-rose-400" />
              ) : (
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>{isAmedir ? 'A MEDIR' : analysis.prodist.voltageStatus}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-700 dark:text-slate-300 font-mono mt-2 font-medium">
            {isAmedir ? 'Aguardando teste' : analysis.prodist.voltageClassificationText}
          </p>
        </div>

        {/* Status 3: Elo Fusível Recomendado */}
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              ELO FUSÍVEL PRIMÁRIO (NDU/ETU)
            </div>
            <div className="text-lg font-extrabold text-amber-800 dark:text-amber-300 font-mono">
              {transformer.powerKva > 0 && transformer.primaryVoltageV > 0
                ? (analysis.recommendedFuse ? `Elo ${analysis.recommendedFuse.fuseCode}` : 'NÃO ENCONTRADO')
                : '—'}
            </div>
          </div>
          <p className="text-[11px] text-slate-700 dark:text-slate-300 font-mono mt-2 font-medium">
            {transformer.powerKva > 0 && transformer.primaryVoltageV > 0
              ? `Proteção (${transformer.primaryVoltageV / 1000} kV / ${transformer.powerKva} kVA)`
              : 'Aguardando dados do transformador'}
          </p>
        </div>

        {/* Status 4: Carregamento Máximo */}
        <div className={`p-3 rounded-lg border flex flex-col justify-between ${
          analysis.loadingCondition.includes('SOBRECARGA')
            ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800/80'
            : analysis.loadingCondition === 'ELEVADO'
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/80'
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80'
        }`}>
          <div>
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              CARREGAMENTO {analysis.criticalPhase ? `(PICO FASE ${analysis.criticalPhase})` : 'MÁXIMO (% Inom)'}
            </div>
            <div className={`text-lg font-extrabold font-mono ${
              analysis.loadingCondition.includes('SOBRECARGA')
                ? 'text-red-700 dark:text-red-400'
                : analysis.loadingCondition === 'ELEVADO'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-blue-800 dark:text-blue-300'
            }`}>
              {analysis.maxPhaseLoadingPercent || analysis.maxLoadingPercent}%{' '}
              <span className="text-[11px] text-slate-600 dark:text-slate-400 font-normal">
                ({analysis.maxKvaMeasured} kVA | Inom: {analysis.nominalCurrentSecondaryA}A)
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-700 dark:text-slate-300 font-mono mt-2 font-medium">
            {analysis.criticalPhase ? (
              <>Fases: <strong>A:{analysis.loadingPercentA}%</strong> | <strong>B:{analysis.loadingPercentB}%</strong> | <strong>C:{analysis.loadingPercentC}%</strong> • </>
            ) : null}
            Condição: <span className={`font-bold ${
              analysis.loadingCondition.includes('SOBRECARGA') ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'
            }`}>{analysis.loadingCondition.replace('_', ' ')}</span>
          </p>
        </div>
      </div>

      {/* Detailed Technical Guidance Box */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 space-y-2">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>PARECER TÉCNICO PARA COMUTAÇÃO DE TAP E MANUTENÇÃO</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* TAP Guidance */}
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="font-bold font-mono text-amber-800 dark:text-amber-300 mb-1 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{analysis.recommendedTap}</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
              {analysis.tapAdjustmentAdvice}
            </p>
          </div>

          {/* Efficiency and Losses */}
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="font-bold font-mono text-emerald-800 dark:text-emerald-300 mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Rendimento Calculado sob Carga: {analysis.calculatedEfficiencyPercent}%</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
              Perdas Totais Calculadas: <span className="font-bold text-slate-900 dark:text-slate-100">{analysis.totalCalculatedLossW} W</span> (Perdas no Ferro P0: {analysis.estimatedIronLossW} W + Perdas no Cobre Pk: {analysis.estimatedCopperLossW} W).
            </p>
            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
              Material: <strong className="text-amber-800 dark:text-amber-300">{analysis.windingMaterial === 'COBRE' ? 'Cobre (Cu)' : 'Alumínio (Al)'}</strong> | Óleo: <strong className="text-emerald-800 dark:text-emerald-300">{analysis.oilType === 'VEGETAL' ? 'Vegetal (Éster)' : 'Mineral'}</strong> | Fab.: <strong className="text-slate-700 dark:text-slate-300">{analysis.manufacturingDate || 'N/A'}</strong>{analysis.efficiencyLevel ? <> | Eficiência: <strong className="text-blue-800 dark:text-blue-300">{String(analysis.efficiencyLevel).toUpperCase() === 'C' ? 'Nível C' : `${analysis.efficiencyLevel}%`}</strong></> : null} | Tk = {analysis.thermalConstantTk}°C | Kt = {analysis.thermalCorrectionFactorKt}
            </p>
          </div>
        </div>

        {/* Operational Warning for Overload / Unbalance */}
        {(analysis.maxPhaseLoadingPercent || 0) > 100 && (
          <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2">
            <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-red-800 dark:text-red-300 leading-relaxed">
              <strong>ALERTA DE SOBRECARGA CRÍTICA (NDU 006 / NBR 5356-7):</strong> A Fase {analysis.criticalPhase || 'crítica'} opera com carregamento de <strong>{analysis.maxPhaseLoadingPercent}%</strong> ({analysis.nominalCurrentSecondaryA} A nominais). Sobrecargas assimétricas causam fusão recorrente de elos de proteção e envelhecimento acelerado do transformador. É recomendada a redistribuição imediata das cargas secundárias da Fase {analysis.criticalPhase || 'C'} para as demais fases.
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
