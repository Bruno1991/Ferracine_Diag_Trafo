import React from 'react';
import { ShieldCheck, AlertOctagon, Cpu, Activity } from 'lucide-react';
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
  transformer
}) => {
  const isAmedir = analysis.overallAvgPhasePhaseV === 0;
  const isAdequate = !isAmedir && analysis.prodist.voltageStatus === 'ADEQUADA';
  const isPrecarious = !isAmedir && analysis.prodist.voltageStatus === 'PRECARIA';
  const isCritical = !isAmedir && analysis.prodist.voltageStatus === 'CRITICA';

  // Cálculo do Desequilíbrio de Carga entre as Fases (NDU 006 / NDU 007)
  const isTri = transformer.phaseType === 'TRIFASICO';
  const currents = [analysis.avgIa, analysis.avgIb, analysis.avgIc].filter((c) => c > 0);
  const avgI = currents.length > 0 ? currents.reduce((a, b) => a + b, 0) / currents.length : 0;
  const maxDev = avgI > 0 ? Math.max(...currents.map((c) => Math.abs(c - avgI))) : 0;
  const unbalancePercent = avgI > 0 ? Number(((maxDev / avgI) * 100).toFixed(1)) : 0;
  const hasUnbalance = isTri && unbalancePercent > 15;

  // Identificação das fases com maior e menor carregamento
  const phaseList = [
    { phase: 'A', current: analysis.avgIa, loading: analysis.loadingPercentA },
    { phase: 'B', current: analysis.avgIb, loading: analysis.loadingPercentB },
    { phase: 'C', current: analysis.avgIc, loading: analysis.loadingPercentC }
  ];
  const sortedByLoad = [...phaseList].sort((a, b) => (b.loading || 0) - (a.loading || 0));
  const worstPhase = sortedByLoad[0];
  const lowestPhase = sortedByLoad[sortedByLoad.length - 1];

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
              Cálculos e parametrização extraídos exclusivamente das normas PRODIST Módulo 8, NDUs/ETUs e NBR 5440
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
                analysis.cycleMode === '1s'
                  ? 'ciclo 1 segundo (modo de teste)'
                  : analysis.cycleMode === '5s'
                  ? 'ciclo 5 segundos (modo de teste)'
                  : analysis.cycleMode === '5m'
                  ? 'ciclo 5 minutos'
                  : analysis.dataQuality.isInstantaneous
                    ? 'Medição Instantânea (10 minutos pós-fechamento)'
                    : 'ciclo 10 minutos (operação de fato)'
              }
            </span>
          </div>
          {analysis.dataQuality.issues.length === 0 ? (
            <p className="text-[11px] font-mono">Nenhuma inconsistência detectada nas medições informadas.</p>
          ) : (
            <div className="space-y-1.5 pt-1">
              {analysis.dataQuality.issues.map((issue) => (
                <p key={issue.code} className="text-[11px] font-mono leading-tight">
                  <span className={`font-bold mr-1 ${issue.severity === 'CRITICAL' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    [{issue.severity === 'CRITICAL' ? 'CRÍTICO' : 'ALERTA'}]
                  </span>
                  <strong>{issue.title}:</strong> {issue.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerta de Desequilíbrio de Carga na Rede BT */}
      {hasUnbalance && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-3 rounded-lg space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
            <AlertOctagon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>ALERTA — DESEQUILÍBRIO DE CARGA NA REDE BT ({unbalancePercent}% | Limiar: 15%)</span>
          </div>
          <p className="text-xs font-mono text-amber-900 dark:text-amber-200 leading-relaxed">
            <strong>Fases afetadas:</strong> Fase {worstPhase.phase} com maior carga ({worstPhase.current} A — {worstPhase.loading}%), Fase {lowestPhase.phase} com menor carga ({lowestPhase.current} A — {lowestPhase.loading}%). Desvio de {unbalancePercent}% excede o limiar normativo de 15%.
          </p>
          <p className="text-[11px] font-mono text-amber-800 dark:text-amber-300">
            Recomenda-se remanejamento de carga entre as fases na rede secundária para mitigar aquecimento assimétrico e prevenir atuação indevida do elo fusível (NDU 006 / NDU 007).
          </p>
        </div>
      )}

      {/* Alerta de Sobrecarga Crítica */}
      {(analysis.maxPhaseLoadingPercent || 0) > 100 && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800/80 flex items-start gap-2.5">
          <AlertOctagon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-900 dark:text-red-200 leading-relaxed font-mono">
            <div className="font-bold uppercase tracking-wider mb-0.5 text-red-700 dark:text-red-400">
              ALERTA DE SOBRECARGA CRÍTICA (NDU 006 / NBR 5356-7)
            </div>
            A Fase {analysis.criticalPhase || 'C'} opera com carregamento de <strong>{analysis.maxPhaseLoadingPercent}%</strong> ({analysis.nominalCurrentSecondaryA} A nominais). Sobrecargas assimétricas causam fusão recorrente de elos de proteção e envelhecimento acelerado do transformador. É recomendada a redistribuição imediata das cargas secundárias da Fase {analysis.criticalPhase || 'C'} para as demais fases.
          </div>
        </div>
      )}

      {/* Main Status Badges Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Status 1: Tensão PRODIST Módulo 8 */}
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
              PRODIST MÓDULO 8 (ANEEL)
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
            Tensão Média Medida: <span className="font-bold text-slate-900 dark:text-slate-100">{isAmedir ? '—' : `${analysis.overallAvgPhasePhaseV}V`}</span> (Nominal: {transformer.secondaryVoltageV}V)
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
              STATUS DE TENSÃO PRODIST (MÓDULO 8)
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
              CARREGAMENTO {analysis.criticalPhase ? `(PICO NA FASE ${analysis.criticalPhase})` : 'MÁXIMO (% DA CORRENTE NOMINAL)'}
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
                ({analysis.maxKvaMeasured} kVA | Corrente Nominal: {analysis.nominalCurrentSecondaryA} A)
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

      {/* Resumo Geral do Estado Atual do Transformador */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/80 space-y-3">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>RESUMO GERAL DO ESTADO ATUAL DO TRANSFORMADOR</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Card 1: Diagnóstico Operacional */}
          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              ESTADO OPERACIONAL
            </div>
            <div className={`font-bold font-mono text-sm ${
              (analysis.maxPhaseLoadingPercent || 0) > 100
                ? 'text-red-600 dark:text-red-400'
                : analysis.loadingCondition === 'ELEVADO'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {(analysis.maxPhaseLoadingPercent || 0) > 100
                ? `SOBRECARGA NA FASE ${analysis.criticalPhase || 'C'}`
                : analysis.loadingCondition.replace('_', ' ')}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              Pico de corrente: <strong>{analysis.maxPhaseLoadingPercent || analysis.maxLoadingPercent}%</strong> ({analysis.maxKvaMeasured} kVA medidos).
            </p>
          </div>

          {/* Card 2: Perdas e Rendimento */}
          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              PERDAS E RENDIMENTO SOB CARGA
            </div>
            <div className="font-bold font-mono text-sm text-emerald-700 dark:text-emerald-300">
              {analysis.calculatedEfficiencyPercent}% de Rendimento
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              Perdas Totais: <strong>{analysis.totalCalculatedLossW} W</strong> (Ferro P0: {analysis.estimatedIronLossW} W + Cobre Pk: {analysis.estimatedCopperLossW} W).
            </p>
          </div>

          {/* Card 3: TAP e Proteção */}
          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              TAP & PROTEÇÃO PRIMÁRIA
            </div>
            <div className="font-bold font-mono text-sm text-blue-700 dark:text-blue-300">
              {analysis.recommendedTap || 'TAP Atual'} | {analysis.recommendedFuse ? `Elo ${analysis.recommendedFuse.fuseCode}` : 'Sem elo'}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              {analysis.tapAdjustmentAdvice || 'Tensão secundária em conformidade.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
