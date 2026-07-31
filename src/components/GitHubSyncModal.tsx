import React, { useState, useEffect } from 'react';
import {
  Github,
  RefreshCw,
  CloudUpload,
  CloudDownload,
  CheckCircle2,
  AlertCircle,
  X,
  Key,
  FolderGit2,
  Lock,
  Eye,
  EyeOff,
  Database,
  ArrowUpDown
} from 'lucide-react';
import { TransformerSpec } from '../types';
import {
  GitHubSyncConfig,
  getSavedGitHubConfig,
  saveGitHubConfig,
  FIXED_TEAM_GITHUB_CONFIG,
  encodeUtf8ToBase64,
  decodeBase64ToUtf8
} from '../utils/githubSync';

export type { GitHubSyncConfig };

interface GitHubSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  localTransformers: TransformerSpec[];
  onUpdateTransformers: (updated: TransformerSpec[]) => void;
}

export const GitHubSyncModal: React.FC<GitHubSyncModalProps> = ({
  isOpen,
  onClose,
  localTransformers,
  onUpdateTransformers
}) => {
  const [config, setConfig] = useState<GitHubSyncConfig>(() => getSavedGitHubConfig());

  const [showToken, setShowToken] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem('tx_github_last_sync') || null;
  });

  useEffect(() => {
    saveGitHubConfig(config);
  }, [config]);

  if (!isOpen) return null;

  const isConfigValid = config.token.trim() && config.owner.trim() && config.repo.trim();

  // Test API Connection
  const handleTestConnection = async () => {
    if (!isConfigValid) {
      setStatusMsg({ type: 'error', text: 'Preencha o Token, Usuário/Dono e Repositório.' });
      return;
    }

    setIsSyncing(true);
    setStatusMsg({ type: 'info', text: 'Verificando acesso ao repositório GitHub...' });

    try {
      const res = await fetch(`https://api.github.com/repos/${config.owner.trim()}/${config.repo.trim()}`, {
        headers: {
          Authorization: `Bearer ${config.token.trim()}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      if (res.ok) {
        const repoData = await res.json();
        setStatusMsg({
          type: 'success',
          text: `Conexão bem sucedida com o repositório '${repoData.full_name}' (${repoData.private ? 'Privado' : 'Público'}).`
        });
      } else if (res.status === 404) {
        setStatusMsg({
          type: 'error',
          text: 'Repositório não encontrado. Verifique o nome do usuário/organização e repositório.'
        });
      } else if (res.status === 401 || res.status === 403) {
        setStatusMsg({
          type: 'error',
          text: 'Acesso negado. Token do GitHub inválido ou sem permissões de leitura/escrita.'
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: `Erro de conexão (${res.status}): ${res.statusText}`
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: `Erro de rede ou conexão: ${err?.message || 'Falha ao conectar ao GitHub'}`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Perform Synchronization (Pull, Merge & Push)
  const handlePerformSync = async (mode: 'sync' | 'pull' | 'push') => {
    if (!isConfigValid) {
      setStatusMsg({ type: 'error', text: 'Configure as credenciais do GitHub antes de sincronizar.' });
      return;
    }

    setIsSyncing(true);
    setStatusMsg({ type: 'info', text: 'Acessando repositório do GitHub...' });

    const owner = config.owner.trim();
    const repo = config.repo.trim();
    const branch = (config.branch.trim() || 'main');
    const path = (config.filePath.trim() || 'transformers-db.json');
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

    try {
      // 1. GET Remote File
      const getRes = await fetch(url, {
        headers: {
          Authorization: `Bearer ${config.token.trim()}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      let remoteSha: string | null = null;
      let remoteTransformers: TransformerSpec[] = [];

      if (getRes.ok) {
        const remoteData = await getRes.json();
        remoteSha = remoteData.sha;
        if (remoteData.content) {
          try {
            const decodedJson = decodeBase64ToUtf8(remoteData.content);
            const parsed = JSON.parse(decodedJson);
            if (Array.isArray(parsed)) {
              remoteTransformers = parsed.map((t: any) => ({
                ...t,
                category: t.category || (t.state as any) || 'NOVO',
                state: t.state || t.category || 'NOVO'
              }));
            }
          } catch (e) {
            console.warn('Não foi possível parsear o arquivo JSON remoto do GitHub', e);
          }
        }
      } else if (getRes.status !== 404) {
        const errorJson = await getRes.json().catch(() => ({}));
        throw new Error(errorJson.message || `Erro ao consultar o GitHub (Status ${getRes.status})`);
      }

      // 2. Decide dataset based on mode
      let finalTransformers: TransformerSpec[] = [];
      let addedFromRemoteCount = 0;

      if (mode === 'pull') {
        finalTransformers = remoteTransformers;
      } else if (mode === 'push') {
        finalTransformers = localTransformers;
      } else {
        // Mode 'sync': Intelligent Merge
        const map = new Map<string, TransformerSpec>();

        // Add remote first
        remoteTransformers.forEach(t => {
          if (t && t.id) map.set(t.id, t);
        });

        const initialMapSize = map.size;

        // Add local (keeps local updates or adds new local ones)
        localTransformers.forEach(t => {
          if (t && t.id) map.set(t.id, t);
        });

        addedFromRemoteCount = map.size - localTransformers.length;
        if (addedFromRemoteCount < 0) addedFromRemoteCount = 0;

        finalTransformers = Array.from(map.values());
      }

      // 3. Push to GitHub (PUT) if mode is 'sync' or 'push'
      if (mode === 'sync' || mode === 'push') {
        setStatusMsg({ type: 'info', text: 'Enviando banco de dados atualizado para o GitHub...' });

        const repoTransformers = finalTransformers.map((t) => {
          const { category, ...rest } = t;
          return {
            ...rest,
            state: t.state || t.category || 'NOVO'
          };
        });
        const jsonContent = JSON.stringify(repoTransformers, null, 2);
        const base64Content = encodeUtf8ToBase64(jsonContent);

        const putBody: any = {
          message: `sync: atualização de transformadores por técnico em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
          content: base64Content,
          branch: branch
        };

        if (remoteSha) {
          putBody.sha = remoteSha;
        }

        const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${config.token.trim()}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(putBody)
        });

        if (!putRes.ok) {
          const putErr = await putRes.json().catch(() => ({}));
          throw new Error(putErr.message || `Erro ao salvar arquivo no GitHub (${putRes.status})`);
        }
      }

      // 4. Update Local Database State
      onUpdateTransformers(finalTransformers);

      const nowIso = new Date().toLocaleString('pt-BR');
      setLastSyncTime(nowIso);
      localStorage.setItem('tx_github_last_sync', nowIso);

      let summaryText = '';
      if (mode === 'sync') {
        summaryText = `Sincronização concluída com sucesso! Banco atualizado com ${finalTransformers.length} transformador(es) (${addedFromRemoteCount} novo(s) baixado(s) de outros técnicos).`;
      } else if (mode === 'pull') {
        summaryText = `Download concluído! ${finalTransformers.length} transformador(es) carregados do repositório remoto.`;
      } else {
        summaryText = `Upload concluído! ${finalTransformers.length} transformador(es) enviados para o repositório GitHub.`;
      }

      setStatusMsg({ type: 'success', text: summaryText });
    } catch (err: any) {
      console.error('Erro de sincronia GitHub:', err);
      setStatusMsg({
        type: 'error',
        text: `Falha na sincronização: ${err?.message || 'Erro desconhecido'}`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xl max-w-xl w-full p-5 text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                SINCRONIZAÇÃO EM NUVEM (GITHUB REPOSITORY)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Compartilhe e sincronize o banco de transformadores entre técnicos em tempo real
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sync Status Banner */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Banco de Dados Local:
              </span>{' '}
              <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                {localTransformers.length} transformadores
              </span>
            </div>
          </div>
          {lastSyncTime && (
            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
              Última sincronia: <span className="font-bold text-slate-700 dark:text-slate-300">{lastSyncTime}</span>
            </div>
          )}
        </div>

        {/* Form Inputs */}
        <div className="space-y-3">
          {/* GitHub Token */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Token de Acesso Pessoal (GitHub Personal Access Token) *
              </span>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=TrafoAnalytix_Sync"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-mono"
              >
                Criar Token no GitHub ↗
              </a>
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={config.token}
                onChange={(e) => setConfig({ ...config, token: e.target.value })}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 pr-8 text-xs font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Necessário permissão <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-amber-600 dark:text-amber-400">repo</code> para ler e gravar o arquivo JSON no repositório.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Owner / Org */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Usuário / Organização (Owner) *
              </label>
              <input
                type="text"
                value={config.owner}
                onChange={(e) => setConfig({ ...config, owner: e.target.value })}
                placeholder=""
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Repo Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nome do Repositório (Repository) *
              </label>
              <input
                type="text"
                value={config.repo}
                onChange={(e) => setConfig({ ...config, repo: e.target.value })}
                placeholder=""
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Branch */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Branch Padrão
              </label>
              <input
                type="text"
                value={config.branch}
                onChange={(e) => setConfig({ ...config, branch: e.target.value })}
                placeholder="main"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* File Path */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nome do Arquivo JSON
              </label>
              <input
                type="text"
                value={config.filePath}
                onChange={(e) => setConfig({ ...config, filePath: e.target.value })}
                placeholder="transformers-db.json"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Feedback Message Alert */}
        {statusMsg && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : statusMsg.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                : 'bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            ) : statusMsg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            ) : (
              <RefreshCw className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400 animate-spin mt-0.5" />
            )}
            <div className="leading-relaxed font-sans">{statusMsg.text}</div>
          </div>
        )}

        {/* Action Buttons Bar */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isSyncing}
            className="w-full sm:w-auto px-3 py-1.5 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Testar Conexão</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handlePerformSync('pull')}
              disabled={isSyncing || !isConfigValid}
              title="Baixar do GitHub sem enviar alterações locais"
              className="flex-1 sm:flex-initial px-2.5 py-1.5 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <CloudDownload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Baixar Apenas</span>
            </button>

            <button
              type="button"
              onClick={() => handlePerformSync('push')}
              disabled={isSyncing || !isConfigValid}
              title="Enviar banco local para o GitHub sobrescrevendo"
              className="flex-1 sm:flex-initial px-2.5 py-1.5 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <CloudUpload className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Enviar Apenas</span>
            </button>

            <button
              type="button"
              onClick={() => handlePerformSync('sync')}
              disabled={isSyncing || !isConfigValid}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <ArrowUpDown className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>SINCRONIZAR AGORA</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
