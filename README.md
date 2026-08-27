# Ferracine Diag Trafo

## Publicação web

O workflow `.github/workflows/deploy-pages.yml`, localizado na raiz do repositório, compila e publica automaticamente a aplicação no GitHub Pages a cada alteração em `main`. O caminho-base é obtido do próprio Pages durante o build, permitindo que SQLite, WebAssembly e service worker funcionem no subdiretório do repositório.

## Banco offline

A fonte oficial usada nos diagnósticos é:

`public/database/ferracine-trafo.sqlite`

- Web: carregada por `sql.js` com o arquivo local `public/vendor/sql-wasm.wasm`, sem CDN.
- Android: o mesmo SQLite pode ser empacotado em `assets/` e aberto com SQLite ou Room.
- O service worker armazena o aplicativo, o SQLite e o WASM para recarga sem rede.
- A matriz de elos fusíveis é proveniente da Tabela 16 da ETU 109.1 (mineral) e da ETU 109.2 (vegetal).

O navegador exige HTTPS ou `localhost` para registrar o service worker. Depois da primeira abertura, o diagnóstico continua funcionando sem conexão.

## Sincronismo opcional com o GitHub

O botão **Sincronizar agora**, na aba **Configurações**, realiza duas operações independentes:

1. Mescla as placas cadastradas em campo com `database/transformador-db.json`. Apenas registros comunitários são enviados; perfis normativos nunca são publicados pelo usuário.
2. Verifica `public/database/ferracine-trafo.sqlite` no repositório. Se houver uma versão oficial mais recente e válida, ela é instalada no armazenamento offline do navegador.

O SQLite recebido é validado antes de substituir a versão ativa: esquema, tabelas obrigatórias, conteúdo mínimo e data de geração precisam ser compatíveis. Se a validação falhar, o banco anterior continua ativo.

Para sincronizar, use um token fine-grained limitado ao repositório, com permissão **Contents: read/write**. O token fica somente em `sessionStorage`, não é gravado no SQLite, no `localStorage` nem no build.

### Publicação de uma atualização oficial

O desenvolvedor deve gerar e revisar o novo SQLite, atualizar sua versão/data de geração e publicar o arquivo no caminho configurado. Os clientes somente baixam esse banco; não enviam alterações de normas, tabelas ou cálculos.
