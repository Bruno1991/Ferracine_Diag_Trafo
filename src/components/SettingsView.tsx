import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CloudDownload,
  Database,
  Eye,
  EyeOff,
  FolderGit2,
  HardDrive,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  WifiOff
} from 'lucide-react';
import type { TransformerSpec } from '../types';
import type { OfflineDatabaseStatus } from '../utils/sqliteAndSplitLoader';
import {
  isCommunityTransformer,
  syncWithGitHub,
  testGitHubConnection,
  type GitHubSyncConfig
} from '../utils/githubSync';

const CONFIG_KEY = 'tx_github_sync_config_v2';
const TOKEN_KEY = 'tx_github_sync_token';
const LAST_SYNC_KEY = 'tx_github_last_sync';

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

const DEFAULT_CONFIG: GitHubSyncConfig = {
  token: '',
  owner: 'Bruno1991',
  repo: 'Ferracine_Diag_Trafo',
  branch: 'main',
  transformerPath: 'database/transformador-db.json',
  databasePath: 'public/database/ferracine-trafo.sqlite'
};

function loadConfig(): GitHubSyncConfig {
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved), token } : { ...DEFAULT_CONFIG, token };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  transformers,
  databaseState,
  onSyncApplied
}) => {
  const [config, setConfig] = useState<GitHubSyncConfig>(loadConfig);
  const [showToken, setShowToken] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);
  const [lastSync, setLastSync] = useState(() => localStorage.getItem(LAST_SYNC_KEY) || 'Nunca');
  const ready = !databaseState.loading && !databaseState.error;
  const communityCount = useMemo(() => transformers.filter(isCommunityTransformer).length, [transformers]);

  useEffect(() => {
    const { token: _token, ...safeConfig } = config;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(safeConfig));
    if (config.token) sessionStorage.setItem(TOKEN_KEY, config.token);
    else sessionStorage.removeItem(TOKEN_KEY);
  }, [config]);

  const updateConfig = (field: keyof GitHubSyncConfig, value: string) => {
    setConfig((current) => ({ ...current, [field]: value }));
  };

  const validateConfig = (): boolean => {
    if (!config.token.trim() || !config.owner.trim() || !config.repo.trim()) {
      setMessage({ type: 'error', text: 'Informe o token, o proprietario e o repositorio.' });
      return false;
    }
    return true;
  };

  const handleTest = async () => {
    if (!validateConfig()) return;
    setWorking(true);
    setMessage({ type: 'info', text: 'Testando o acesso ao repositorio...' });
    try {
      const repository = await testGitHubConnection(config);
      setMessage({ type: 'success', text: `Conexao confirmada com ${repository}.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha ao testar a conexao.' });
    } finally {
      setWorking(false);
    }
  };

  const handleSync = async () => {
    if (!validateConfig()) return;
    setWorking(true);
    setMessage({ type: 'info', text: 'Mesclando placas e verificando o banco oficial...' });
    try {
      const result = await syncWithGitHub(config, transformers);
      onSyncApplied(result.communityTransformers, result.normativeTransformers, result.databaseStatus);
      const now = new Date().toLocaleString('pt-BR');
      setLastSync(now);
      localStorage.setItem(LAST_SYNC_KEY, now);
      const databaseText = result.databaseUpdated ? ' Banco SQLite oficial atualizado.' : ' Banco SQLite ja estava atualizado.';
      const warningText = result.warnings.length ? ` Avisos: ${result.warnings.join(' ')}` : '';
      setMessage({
        type: result.warnings.length ? 'warning' : 'success',
        text: `Sincronizacao concluida: ${result.communityTransformers.length} placa(s) compartilhada(s), ${result.downloadedCount} nova(s) recebida(s).${databaseText}${warningText}`
      });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha na sincronizacao.' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4">
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
                O diagnostico continua disponivel sem rede. A internet e usada somente quando o usuario sincroniza.
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
          <StatusCard label="Origem" value={databaseState.source === 'REMOTE' ? 'GitHub' : 'App'} />
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-4 text-xs">
          <InfoRow icon={<WifiOff className="w-4 h-4" />} title="Offline-first" text="Nenhuma rede e necessaria para diagnosticar." />
          <InfoRow icon={<HardDrive className="w-4 h-4" />} title="Banco oficial" text="public/database/ferracine-trafo.sqlite" />
          <InfoRow icon={<ShieldCheck className="w-4 h-4" />} title="Atualizacao protegida" text="Esquema, tabelas e data sao validados antes da instalacao." />
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                Sincronismo GitHub
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Envia placas cadastradas, recebe placas de outros tecnicos e verifica atualizacoes oficiais do SQLite.
              </p>
            </div>
          </div>
          <div className="text-right text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            Ultima sincronizacao<br /><span className="font-bold text-slate-700 dark:text-slate-300">{lastSync}</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Proprietario" value={config.owner} onChange={(value) => updateConfig('owner', value)} />
          <Field label="Repositorio" value={config.repo} onChange={(value) => updateConfig('repo', value)} />
          <Field label="Branch" value={config.branch} onChange={(value) => updateConfig('branch', value)} />
          <Field label="Arquivo de placas" value={config.transformerPath} onChange={(value) => updateConfig('transformerPath', value)} />
          <div className="sm:col-span-2">
            <Field label="Banco SQLite oficial" value={config.databasePath} onChange={(value) => updateConfig('databasePath', value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1">
              Token de acesso com permissao Contents: read/write
            </label>
            <div className="relative">
              <KeyRound className="absolute left-2.5 top-2 w-3.5 h-3.5 text-amber-600" />
              <input
                type={showToken ? 'text' : 'password'}
                value={config.token}
                onChange={(event) => updateConfig('token', event.target.value)}
                placeholder="github_pat_..."
                autoComplete="off"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded pl-8 pr-9 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
              <button type="button" onClick={() => setShowToken((current) => !current)} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
              O token fica somente na sessao deste dispositivo e nao e incluido no banco nem no build.
            </p>
          </div>
        </div>

        {message && <StatusMessage type={message.type} text={message.text} />}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-slate-200 dark:border-slate-800 pt-4">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-xl">
            O arquivo de placas e colaborativo. O SQLite oficial e somente baixado pelo app; normas e calculos nao sao enviados por usuarios.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={handleTest} disabled={working} className="px-3 py-1.5 rounded text-xs font-bold border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1.5">
              <FolderGit2 className="w-3.5 h-3.5" /> Testar
            </button>
            <button type="button" onClick={handleSync} disabled={working} className="px-3.5 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center gap-1.5">
              {working ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5" />}
              Sincronizar agora
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
  <div>
    <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-1">{label}</label>
    <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none" />
  </div>
);

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
