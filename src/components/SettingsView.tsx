import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Github,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  RefreshCw,
  BookOpen,
  Scale,
  Zap,
  Key,
  FolderGit2,
  Eye,
  EyeOff,
  Database,
  CloudDownload,
  CloudUpload,
  ArrowUpDown,
  AlertCircle,
  Download,
  Upload,
  FileJson,
  RotateCcw
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

interface SettingsViewProps {
  transformers: TransformerSpec[];
  onUpdateTransformers: (updated: TransformerSpec[]) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  transformers,
  onUpdateTransformers
}) => {
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);

  // GitHub Sync State
  const [githubConfig, setGithubConfig] = useState<GitHubSyncConfig>(() => getSavedGitHubConfig());

  const [showToken, setShowToken] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem('tx_github_last_sync') || null;
  });

  useEffect(() => {
    saveGitHubConfig(githubConfig);
  }, [githubConfig]);

  const isConfigValid = Boolean(githubConfig.token.trim() && githubConfig.owner.trim() && githubConfig.repo.trim());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Testar Conexão com Repositório GitHub
  const handleTestConnection = async () => {
    if (!isConfigValid) {
      setStatusMsg({
        type: 'error',
        text: 'Preencha o Token (PAT), Usuário/Organização e Nome do Repositório antes de testar a conexão.'
      });
      return;
    }
    setIsSyncing(true);
    setStatusMsg({ type: 'info', text: 'Testando conexão com o repositório GitHub...' });

    try {
      const res = await fetch(`https://api.github.com/repos/${githubConfig.owner.trim()}/${githubConfig.repo.trim()}`, {
        headers: {
          Authorization: `Bearer ${githubConfig.token.trim()}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      if (res.ok) {
        const repoData = await res.json();
        setStatusMsg({
          type: 'success',
          text: `Conexão bem-sucedida! Repositório '${repoData.full_name}' (${repoData.private ? 'Privado' : 'Público'}) acessível.`
        });
      } else if (res.status === 404) {
        setStatusMsg({
          type: 'error',
          text: 'Repositório não encontrado no GitHub. Verifique Usuário/Organização e Nome do Repositório.'
        });
      } else if (res.status === 401 || res.status === 403) {
        setStatusMsg({
          type: 'error',
          text: 'Acesso negado. Token de Acesso Pessoal (PAT) inválido ou sem permissão repo.'
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: `Erro de resposta do GitHub (${res.status}): ${res.statusText}`
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: `Erro de rede ou conexão: ${err?.message || 'Falha ao conectar com o GitHub'}`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // 2. Exportar JSON do Banco Local
  const handleExportJson = () => {
    try {
      const jsonString = JSON.stringify(transformers, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `banco_transformadores_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMsg({
        type: 'success',
        text: `Arquivo JSON exportado com sucesso contendo ${transformers.length} transformador(es)!`
      });
    } catch (e: any) {
      setStatusMsg({
        type: 'error',
        text: `Erro ao exportar arquivo JSON: ${e?.message || 'Falha na geração do arquivo'}`
      });
    }
  };

  // 3. Importar JSON Localmente
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) {
          throw new Error('O arquivo deve conter uma lista (array) de transformadores.');
        }

        const importedList: TransformerSpec[] = parsed.map((t: any) => ({
          ...t,
          category: t.category || t.state || 'NOVO',
          state: t.state || t.category || 'NOVO'
        }));

        const map = new Map<string, TransformerSpec>();
        transformers.forEach(t => { if (t && t.id) map.set(t.id, t); });
        importedList.forEach(t => { if (t && t.id) map.set(t.id, t); });

        const finalMerged = Array.from(map.values());
        onUpdateTransformers(finalMerged);

        try {
          localStorage.setItem('tx_analytix_transformers', JSON.stringify(finalMerged));
        } catch (err) {
          console.error('Erro ao salvar localmente:', err);
        }

        setStatusMsg({
          type: 'success',
          text: `Importação concluída! Banco local atualizado para ${finalMerged.length} transformador(es).`
        });
      } catch (err: any) {
        setStatusMsg({
          type: 'error',
          text: `Falha ao importar arquivo JSON: ${err?.message || 'Formato inválido'}`
        });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  // 4. Executar Download / Atualizar / Sincronizar com GitHub
  const handlePerformSyncMode = async (mode: 'sync' | 'pull' | 'push') => {
    if (!isConfigValid) {
      setStatusMsg({ type: 'error', text: 'Configure o Token, Usuário e Repositório do GitHub antes de continuar.' });
      return;
    }

    setIsSyncing(true);
    setStatusMsg({ type: 'info', text: 'Conectando ao repositório no GitHub...' });

    const owner = githubConfig.owner.trim();
    const repo = githubConfig.repo.trim();
    const branch = (githubConfig.branch.trim() || 'main');
    const path = (githubConfig.filePath.trim() || 'transformers-db.json');
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

    try {
      const getRes = await fetch(url, {
        headers: {
          Authorization: `Bearer ${githubConfig.token.trim()}`,
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
                category: t.category || t.state || 'NOVO',
                state: t.state || t.category || 'NOVO'
              }));
            }
          } catch (e) {
            console.warn('Erro ao decodificar o arquivo JSON remoto do GitHub', e);
          }
        }
      } else if (getRes.status !== 404) {
        const errorJson = await getRes.json().catch(() => ({}));
        throw new Error(errorJson.message || `Erro no GitHub (Status ${getRes.status})`);
      }

      let finalTransformers: TransformerSpec[] = [];
      let addedFromRemoteCount = 0;

      if (mode === 'pull') {
        finalTransformers = remoteTransformers;
      } else if (mode === 'push') {
        finalTransformers = transformers;
      } else {
        const map = new Map<string, TransformerSpec>();
        remoteTransformers.forEach(t => { if (t && t.id) map.set(t.id, t); });

        const initialSize = map.size;
        transformers.forEach(t => { if (t && t.id) map.set(t.id, t); });

        addedFromRemoteCount = map.size - transformers.length;
        if (addedFromRemoteCount < 0) addedFromRemoteCount = 0;

        finalTransformers = Array.from(map.values());
      }

      if (mode === 'sync' || mode === 'push') {
        setStatusMsg({ type: 'info', text: 'Enviando atualizações para o GitHub...' });

        const repoTransformers = finalTransformers.map((t) => {
          const { category, ...rest } = t;
          return {
            ...rest,
            state: t.state || t.category || 'NOVO'
          };
        });
        const jsonContent = JSON.stringify(repoTransformers, null, 2);
        const base64Content = encodeUtf8ToBase64(jsonContent);

        const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${githubConfig.token.trim()}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `sync: atualização de transformadores por técnico em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
            content: base64Content,
            branch: branch,
            ...(remoteSha ? { sha: remoteSha } : {})
          })
        });

        if (!putRes.ok) {
          const putErr = await putRes.json().catch(() => ({}));
          throw new Error(putErr.message || `Erro ao salvar arquivo no GitHub (${putRes.status})`);
        }
      }

      onUpdateTransformers(finalTransformers);
      try {
        localStorage.setItem('tx_analytix_transformers', JSON.stringify(finalTransformers));
      } catch (e) {
        console.error('Erro ao salvar localmente:', e);
      }

      const nowIso = new Date().toLocaleString('pt-BR');
      setLastSyncTime(nowIso);
      localStorage.setItem('tx_github_last_sync', nowIso);

      let summaryText = '';
      if (mode === 'sync') {
        summaryText = `Sincronização concluída! Banco atualizado para ${finalTransformers.length} transformador(es) (${addedFromRemoteCount} novo(s) baixado(s)).`;
      } else if (mode === 'pull') {
        summaryText = `Download concluído! ${finalTransformers.length} transformador(es) baixados do GitHub.`;
      } else {
        summaryText = `Upload / Atualização concluída! ${finalTransformers.length} transformador(es) enviados ao GitHub.`;
      }

      setStatusMsg({ type: 'success', text: summaryText });
    } catch (err: any) {
      console.error('Erro de operação com o GitHub:', err);
      setStatusMsg({
        type: 'error',
        text: `Falha na operação: ${err?.message || 'Erro de comunicação'}`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmDeleteLocalDatabase = () => {
    try {
      localStorage.removeItem('tx_analytix_transformers');
    } catch (e) {
      console.error('Failed to remove tx_analytix_transformers from localStorage', e);
    }
    onUpdateTransformers([]);
    setIsDeleteConfirmOpen(false);
    setDeleteSuccessMsg('O banco de dados local do dispositivo foi totalmente deletado com sucesso.');
    setTimeout(() => setDeleteSuccessMsg(null), 6000);
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              CONFIGURAÇÕES E GERENCIAMENTO DE DADOS
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Central de sincronização completa do sistema e gerenciamento de banco de dados
            </p>
          </div>
        </div>
      </div>

      {deleteSuccessMsg && (
        <div className="p-3 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-mono flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{deleteSuccessMsg}</span>
        </div>
      )}

      {/* BLOCK 1: DADOS DO BANCO REMOTO / REPOSITÓRIO GITHUB */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                DADOS DO BANCO REMOTO / REPOSITÓRIO (GITHUB)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Parâmetros de acesso ao repositório GitHub para persistência e compartilhamento de dados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            {isConfigValid ? (
              <span className="px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Repositório Configurado
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Sem Repositório Remoto
              </span>
            )}
          </div>
        </div>

        {/* Credentials Form Panel */}
        <div className="bg-slate-50 dark:bg-slate-950/60 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 font-mono text-[11px] flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Token Pessoal do GitHub (PAT) *
                </span>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=TrafoAnalytix_Sync"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-mono"
                >
                  Gerar token ↗
                </a>
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={githubConfig.token}
                  onChange={(e) => setGithubConfig({ ...githubConfig, token: e.target.value })}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 pr-8 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 font-mono text-[11px] flex items-center gap-1">
                <FolderGit2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Usuário / Organização (Owner) *
              </label>
              <input
                type="text"
                value={githubConfig.owner}
                onChange={(e) => setGithubConfig({ ...githubConfig, owner: e.target.value })}
                placeholder="ex: energisa-tecnicos"
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 font-mono text-[11px] flex items-center gap-1">
                <Github className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                Nome do Repositório (Repository) *
              </label>
              <input
                type="text"
                value={githubConfig.repo}
                onChange={(e) => setGithubConfig({ ...githubConfig, repo: e.target.value })}
                placeholder="ex: diagnostico-trafos-db"
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 font-mono text-[11px]">
                  Branch Padrão
                </label>
                <input
                  type="text"
                  value={githubConfig.branch}
                  onChange={(e) => setGithubConfig({ ...githubConfig, branch: e.target.value })}
                  placeholder="main"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 font-mono text-[11px]">
                  Arquivo JSON
                </label>
                <input
                  type="text"
                  value={githubConfig.filePath}
                  onChange={(e) => setGithubConfig({ ...githubConfig, filePath: e.target.value })}
                  placeholder="transformers-db.json"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Overview List of Norms, Formulas, and Transformers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Base Normativa ANEEL</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                PRODIST Mód. 8, faixas de tensão regulatórias e especificações Energisa NDU/ETU.
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                <Scale className="w-3.5 h-3.5" />
                <span>Fórmulas de Cálculo ABNT</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                Regras matemáticas NBR 5440/5356, fatores de correção térmica (Tk) e matriz de elos fusíveis.
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                <Database className="w-3.5 h-3.5" />
                <span>Transformadores ({transformers.length})</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                Equipamentos cadastrados mantidos em memória local e integrados via repositório GitHub.
              </p>
            </div>
          </div>

          {/* Action Buttons Toolbar for Remote Database & Local JSON */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Local Actions & Connection Test */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isSyncing}
                  className="px-3 py-1.5 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  title="Testar se o repositório GitHub e token estão acessíveis"
                >
                  <FolderGit2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Testar Conexão</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportJson}
                  className="px-3 py-1.5 rounded text-xs font-bold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 transition cursor-pointer flex items-center gap-1.5"
                  title="Baixar backup local em arquivo .JSON"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Exportar JSON Local</span>
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImportJson}
                  accept=".json"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded text-xs font-bold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/80 dark:hover:bg-blue-900/80 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-800 transition cursor-pointer flex items-center gap-1.5"
                  title="Importar e mesclar um arquivo .JSON no banco local"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Importar JSON Local</span>
                </button>
              </div>

              {/* GitHub Operations: Download, Upload, Sync */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePerformSyncMode('pull')}
                  disabled={isSyncing || !isConfigValid}
                  title="Baixar do GitHub sem enviar alterações locais"
                  className="px-3 py-1.5 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CloudDownload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Baixar (Pull)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePerformSyncMode('push')}
                  disabled={isSyncing || !isConfigValid}
                  title="Enviar banco local para o GitHub"
                  className="px-3 py-1.5 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CloudUpload className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Atualizar (Push)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePerformSyncMode('sync')}
                  disabled={isSyncing || !isConfigValid}
                  className="px-3.5 py-1.5 rounded text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  title="Mesclar alterações locais com o repositório remoto"
                >
                  <ArrowUpDown className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sincronizar Repositório</span>
                </button>
              </div>
            </div>

            {/* Inline Status Message Alert */}
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
          </div>
        </div>
      </div>

      {/* BLOCK 3: LIMPEZA DO BANCO DE DADOS LOCAL */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  LIMPEZA DO BANCO DE DADOS LOCAL
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  Reset do armazenamento local do navegador
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Remove permanentemente todos os <strong>{transformers.length} equipamento(s)</strong> armazenados na memória local (localStorage) deste dispositivo.
          </p>
        </div>

        {/* Feedback Alert Banner for Deletion */}
        {deleteSuccessMsg && (
          <div className="p-3 rounded-lg border text-xs flex items-center justify-between gap-2.5 bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 animate-in fade-in duration-150">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div className="leading-relaxed font-sans font-semibold">{deleteSuccessMsg}</div>
            </div>
            <button
              type="button"
              onClick={() => setDeleteSuccessMsg(null)}
              className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 font-bold px-1.5 py-0.5 text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Status Local: <strong>{transformers.length} equipamento(s)</strong>
          </div>

          <button
            type="button"
            onClick={() => setIsDeleteConfirmOpen(true)}
            disabled={transformers.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-xs transition cursor-pointer border border-rose-700"
          >
            <Trash2 className="w-4 h-4" />
            <span>DELETAR BANCO LOCAL</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Local Database Deletion */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2 rounded-full bg-rose-100 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  Deletar Banco de Dados Local
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  Confirmação de exclusão do dispositivo
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded border border-rose-200 dark:border-rose-800/80 text-xs text-rose-900 dark:text-rose-200 leading-relaxed">
              <p className="font-bold mb-1">Atenção!</p>
              <p>
                Você está prestes a apagar <strong>{transformers.length} equipamento(s)</strong> salvos na memória local deste dispositivo. Esta ação é irreversível.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-3 py-1.5 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteLocalDatabase}
                className="px-3 py-1.5 rounded text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>SIM, DELETAR BANCO LOCAL</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
