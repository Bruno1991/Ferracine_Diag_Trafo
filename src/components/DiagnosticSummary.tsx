import React from 'react';
import { ShieldCheck, AlertOctagon, Activity, Scale, CheckCircle2, ArrowRight } from 'lucide-react';
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
    { phase: 'A', current: analysis.avgIa, loading: analysis.loadingPercentA || 0 },
    { phase: 'B', current: analysis.avgIb, loading: analysis.loadingPercentB || 0 },
    { phase: 'C', current: analysis.avgIc, loading: analysis.loadingPercentC || 0 }
  ];
  const sortedByLoad = [...phaseList].sort((a, b) => b.loading - a.loading);
  const worstPhase = sortedByLoad[0];
  const lowestPhase = sortedByLoad[sortedByLoad.length - 1];

  const pba = analysis.phaseBalanceAnalysis;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
      {/* Cabeçalho */}
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

      {/* Alerta de Sobrecarga Crítica com Análise de Balanceamento */}
      {(analysis.maxPhaseLoadingPercent || 0) > 100 && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800/80 flex items-start gap-2.5">
          <AlertOctagon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-900 dark:text-red-200 leading-relaxed font-mono">
            <div className="font-bold uppercase tracking-wider mb-0.5 text-red-700 dark:text-red-400">
              ALERTA DE SOBRECARGA CRÍTICA (NDU 006 / NBR 5356-7)
            </div>
            {analysis.criticalPhase && analysis.criticalPhase !== 'EQUILIBRADO' ? (
              <>
                A Fase <strong>{analysis.criticalPhase}</strong> opera com carregamento de <strong>{analysis.maxPhaseLoadingPercent}%</strong> ({analysis.nominalCurrentSecondaryA} A nominais). Sobrecargas assimétricas causam fusão recorrente de elos de proteção e envelhecimento acelerado do transformador.
                {pba && (
                  <div className="mt-1 pt-1 border-t border-red-200 dark:border-red-800/60 font-semibold">
                    {pba.willBeWithinNominalAfterBalancing ? (
                      <span className="text-emerald-800 dark:text-emerald-300">
                        ✓ O balanceamento das fases equalizará a demanda e reduzirá o carregamento para <strong>{pba.postBalancingLoadingPercent}%</strong>, ficando dentro do limite nominal.
                      </span>
                    ) : (
                      <span className="text-red-800 dark:text-red-300">
                        ⚠ ATENÇÃO PERICIAL: Mesmo realizando o balanceamento perfeito entre as fases, o transformador continuará sobrecarregado operando a <strong>{pba.postBalancingLoadingPercent}%</strong> da sua capacidade nominal ({pba.postBalancingCurrentA} A médios por fase). É mandatória a redistribuição de ramais para trafo vizinho ou substituição por equipamento de {pba.recommendedNextCapacityKva || 150} kVA.
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>O transformador opera com carregamento de <strong>{analysis.maxPhaseLoadingPercent || analysis.maxLoadingPercent}%</strong> ({analysis.nominalCurrentSecondaryA} A nominais). Sobrecargas elevadas causam aquecimento excessivo e envelhecimento acelerado do transformador. É recomendado o remanejamento de carga ou aumento de capacidade.</>
            )}
          </div>
        </div>
      )}

      {/* Main Status Badges Banner (Tensão PRODIST, Status, Elo Fusível, Carregamento) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Status 1: Tensão Média PRODIST */}
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

        {/* Status 2: Faixa Regulamentar PRODIST */}
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
                ? (analysis.recommendedFuse ? `Elo ${analysis.recommendedFuse.fuseCode}` : 'Elo 5H')
                : '—'}
            </div>
          </div>
          <p className="text-[11px] text-slate-700 dark:text-slate-300 font-mono mt-2 font-medium">
            {transformer.powerKva > 0 && transformer.primaryVoltageV > 0
              ? `Proteção (${transformer.primaryVoltageV / 1000} kV / ${transformer.powerKva} kVA)`
              : 'Aguardando dados do transformador'}
          </p>
        </div>

        {/* Status 4: Carregamento de Pico */}
        <div className={`p-3 rounded-lg border flex flex-col justify-between ${
          analysis.loadingCondition.includes('SOBRECARGA')
            ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800/80'
            : analysis.loadingCondition === 'ELEVADO'
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/80'
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80'
        }`}>
          <div>
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
              CARREGAMENTO {analysis.criticalPhase && analysis.criticalPhase !== 'EQUILIBRADO' ? `(PICO NA FASE ${analysis.criticalPhase})` : '(MÁXIMO TRIFÁSICO)'}
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
            Fases: <strong>A:{analysis.loadingPercentA}%</strong> | <strong>B:{analysis.loadingPercentB}%</strong> | <strong>C:{analysis.loadingPercentC}%</strong> • Condição: <span className={`font-bold ${
              analysis.loadingCondition.includes('SOBRECARGA') ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'
            }`}>{analysis.loadingCondition.replace('_', ' ')}</span>
          </p>
        </div>
      </div>

      {/* ANÁLISE DE FASES E SIMULAÇÃO DE BALANCEAMENTO SECUNDÁRIO (Substitui Perdas/Rendimento e TAP) */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/80 space-y-3">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Scale className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>DIAGNÓSTICO POR FASE E SIMULAÇÃO DE BALANCEAMENTO DE CARGA (NDU 006 / NBR 5356-7)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* Card 1: Fases Dentro e Fora do Nominal */}
          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                COMPORTAMENTO INDIVIDUAL DAS FASES
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                Nominal: {analysis.nominalCurrentSecondaryA} A
              </span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> FASES DENTRO DO NOMINAL (≤ 100%):
                </span>
                {pba && pba.phasesWithinNominal.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {pba.phasesWithinNominal.map((p) => (
                      <span key={p.phase} className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold">
                        Fase {p.phase}: {p.current} A ({p.loadingPercent}%)
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic mt-0.5">
                    Nenhuma fase dentro do nominal (todas operando acima de 100%).
                  </p>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1">
                  <AlertOctagon className="w-3.5 h-3.5" /> FASES FORA DO NOMINAL (SOBRECARGA &gt; 100%):
                </span>
                {pba && pba.phasesExceedingNominal.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {pba.phasesExceedingNominal.map((p) => (
                      <span key={p.phase} className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 font-bold">
                        Fase {p.phase}: {p.current} A ({p.loadingPercent}%)
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 italic mt-0.5">
                    Nenhuma fase em sobrecarga.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Simulação de Balanceamento Perfeito */}
          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  SE FIZER BALANCEAMENTO DE FASES
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  pba?.willBeWithinNominalAfterBalancing
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
                    : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300'
                }`}>
                  {pba?.willBeWithinNominalAfterBalancing ? 'FICARÁ DENTRO DO NOMINAL' : 'CONTINUARÁ SOBRECARREGADO'}
                </span>
              </div>

              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-600 dark:text-slate-400">Carregamento Projetado Pós-Balanceamento:</span>
                  <strong className={`text-sm ${
                    pba?.willBeWithinNominalAfterBalancing
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-red-700 dark:text-red-400 font-bold'
                  }`}>
                    {pba?.postBalancingLoadingPercent}%
                  </strong>
                </div>

                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-600 dark:text-slate-400">Corrente Média por Fase Projetada:</span>
                  <strong className="text-slate-800 dark:text-slate-200">
                    {pba?.postBalancingCurrentA} A
                  </strong>
                </div>
              </div>
            </div>

            {/* Veredito Pericial Conclusivo */}
            <div className={`p-2 rounded text-[11px] font-mono leading-relaxed border ${
              pba?.willBeWithinNominalAfterBalancing
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-950 dark:text-red-200'
            }`}>
              <strong className="block mb-0.5 uppercase tracking-wider flex items-center gap-1">
                <ArrowRight className="w-3 h-3 shrink-0" />
                Parecer de Remanejamento:
              </strong>
              {pba?.verdict || 'Aguardando medições.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
