import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CloudDownload,
  Database,
  Globe,
  HardDrive,
  RefreshCw,
  Settings,
  ShieldCheck,
  WifiOff
} from 'lucide-react';
import type { TransformerSpec } from '../types';
import type { OfflineDatabaseStatus } from '../utils/sqliteAndSplitLoader';
import {
  isCommunityTransformer,
  syncWithGitHub,
  type GitHubSyncConfig
} from '../utils/githubSync';

const LAST_SYNC_KEY = 'tx_github_last_sync';
const WORKER_URL_KEY = 'tx_worker_sync_url';

interface SettingsViewProps {
  transformers: TransformerSpec[];
  databaseState: {
    loading: boolean;
    error: string;
    transformerCount: number;
    inmetroModelCount: number;
    fuseCount: number;
    schemaVersion: number;
    generatedAt: string;
    source: OfflineDatabaseStatus['source'];
  };
  onSyncApplied: (
    communityTransformers: TransformerSpec[],
    normativeTransformers: TransformerSpec[] | null,
    status: OfflineDatabaseStatus
  ) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  transformers,
  databaseState,
  onSyncApplied
}) => {
  const [workerUrl, setWorkerUrl] = useState(() => localStorage.getItem(WORKER_URL_KEY) || 'https://ferracine-diag-trafo-sync.contato-elias-inbox.workers.dev');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);
  const [lastSync, setLastSync] = useState(() => localStorage.getItem(LAST_SYNC_KEY) || 'Nunca');
  const ready = !databaseState.loading && !databaseState.error;
  const communityCount = useMemo(() => transformers.filter(isCommunityTransformer).length, [transformers]);

  const handleSaveWorkerUrl = (url: string) => {
    const trimmed = url.trim();
    setWorkerUrl(trimmed);
    if (trimmed) {
      localStorage.setItem(WORKER_URL_KEY, trimmed);
    } else {
      localStorage.removeItem(WORKER_URL_KEY);
    }
  };

  const handleSync = async () => {
    setWorking(true);
    setMessage({ type: 'info', text: 'Sincronizando com a nuvem e atualizando banco oficial...' });
    try {
      const config: GitHubSyncConfig = {
        workerUrl: workerUrl.trim() || undefined
      };
      const result = await syncWithGitHub(config, transformers);
      onSyncApplied(result.communityTransformers, result.normativeTransformers, result.databaseStatus);
      const now = new Date().toLocaleString('pt-BR');
      setLastSync(now);
      localStorage.setItem(LAST_SYNC_KEY, now);
      const databaseText = result.databaseUpdated ? ' Banco SQLite oficial atualizado.' : ' Banco SQLite já estava atualizado.';
      const warningText = result.warnings.length ? ` Avisos: ${result.warnings.join(' ')}` : '';
      setMessage({
        type: result.warnings.length ? 'warning' : 'success',
        text: `Sincronização concluída: ${result.communityTransformers.length} placa(s) sincronizada(s), ${result.downloadedCount} nova(s) recebida(s).${databaseText}${warningText}`
      });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha na sincronização.' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* SEÇÃO 1: STATUS DO BANCO SQLITE OFFLINE */}
      <section className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                Banco SQLite offline
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                O diagnóstico continua disponível sem rede. A internet é usada somente quando o usuário sincroniza.
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border ${ready ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'}`}>
            {ready ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {databaseState.loading ? 'CARREGANDO' : ready ? 'OPERACIONAL' : 'ERRO'}
          </span>
        </div>

        {databaseState.error && <StatusMessage type="error" text={databaseState.error} />}

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-4">
          <StatusCard label="Modelos INMETRO" value={databaseState.inmetroModelCount} />
          <StatusCard label="Perfis ETU" value={databaseState.transformerCount} />
          <StatusCard label="Elos ETU" value={databaseState.fuseCount} />
          <StatusCard label="Placas de campo" value={communityCount} />
          <StatusCard label="Esquema" value={databaseState.schemaVersion || '-'} />
          <StatusCard label="Origem" value={databaseState.source === 'REMOTE' ? 'Nuvem' : 'Local'} />
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-4 text-xs">
          <InfoRow icon={<WifiOff className="w-4 h-4 text-slate-500" />} title="Offline-first" text="Nenhuma rede é necessária para diagnosticar em campo." />
          <InfoRow icon={<HardDrive className="w-4 h-4 text-blue-500" />} title="Banco oficial" text="Tabelas oficiais ETU/NDU e normas ANEEL." />
          <InfoRow icon={<ShieldCheck className="w-4 h-4 text-emerald-500" />} title="Atualização protegida" text="Validação rigorosa de integridade antes da instalação." />
        </div>
      </section>

      {/* SEÇÃO 2: SINCRONIZAÇÃO EM NUVEM (APENAS O BOTÃO DE SINCRONIZAR) */}
      <section className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
              <CloudDownload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                Sincronização em Nuvem
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Sincroniza automaticamente as placas cadastradas e baixa as atualizações oficiais do banco técnico.
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right text-[11px] text-slate-500 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-950 sm:bg-transparent px-3 py-1.5 sm:p-0 rounded border sm:border-0 border-slate-200 dark:border-slate-800">
            Última sincronização:<br />
            <span className="font-bold text-slate-800 dark:text-slate-200">{lastSync}</span>
          </div>
        </div>

        {/* Card de Ação Principal: Botão Único */}
        <div className="bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Sincronização Segura sem Credenciais no Dispositivo</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-lg">
              Suas credenciais e tokens não ficam expostos no aparelho. Basta clicar abaixo para sincronizar.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={working}
            className="w-full sm:w-auto px-6 py-2.5 rounded-md text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            {working ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>{working ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
          </button>
        </div>

        {message && <StatusMessage type={message.type} text={message.text} />}

        {/* Configuração Opcional do Cloudflare Worker (Recolhida por padrão) */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 font-medium cursor-pointer transition-colors"
          >
            <Settings className="w-3 h-3" />
            <span>{showAdvanced ? 'Ocultar Configuração do Cloudflare Worker' : 'Configurar URL do Cloudflare Worker (Opcional)'}</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                URL do Cloudflare Worker
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="url"
                    value={workerUrl}
                    onChange={(e) => handleSaveWorkerUrl(e.target.value)}
                    placeholder="https://ferracine-diag-trafo-sync.seu-usuario.workers.dev"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded pl-8 pr-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Caso você publique o Worker, insira o link acima para habilitar o commit automático das placas para o GitHub. Se deixado em branco, a sincronização opera no modo leitura segura direto do GitHub.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

const StatusCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{label}</div>
    <div className="mt-1 text-lg font-mono font-bold text-slate-900 dark:text-slate-100">{value}</div>
  </div>
);

const InfoRow: React.FC<{ icon: React.ReactNode; title: string; text: string }> = ({ icon, title, text }) => (
  <div className="rounded border border-slate-200 dark:border-slate-700 p-3 text-slate-600 dark:text-slate-300">
    <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">{icon}{title}</div>
    <p className="mt-1 leading-relaxed">{text}</p>
  </div>
);

const StatusMessage: React.FC<{ type: 'success' | 'error' | 'info' | 'warning'; text: string }> = ({ type, text }) => {
  const classes = type === 'success'
    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
    : type === 'error'
      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
      : type === 'warning'
        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
        : 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
  return (
    <div className={`mt-3 p-3 rounded border text-xs flex items-start gap-2 ${classes}`}>
      {type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : type === 'info' ? <RefreshCw className="w-4 h-4 shrink-0 animate-spin" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      <span>{text}</span>
    </div>
  );
};
