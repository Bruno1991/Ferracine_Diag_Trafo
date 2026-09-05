# Cloudflare Worker — Ferracine Diag Trafo Sync

Este Worker atua como uma ponte segura e privada entre o aplicativo **Ferracine Diag Trafo** e o repositório GitHub.

## Por que usar este Worker?
1. **Segurança Máxima**: O seu Token do GitHub nunca é exposto no navegador nem no GitHub Pages. Ele fica guardado como variável secreta criptografada nos servidores da Cloudflare.
2. **Interface Limpa no App**: O aplicativo tem apenas o botão **"Sincronizar Agora"**, sem pedir tokens, senhas ou configurações para os eletricistas.
3. **Gratuito**: O plano gratuito da Cloudflare permite até 100.000 requisições por dia.

---

## Como Colocar no Ar em 3 Minutos (Pelo Navegador)

### Passo 1: Criar o Worker na Cloudflare
1. Acesse o painel da Cloudflare: [dash.cloudflare.com](https://dash.cloudflare.com/)
2. No menu lateral, clique em **Workers & Pages** > **Create application** > **Create Worker**.
3. Dê o nome de `ferracine-diag-trafo-sync` e clique em **Deploy**.

### Passo 2: Colar o Código do Worker
1. Na página do Worker recém-criado, clique em **Edit code** (Editar código).
2. Apague o código padrão e cole todo o conteúdo do arquivo [`worker.js`](worker.js).
3. Clique em **Deploy** no canto superior direito.

### Passo 3: Configurar o Token Secreto
1. Volte para a página principal do seu Worker na Cloudflare e clique na aba **Settings** > **Variables and Secrets**.
2. Em **Secrets**, clique em **Add**:
   - **Variable name**: `GITHUB_TOKEN`
   - **Value**: Cole o seu Token do GitHub (Fine-Grained ou Classic com permissão `repo` / `Contents: read/write`).
   - Clique em **Save and Deploy**.
3. (Opcional) Se quiser alterar o dono ou repositório, adicione as variáveis de texto normais:
   - `GITHUB_OWNER`: `Bruno1991`
   - `GITHUB_REPO`: `Ferracine_Diag_Trafo`
   - `GITHUB_BRANCH`: `main`

### Passo 4: Conectar a URL no App
Copie a URL do seu Worker (exemplo: `https://ferracine-diag-trafo-sync.seu-usuario.workers.dev`).
Pronto! A sincronização do app já pode usar essa URL.

---

## Como Fazer Deploy via Terminal (Wrangler)
Se preferir usar o terminal:
```bash
cd cloudflare-worker
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
# (digite o token quando solicitado)
npx wrangler deploy
```
