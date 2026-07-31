import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle2, ShieldAlert, FileCode2, Scale, Zap, Database, Activity } from 'lucide-react';
import { getNormativeBaseConfig, NormativeBaseConfig } from '../data/normativeBase';

export const NormsAndCalculationsView: React.FC = () => {
  const [normativeConfig, setNormativeConfig] = useState<NormativeBaseConfig>(() => getNormativeBaseConfig());

  useEffect(() => {
    // Reload if updated
    setNormativeConfig(getNormativeBaseConfig());
  }, []);

  const syncDateStr = new Date(normativeConfig.lastSyncIso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-4 transition-colors duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              BASE NORMATIVA E BASE DE CÁLCULO DE DIAGNÓSTICO
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Fonte oficial de parâmetros regulatórios, regras de concessão e fórmulas matemáticas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Base Sincronizada ({syncDateStr})</span>
          </span>
        </div>
      </div>

      {/* Sync Origin Badge */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="font-mono text-[11px]">
            <strong>Fonte dos Dados de Cálculo:</strong> {normativeConfig.source}
          </span>
        </div>
        <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] font-mono font-bold">
          Versão: {normativeConfig.version}
        </span>
      </div>

      {/* PRODIST MODULO 8 */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
            <Scale className="w-4 h-4" />
            <span>1. {normativeConfig.prodist.title}</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
            FDTP Limite: {normativeConfig.prodist.fdtpLimitPercent}% | Desbalanço I: {normativeConfig.prodist.currentUnbalanceLimitPercent}%
          </span>
        </div>

        <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
          {normativeConfig.prodist.summary}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 shadow-xs space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
              <span>FAIXA ADEQUADA</span>
              <span className="text-emerald-600 font-mono">CONFORME</span>
            </div>
            <div className="text-xs font-mono font-extrabold text-slate-900 dark:text-slate-100">
              {normativeConfig.prodist.voltageAdequateMinRatio} × Vn ≤ V ≤ {normativeConfig.prodist.voltageAdequateMaxRatio} × Vn
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400">
              Tensão dentro dos padrões normais de operação técnica da rede de distribuição.
            </p>
          </div>

          <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 shadow-xs space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center justify-between">
              <span>FAIXA PRECÁRIA</span>
              <span className="text-amber-600 font-mono">ALERTA</span>
            </div>
            <div className="text-xs font-mono font-extrabold text-slate-900 dark:text-slate-100">
              {normativeConfig.prodist.voltagePrecariousMinRatio} × Vn ≤ V &lt; {normativeConfig.prodist.voltageAdequateMinRatio} × Vn ou {normativeConfig.prodist.voltageAdequateMaxRatio} × Vn &lt; V ≤ {normativeConfig.prodist.voltagePrecariousMaxRatio} × Vn
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400">
              Tensão com desvio moderado, sujeita a penalidades contratuais e reajuste de comutador TAP.
            </p>
          </div>

          <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/60 shadow-xs space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center justify-between">
              <span>FAIXA CRÍTICA</span>
              <span className="text-rose-600 font-mono">VIOLAÇÃO</span>
            </div>
            <div className="text-xs font-mono font-extrabold text-slate-900 dark:text-slate-100">
              V &lt; {normativeConfig.prodist.voltagePrecariousMinRatio} × Vn ou V &gt; {normativeConfig.prodist.voltagePrecariousMaxRatio} × Vn
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400">
              Risco iminente de sobreaquecimento, queima de equipamentos e severa perda de vida útil.
            </p>
          </div>
        </div>
      </div>

      {/* NDUs / ETUs - FUSE LINKS MATRIX */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>2. {normativeConfig.nduEtu.title}</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
            Carregamento Contínuo Máx: {normativeConfig.nduEtu.maxContinuousLoadPercent}% | Emergência: {normativeConfig.nduEtu.maxEmergencyLoadPercent}%
          </span>
        </div>

        <p className="text-[11px] text-slate-700 dark:text-slate-300">
          {normativeConfig.nduEtu.summary}
        </p>

        <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase tracking-wider">
                <th className="p-2">Tensão Primária</th>
                <th className="p-2">Potência kVA</th>
                <th className="p-2">Elo Tipo H</th>
                <th className="p-2">Elo Tipo K (Padrão)</th>
                <th className="p-2">Elo Tipo T</th>
                <th className="p-2">Diretriz Técnica NDU/ETU</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px] text-slate-800 dark:text-slate-200">
              {normativeConfig.nduEtu.fuseTable.map((f, idx) => (
                <tr key={idx} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition">
                  <td className="p-2 font-bold text-blue-700 dark:text-blue-400">{f.primaryVoltageV / 1000} kV</td>
                  <td className="p-2 font-bold text-slate-900 dark:text-slate-100">{f.powerKva} kVA</td>
                  <td className="p-2">{f.fuseH}</td>
                  <td className="p-2 text-amber-800 dark:text-amber-300 font-bold">{f.fuseK}</td>
                  <td className="p-2">{f.fuseT}</td>
                  <td className="p-2 font-sans text-[10px] text-slate-600 dark:text-slate-400">{f.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORMULAS & CÁLCULOS ABNT */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
            <FileCode2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>3. {normativeConfig.abntCalculations.title}</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
            Tk Cu: {normativeConfig.abntCalculations.tkCopper}°C | Tk Al: {normativeConfig.abntCalculations.tkAluminum}°C | Ref: {normativeConfig.abntCalculations.refTempC}°C
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {normativeConfig.abntCalculations.formulas.map((f, idx) => (
            <div key={idx} className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>{f.name}</span>
              </div>
              <div className="text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-slate-100 dark:bg-slate-950 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                {f.formula}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{f.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ITIC / CBEMA */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
          <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span>4. {normativeConfig.iticCbema.title}</span>
        </div>
        <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
          {normativeConfig.iticCbema.summary}
        </p>
      </div>
    </div>
  );
};

