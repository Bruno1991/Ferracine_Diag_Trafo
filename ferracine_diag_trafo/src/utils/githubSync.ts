import type { TransformerSpec } from '../types';
import {
  getOfflineDatabaseStatus,
  installRemoteOfflineDatabase,
  type OfflineDatabaseStatus
} from './sqliteAndSplitLoader';

const GITHUB_API = 'https://api.github.com';
const GITHUB_API_VERSION = '2026-03-10';

export interface GitHubSyncConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  transformerPath: string;
  databasePath: string;
}

export interface GitHubSyncResult {
  communityTransformers: TransformerSpec[];
  normativeTransformers: TransformerSpec[] | null;
  databaseStatus: OfflineDatabaseStatus;
  uploadedCount: number;
  downloadedCount: number;
  databaseUpdated: boolean;
  warnings: string[];
}

interface GitHubContentMetadata {
  sha?: string;
  content?: string;
  encoding?: string;
}

class GitHubRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function normalizedConfig(config: GitHubSyncConfig): GitHubSyncConfig {
  return {
    token: config.token.trim(),
    owner: config.owner.trim(),
    repo: config.repo.trim(),
    branch: config.branch.trim() || 'main',
    transformerPath: config.transformerPath.trim() || 'database/transformador-db.json',
    databasePath: config.databasePath.trim() || 'public/database/ferracine-trafo.sqlite'
  };
}

function encodedPath(path: string): string {
  return path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

function contentUrl(config: GitHubSyncConfig, path: string, includeRef = true): string {
  const base = `${GITHUB_API}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath(path)}`;
  return includeRef ? `${base}?ref=${encodeURIComponent(config.branch)}` : base;
}

function githubHeaders(config: GitHubSyncConfig, accept = 'application/vnd.github+json'): HeadersInit {
  return {
    Accept: accept,
    Authorization: `Bearer ${config.token}`,
    'X-GitHub-Api-Version': GITHUB_API_VERSION
  };
}

async function githubError(response: Response, fallback: string): Promise<GitHubRequestError> {
  const payload = await response.json().catch(() => ({})) as { message?: string };
  return new GitHubRequestError(payload.message || fallback, response.status);
}

function decodeBase64Bytes(content: string): Uint8Array {
  const binary = atob(content.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function encodeBytesBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function encodeTextBase64(text: string): string {
  return encodeBytesBase64(new TextEncoder().encode(text));
}

async function getMetadata(config: GitHubSyncConfig, path: string): Promise<GitHubContentMetadata | null> {
  const response = await fetch(contentUrl(config, path), { headers: githubHeaders(config) });
  if (response.status === 404) return null;
  if (!response.ok) throw await githubError(response, `Falha ao consultar ${path} no GitHub.`);
  return await response.json() as GitHubContentMetadata;
}

async function getRawBytes(config: GitHubSyncConfig, path: string): Promise<Uint8Array> {
  const response = await fetch(contentUrl(config, path), {
    headers: githubHeaders(config, 'application/vnd.github.raw+json')
  });
  if (!response.ok) throw await githubError(response, `Falha ao baixar ${path} do GitHub.`);
  return new Uint8Array(await response.arrayBuffer());
}

async function readCommunityFile(
  config: GitHubSyncConfig
): Promise<{ sha: string | null; transformers: TransformerSpec[] }> {
  const metadata = await getMetadata(config, config.transformerPath);
  if (!metadata) return { sha: null, transformers: [] };

  const bytes = metadata.content && metadata.encoding === 'base64'
    ? decodeBase64Bytes(metadata.content)
    : await getRawBytes(config, config.transformerPath);
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (!Array.isArray(parsed)) throw new Error('O arquivo colaborativo remoto nao contem uma lista valida.');

  return {
    sha: metadata.sha || null,
    transformers: parsed.map(normalizeCommunityTransformer).filter((item): item is TransformerSpec => item !== null)
  };
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCommunityTransformer(value: unknown): TransformerSpec | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<TransformerSpec>;
  if (!item.id || typeof item.id !== 'string') return null;
  if (item.dataOrigin === 'NORMATIVE' || item.state === 'REFERENCIA_NORMATIVA') return null;

  const powerKva = finiteNumber(item.powerKva);
  const primaryVoltageV = finiteNumber(item.primaryVoltageV);
  const secondaryVoltageV = finiteNumber(item.secondaryVoltageV);
  const secondaryNeutralV = finiteNumber(item.secondaryNeutralV);
  const impedancePercent = finiteNumber(item.impedancePercent);
  const noLoadLossW = finiteNumber(item.noLoadLossW);
  const loadLoss75cW = finiteNumber(item.loadLoss75cW);
  const totalLossW = finiteNumber(item.totalLossW);
  const efficiencyPercent = finiteNumber(item.efficiencyPercent);
  if ([powerKva, primaryVoltageV, secondaryVoltageV, secondaryNeutralV, impedancePercent, noLoadLossW, loadLoss75cW, totalLossW, efficiencyPercent].some((number) => number === null)) {
    return null;
  }

  const category = item.category === 'RECONDICIONADO' || item.category === 'USADO' ? item.category : 'NOVO';
  const phaseType = item.phaseType === 'MONOFASICO' || item.phaseType === 'BIFASICO' ? item.phaseType : 'TRIFASICO';
  return {
    ...item,
    id: item.id.trim().slice(0, 160),
    category,
    state: item.state || category,
    phaseType,
    powerKva: powerKva!,
    primaryVoltageV: primaryVoltageV!,
    secondaryVoltageV: secondaryVoltageV!,
    secondaryNeutralV: secondaryNeutralV!,
    impedancePercent: impedancePercent!,
    noLoadLossW: noLoadLossW!,
    loadLoss75cW: loadLoss75cW!,
    totalLossW: totalLossW!,
    efficiencyPercent: efficiencyPercent!,
    standardReference: String(item.standardReference || 'Placa cadastrada em campo'),
    dateAdded: String(item.dateAdded || new Date().toISOString().slice(0, 10)),
    dataOrigin: 'COMMUNITY',
    updatedAt: item.updatedAt || new Date(0).toISOString()
  };
}

export function isCommunityTransformer(transformer: TransformerSpec): boolean {
  if (transformer.dataOrigin === 'NORMATIVE' || transformer.state === 'REFERENCIA_NORMATIVA') return false;
  return true;
}

function mergeCommunityTransformers(remote: TransformerSpec[], local: TransformerSpec[]): TransformerSpec[] {
  const merged = new Map<string, TransformerSpec>();
  for (const candidate of [...remote, ...local]) {
    const item = normalizeCommunityTransformer(candidate);
    if (!item) continue;
    const current = merged.get(item.id);
    if (!current || Date.parse(item.updatedAt || '') >= Date.parse(current.updatedAt || '')) merged.set(item.id, item);
  }
  return Array.from(merged.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function stableCommunityJson(transformers: TransformerSpec[]): string {
  return JSON.stringify(transformers.map((item) => ({ ...item, dataOrigin: 'COMMUNITY' })), null, 2);
}

async function putCommunityFile(
  config: GitHubSyncConfig,
  transformers: TransformerSpec[],
  sha: string | null
): Promise<void> {
  const response = await fetch(contentUrl(config, config.transformerPath, false), {
    method: 'PUT',
    headers: {
      ...githubHeaders(config),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `sync: placas de transformadores ${new Date().toISOString()}`,
      content: encodeTextBase64(stableCommunityJson(transformers)),
      branch: config.branch,
      ...(sha ? { sha } : {})
    })
  });
  if (!response.ok) throw await githubError(response, 'Falha ao enviar os transformadores ao GitHub.');
}

export async function testGitHubConnection(input: GitHubSyncConfig): Promise<string> {
  const config = normalizedConfig(input);
  if (!config.token || !config.owner || !config.repo) throw new Error('Informe token, proprietario e repositorio.');
  const response = await fetch(
    `${GITHUB_API}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`,
    { headers: githubHeaders(config) }
  );
  if (!response.ok) throw await githubError(response, 'Nao foi possivel acessar o repositorio.');
  const repository = await response.json() as { full_name?: string; private?: boolean };
  return `${repository.full_name || `${config.owner}/${config.repo}`} (${repository.private ? 'privado' : 'publico'})`;
}

export async function syncWithGitHub(
  input: GitHubSyncConfig,
  localTransformers: TransformerSpec[]
): Promise<GitHubSyncResult> {
  const config = normalizedConfig(input);
  if (!config.token || !config.owner || !config.repo) throw new Error('Configuracao do GitHub incompleta.');

  const localCommunity = localTransformers
    .filter(isCommunityTransformer)
    .map(normalizeCommunityTransformer)
    .filter((item): item is TransformerSpec => item !== null);

  let finalCommunity: TransformerSpec[] = [];
  let remoteBeforeCount = 0;
  let pushed = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const remote = await readCommunityFile(config);
    remoteBeforeCount = remote.transformers.length;
    finalCommunity = mergeCommunityTransformers(remote.transformers, localCommunity);
    const changed = stableCommunityJson(finalCommunity) !== stableCommunityJson(remote.transformers);
    if (!changed) break;
    try {
      await putCommunityFile(config, finalCommunity, remote.sha);
      pushed = true;
      break;
    } catch (error) {
      if (!(error instanceof GitHubRequestError) || error.status !== 409 || attempt === 2) throw error;
    }
  }

  const warnings: string[] = [];
  let normativeTransformers: TransformerSpec[] | null = null;
  let databaseUpdated = false;
  try {
    const databaseMetadata = await getMetadata(config, config.databasePath);
    if (!databaseMetadata) {
      warnings.push(`Banco oficial nao encontrado em ${config.databasePath}.`);
    } else {
      const lastSha = localStorage.getItem('tx_github_database_sha');
      if (
        !databaseMetadata.sha ||
        databaseMetadata.sha !== lastSha ||
        getOfflineDatabaseStatus().source !== 'REMOTE'
      ) {
        const databaseBytes = await getRawBytes(config, config.databasePath);
        normativeTransformers = await installRemoteOfflineDatabase(databaseBytes);
        databaseUpdated = true;
        if (databaseMetadata.sha) localStorage.setItem('tx_github_database_sha', databaseMetadata.sha);
      }
    }
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : 'Falha ao validar o banco oficial remoto.');
  }

  return {
    communityTransformers: finalCommunity,
    normativeTransformers,
    databaseStatus: getOfflineDatabaseStatus(),
    uploadedCount: pushed ? localCommunity.length : 0,
    downloadedCount: Math.max(0, finalCommunity.length - localCommunity.length),
    databaseUpdated,
    warnings
  };
}
