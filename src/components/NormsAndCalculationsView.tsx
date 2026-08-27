import React from 'react';
import { BookOpen, CheckCircle2, Database, FileCode2, Scale, ShieldAlert } from 'lucide-react';
import { FuseRecommendation, PhaseType } from '../types';
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

function formatKv(voltageV: number): string {
  return (voltageV / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 3 });
}

function formatFuseCode(code: string): string {
  return code.replace('.', ',').replace(/([HK])$/, ' $1');
}

function fuseAt(fuses: FuseRecommendation[], phase: PhaseType, powerKva: number, voltageV: number): FuseRecommendation | undefined {
  return fuses.find((item) => item.phaseType === phase && Math.abs(item.powerKva - powerKva) < 0.001 && Math.abs(item.primaryVoltageV - voltageV) < 1);
}

export const NormsAndCalculationsView: React.FC = () => {
  const status = getOfflineDatabaseStatus();
  const fuses = getOfflineFuseRecommendations();
  const table16Vegetal = fuses.filter((item) => item.oilType === 'VEGETAL');
  const voltageRanges = getOfflineProdistVoltageRanges();
  const fdBt = getDiagnosticRuleValue('prodist_fd_limit_bt_percent', 3);
  const fdMt = getDiagnosticRuleValue('prodist_fd_limit_mt_percent', 2);
  const currentScreening = getDiagnosticRuleValue('current_unbalance_limit_percent', 15);
  const generatedAt = status.generatedAt ? new Date(status.generatedAt).toLocaleString('pt-BR') : 'data não informada';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider">Base normativa e base de cálculo de diagnóstico</h2>
            <p className="text-[11px] text-slate-500 font-mono">Conteúdo lido do mesmo SQLite usado pelos cálculos offline</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5" /> SQLite v{status.schemaVersion} — {status.source}
        </span>
      </div>

      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] font-mono flex flex-wrap justify-between gap-2">
        <span><Database className="w-4 h-4 inline mr-1 text-blue-600" />Banco gerado em {generatedAt}</span>
        <span>{status.transformerCount} transformadores | {status.fuseCount} elos | {status.voltageRangeCount} faixas de tensão</span>
      </div>

      <section className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
        <h3 className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase flex items-center gap-2"><Scale className="w-4 h-4" />1. PRODIST Módulo 8 — faixas cadastradas</h3>
        <p className="text-[11px] text-slate-600 dark:text-slate-300">Os limites são valores absolutos por tensão nominal, não percentuais genéricos. FD95: BT {fdBt}% e MT {fdMt}%. O limiar de {currentScreening}% para corrente é triagem de engenharia do app, não limite regulatório PRODIST.</p>
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
                  <thead className="bg-slate-100 dark:bg-slate-800"><tr><th className="p-2 text-left">Potência (kVA)</th>{voltages.map((voltage) => <th key={voltage} className="p-2 text-center">{formatKv(voltage)} kV</th>)}</tr></thead>
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
        <p className="text-[10px] text-slate-500 font-mono">Fonte exibida: ETU-109.2, Tabela 16, página 142 (óleo vegetal). O SQLite também mantém separadamente a Tabela 16 da ETU-109.1 para óleo mineral, usada automaticamente quando esse óleo é selecionado.</p>
      </section>

      <section className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
        <h3 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase flex items-center gap-2"><FileCode2 className="w-4 h-4" />3. Fórmulas efetivamente usadas pelo app</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
          {[
            ['Potência aparente trifásica', 'S = √3 × VFF,média × Imédia / 1000'],
            ['Carregamento', 'Carga (%) = Smedida / Snominal × 100'],
            ['FDTP — fórmula exata PRODIST', 'β=(Vab⁴+Vbc⁴+Vca⁴)/(Vab²+Vbc²+Vca²)²; FD=100×√((1−√(3−6β))/(1+√(3−6β)))'],
            ['Desbalanço de corrente — triagem do app', '100 × máximo |Ifase−Imédia| / Imédia'],
            ['Correção térmica', 'Kt = (Tk + Tóleo) / (Tk + 75 °C); Tk Cu=234,5 °C e Tk Al=225 °C'],
            ['Rendimento estimado', 'η = Pativa / (Pativa + P0 + Pk,calc) × 100']
          ].map(([name, formula]) => <div key={name} className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"><strong>{name}</strong><div className="mt-1 p-1.5 rounded bg-slate-100 dark:bg-slate-950 font-mono text-emerald-800 dark:text-emerald-300">{formula}</div></div>)}
        </div>
        <p className="text-[10px] text-slate-500">A triagem temporal do app usa o PRODIST. A curva ITIC não é declarada sem registrar a duração real dos eventos de afundamento/elevação.</p>
      </section>
    </div>
  );
};
