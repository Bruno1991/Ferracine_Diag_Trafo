import { TransformerSpec } from '../types';

export interface GitHubSyncConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
}

/**
 * Configuração Fixa do Repositório da Equipe (ferracine_diag_trafo)
 */
export const FIXED_TEAM_GITHUB_CONFIG: GitHubSyncConfig = {
  token: atob('Z2hwX2dWQkU4cG1HdVVVMHduRkY0ZU5UTDNJMFM4ZTZHM3ZhTlph'),
  owner: 'Bruno1991',
  repo: 'Ferracine_Diag_Trafo',
  branch: 'main',
  filePath: 'database/transformador-db.json'
};

/**
 * Recupera as configurações salvas no localStorage ou retorna as padrões da equipe
 */
export function getSavedGitHubConfig(): GitHubSyncConfig {
  try {
    const saved = localStorage.getItem('tx_github_sync_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        token: parsed.token || FIXED_TEAM_GITHUB_CONFIG.token,
        owner: parsed.owner || FIXED_TEAM_GITHUB_CONFIG.owner,
        repo: parsed.repo || FIXED_TEAM_GITHUB_CONFIG.repo,
        branch: parsed.branch || FIXED_TEAM_GITHUB_CONFIG.branch,
        filePath: parsed.filePath || FIXED_TEAM_GITHUB_CONFIG.filePath
      };
    }
  } catch (e) {
    console.error('Erro ao ler configuracao do github', e);
  }
  return FIXED_TEAM_GITHUB_CONFIG;
}

/**
 * Salva a configuração no localStorage
 */
export function saveGitHubConfig(config: GitHubSyncConfig): void {
  try {
    localStorage.setItem('tx_github_sync_config', JSON.stringify(config));
  } catch (e) {
    console.error('Erro ao salvar configuracao do github', e);
  }
}

// Helpers UTF-8 safe base64
export function encodeUtf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeBase64ToUtf8(base64Str: string): string {
  const cleanBase64 = base64Str.replace(/\s/g, '');
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Busca o arquivo JSON remoto do GitHub
 */
export async function fetchRemoteTransformers(
  config: GitHubSyncConfig = getSavedGitHubConfig()
): Promise<{ sha: string | null; transformers: TransformerSpec[] }> {
  const owner = config.owner.trim();
  const repo = config.repo.trim();
  const branch = config.branch.trim() || 'main';
  const path = config.filePath.trim() || 'database/transformador-db.json';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token.trim()}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });

  if (!res.ok) {
    if (res.status === 404) {
      return { sha: null, transformers: [] };
    }
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.message || `Erro no GitHub (Status ${res.status})`);
  }

  const remoteData = await res.json();
  const sha = remoteData.sha || null;
  let remoteTransformers: TransformerSpec[] = [];

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
      console.warn('Erro ao decodificar JSON remoto do GitHub:', e);
    }
  }

  return { sha, transformers: remoteTransformers };
}

/**
 * Envia/Atualiza o banco de transformadores no GitHub (PUT)
 */
export async function pushTransformersToRemote(
  transformers: TransformerSpec[],
  sha: string | null = null,
  config: GitHubSyncConfig = getSavedGitHubConfig()
): Promise<void> {
  const owner = config.owner.trim();
  const repo = config.repo.trim();
  const branch = config.branch.trim() || 'main';
  const path = config.filePath.trim() || 'database/transformador-db.json';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const repoTransformers = transformers.map((t) => {
    const { category, ...rest } = t;
    return {
      ...rest,
      state: t.state || t.category || 'NOVO'
    };
  });

  const jsonContent = JSON.stringify(repoTransformers, null, 2);
  const base64Content = encodeUtf8ToBase64(jsonContent);

  const body: any = {
    message: `sync: atualização de transformadores por equipe em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
    content: base64Content,
    branch: branch
  };

  if (sha) {
    body.sha = sha;
  }

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${config.token.trim()}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!putRes.ok) {
    const putErr = await putRes.json().catch(() => ({}));
    throw new Error(putErr.message || `Erro ao salvar arquivo no GitHub (${putRes.status})`);
  }
}
