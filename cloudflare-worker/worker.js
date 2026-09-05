/**
 * Cloudflare Worker: Ferracine Diag Trafo Sync Proxy
 * 
 * Funcionalidade:
 * - Recebe placas comunitárias cadastradas pelos eletricistas em campo.
 * - Lê a base atual de transformadores do GitHub (database/transformador-db.json).
 * - Mescla de forma inteligente e realiza o commit no GitHub usando o token de ambiente secreto.
 * - Verifica o SHA do banco SQLite oficial (public/database/ferracine-trafo.sqlite) e retorna para o app.
 * - Segurança: O token do GitHub NUNCA chega ao navegador do cliente.
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'online',
        service: 'Ferracine Diag Trafo Cloudflare Worker Sync',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Endpoint principal de sincronização
    if (url.pathname === '/sync' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const localTransformers = Array.isArray(body.communityTransformers) ? body.communityTransformers : [];
        const lastDatabaseSha = body.lastDatabaseSha || '';

        const GITHUB_TOKEN = env.GITHUB_TOKEN;
        const OWNER = env.GITHUB_OWNER || 'Bruno1991';
        const REPO = env.GITHUB_REPO || 'Ferracine_Diag_Trafo';
        const BRANCH = env.GITHUB_BRANCH || 'main';

        if (!GITHUB_TOKEN) {
          return new Response(JSON.stringify({
            success: false,
            error: 'GITHUB_TOKEN não configurado nas variáveis de ambiente do Cloudflare Worker.'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const ghHeaders = {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'User-Agent': 'Ferracine-Diag-Trafo-Worker',
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        };

        // 1. Obter arquivo de placas do GitHub
        const platesUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/database/transformador-db.json?ref=${BRANCH}`;
        const platesRes = await fetch(platesUrl, { headers: ghHeaders });

        let remoteTransformers = [];
        let platesSha = null;

        if (platesRes.ok) {
          const platesData = await platesRes.json();
          platesSha = platesData.sha;
          if (platesData.content) {
            const rawText = atob(platesData.content.replace(/\s/g, ''));
            try {
              remoteTransformers = JSON.parse(rawText);
            } catch {
              remoteTransformers = [];
            }
          }
        }

        // 2. Mesclar placas locais com remotas
        const mergedMap = new Map();
        for (const candidate of [...remoteTransformers, ...localTransformers]) {
          if (!candidate || !candidate.id) continue;
          const current = mergedMap.get(candidate.id);
          if (!current || (candidate.updatedAt && candidate.updatedAt > (current.updatedAt || ''))) {
            mergedMap.set(candidate.id, candidate);
          }
        }
        const finalCommunity = Array.from(mergedMap.values()).sort((a, b) => a.id.localeCompare(b.id));

        // 3. Se houver novidades, comitar no GitHub
        let committed = false;
        const newJson = JSON.stringify(finalCommunity, null, 2);
        const oldJson = JSON.stringify(remoteTransformers, null, 2);

        if (newJson !== oldJson) {
          const putRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/database/transformador-db.json`, {
            method: 'PUT',
            headers: { ...ghHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `sync(worker): placas colaborativas ${new Date().toISOString()}`,
              content: btoa(unescape(encodeURIComponent(newJson))),
              branch: BRANCH,
              ...(platesSha ? { sha: platesSha } : {})
            })
          });

          if (putRes.ok) {
            committed = true;
          } else {
            const errBody = await putRes.text();
            console.error('Falha ao commitar no GitHub:', errBody);
          }
        }

        // 4. Verificar SHA do SQLite oficial
        const sqliteMetaUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/public/database/ferracine-trafo.sqlite?ref=${BRANCH}`;
        const sqliteRes = await fetch(sqliteMetaUrl, { headers: ghHeaders });
        let databaseSha = null;
        let databaseUpdated = false;

        if (sqliteRes.ok) {
          const sqliteData = await sqliteRes.json();
          databaseSha = sqliteData.sha;
          if (databaseSha && databaseSha !== lastDatabaseSha) {
            databaseUpdated = true;
          }
        }

        return new Response(JSON.stringify({
          success: true,
          communityTransformers: finalCommunity,
          committed,
          uploadedCount: committed ? localTransformers.length : 0,
          downloadedCount: Math.max(0, finalCommunity.length - localTransformers.length),
          databaseSha,
          databaseUpdated,
          databaseDownloadUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/public/database/ferracine-trafo.sqlite`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Erro interno do servidor Worker'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Endpoint não encontrado', { status: 404, headers: corsHeaders });
  }
};
