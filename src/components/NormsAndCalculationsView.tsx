import React from 'react';
import { BookOpen, CheckCircle2, Database, FileCode2, Scale, ShieldAlert } from 'lucide-react';
import { FuseRecommendation, PhaseType } from '../types';
import { formatKv } from '../utils/electricalCalculations';
import { FormulaSvg } from './FormulaSvg';
import {
  getDiagnosticRuleValue,
  getOfflineDatabaseStatus,
  getOfflineFuseRecommendations,
  getOfflineProdistVoltageRanges
} from '../utils/sqliteAndSplitLoader';

const phaseConfig: Array<{ phase: PhaseType; title: string; voltages: number[] }> = [
  { phase: 'MONOFASICO', title: 'Transformador monofásico (1F) — tensão do enrolamento primário', voltages: [6582, 7967, 12702, 19919] },
  { phase: 'TRIFASICO', title: 'Transformador trifásico (3F) — tensão primária fase-fase', voltages: [11400, 13800, 22000, 34500] }
];

function formatFuseCode(code: string): string {
  return code.replace('.', ',').replace(/([HK])$/, ' $1');
}

export const NormsAndCalculationsView: React.FC = () => {
  const status = getOfflineDatabaseStatus();
  const prodistLimit = getDiagnosticRuleValue('prodist_fd_limit_bt_percent', 3.0);
  const unbalanceLimit = getDiagnosticRuleValue('current_unbalance_alert_percent', 15.0);
  const fuses = getOfflineFuseRecommendations();
  const voltageRanges = getOfflineProdistVoltageRanges();

  const table16Vegetal = fuses.filter((item) => item.oilType === 'VEGETAL');
  const fuseAt = (rows: FuseRecommendation[], phase: PhaseType, power: number, voltage: number) =>
    rows.find((item) => item.phaseType === phase && Math.abs(item.powerKva - power) < 0.001 && Math.abs(item.primaryVoltageV - voltage) < 1.0);

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-300 dark:border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          Base Normativa e Regras de Cálculo Regulatórias
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Esta tela detalha os critérios oficiais aplicados no diagnóstico do aplicativo. As tabelas abaixo são carregadas do SQLite oficial e não utilizam tabelas embutidas provisórias no código.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-500 font-mono block">Origem dos Dados</span>
            <strong className="text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
              <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              SQLite Relacional Ativo
            </strong>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-500 font-mono block">Limite FDTP (BT)</span>
            <strong className="text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
              <Scale className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ≤ {prodistLimit.toFixed(1)}% (PRODIST Mód. 8)
            </strong>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-500 font-mono block">Alerta Desbalanceamento BT</span>
            <strong className="text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              &gt; {unbalanceLimit.toFixed(1)}% (NDU 006 / 007)
            </strong>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
        <h3 className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase flex items-center gap-2">
          <Scale className="w-4 h-4" />1. ANEEL PRODIST Módulo 8 — Faixas de Tensão Padronizadas para Concessões do Grupo Energisa
        </h3>
        <p className="text-[11px] text-slate-600 dark:text-slate-300">
          Valores regulatórios oficiais por tensão nominal e conexão (fase-fase ou fase-neutro) nas áreas de concessão do Grupo Energisa. O aplicativo rejeita leituras com desvio superior a 30% da faixa nominal como erro de medição do eletricista.
        </p>

        <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
          <table className="w-full text-[11px] font-mono border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800"><tr><th className="p-2 text-left">Sistema</th><th className="p-2">Ligação</th><th className="p-2">Nominal</th><th className="p-2">Adequada</th><th className="p-2">Precária (intervalo externo)</th><th className="p-2">Crítica</th></tr></thead>
            <tbody>
              {voltageRanges.map((range) => (
                <tr key={`${range.system}-${range.connection}`} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="p-2 font-bold">{range.system}</td><td className="p-2 text-center">{range.connection}</td><td className="p-2 text-center">{range.nominalV} V</td>
                  <td className="p-2 text-center text-emerald-700 dark:text-emerald-300 font-bold">{range.adequateMinV}–{range.adequateMaxV} V</td>
                  <td className="p-2 text-center text-amber-700 dark:text-amber-300">{range.precariousLowMinV} até &lt;{range.adequateMinV} ou &gt;{range.adequateMaxV} até {range.precariousHighMaxV} V</td>
                  <td className="p-2 text-center text-rose-700 dark:text-rose-300">&lt;{range.criticalLowBelowV} ou &gt;{range.criticalHighAboveV} V</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
        <h3 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase flex items-center gap-2"><ShieldAlert className="w-4 h-4" />2. Energisa ETU-109.2 — Tabela 16, padronização dos elos-fusíveis</h3>
        <p className="text-[11px] text-slate-600 dark:text-slate-300">Cada célula mostra o elo oficial para a combinação de fase, potência e tensão. Não existem três alternativas H/K/T para a mesma célula.</p>
        {phaseConfig.map(({ phase, title, voltages }) => {
          const powers = [...new Set(table16Vegetal.filter((item) => item.phaseType === phase).map((item) => item.powerKva))].sort((a, b) => a - b);
          return (
            <div key={phase} className="space-y-1.5">
              <h4 className="text-[11px] font-bold uppercase">{title}</h4>
              <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
                <table className="w-full text-[11px] font-mono border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800"><tr><th className="p-2 text-left">Potência (kVA)</th>{voltages.map((voltage) => <th key={voltage} className="p-2 text-center">{formatKv(voltage)}</th>)}</tr></thead>
                  <tbody>
                    {powers.map((power) => (
                      <tr key={power} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="p-2 font-bold">{power.toLocaleString('pt-BR')}</td>
                        {voltages.map((voltage) => {
                          const fuse = fuseAt(table16Vegetal, phase, power, voltage);
                          return <td key={voltage} className="p-2 text-center font-bold text-amber-800 dark:text-amber-300" title={fuse?.notes}>{fuse ? formatFuseCode(fuse.fuseCode) : '—'}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </section>

      <section className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase flex items-center gap-2">
            <FileCode2 className="w-4 h-4" />3. Fórmulas Matemáticas e Regras de Cálculo (Vetores SVG em Alta Resolução)
          </h3>
          <span className="text-[10px] font-mono text-slate-500">NDU 006 / NDU 007 / PRODIST Módulo 8 / IEEE 1459</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200">
              <span>I. Corrente Nominal Trifásica (IN)</span>
              <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">NDU 006 (pág. 178)</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded border border-slate-100 dark:border-slate-800 flex justify-center items-center min-h-[54px]">
              <FormulaSvg formula="in_trifasica" className="w-full" />
            </div>
            <p className="text-[11px] text-slate-500 font-mono">I = Potência (kVA) / [√3 × Tensão (kV)] = Potência (kVA) / [1,732 × Tensão (kV)]</p>
          </div>

          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200">
              <span>I. Corrente Nominal Monofásica (IN)</span>
              <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">NDU 007 (pág. 189)</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded border border-slate-100 dark:border-slate-800 flex justify-center items-center min-h-[54px]">
              <FormulaSvg formula="in_monofasica" className="w-full" />
            </div>
            <p className="text-[11px] text-slate-500 font-mono">I = Potência (kVA) / Tensão (kV)</p>
          </div>

          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200">
              <span>II. Potência Aparente e Carregamento</span>
              <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">IEEE Std 1459 / NBR 5356-7</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded border border-slate-100 dark:border-slate-800 flex justify-center items-center min-h-[66px]">
              <FormulaSvg formula="potencia_carregamento" className="w-full" />
            </div>
            <p className="text-[11px] text-slate-500 font-mono">S = (Van·Ia + Vbn·Ib + Vcn·Ic)/1000 | Carga Fase (%) = (Ifase / Inominal) × 100</p>
          </div>

          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200">
              <span>III. Fator de Desbalanço de Tensão (FDTP)</span>
              <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">PRODIST Módulo 8 (Eq. 15 e 16)</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded border border-slate-100 dark:border-slate-800 flex justify-center items-center min-h-[72px]">
              <FormulaSvg formula="prodist_fdtp" className="w-full" />
            </div>
            <p className="text-[11px] text-slate-500 font-mono">β = (Vab⁴ + Vbc⁴ + Vca⁴)/(Vab² + Vbc² + Vca²)² | FDTP (%) = 100 × √((1 - √(3-6β))/(1 + √(3-6β)))</p>
          </div>

          <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200">
              <span>IV. Desbalanço de Carga na Rede BT</span>
              <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">NDU 006 / NDU 007</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded border border-slate-100 dark:border-slate-800 flex justify-center items-center min-h-[54px]">
              <FormulaSvg formula="desequilibrio_bt" className="w-full" />
            </div>
            <p className="text-[11px] text-slate-500 font-mono">Desvio (%) = 100 × máx|Ifase - Imédia| / Imédia (Limiar de triagem do app: 15%)</p>
          </div>
        </div>
        <p className="text-[10px] text-slate-500">Cálculos e parametrizações regulatórias extraídas diretamente dos documentos normativos oficiais da Energisa (NDU 006, NDU 007, ETU-109) e ANEEL (PRODIST Módulo 8).</p>
      </section>
    </div>
  );
};
