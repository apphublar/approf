# Materiais de Apoio

## Fluxo correto

O material de apoio e gerenciado pelo Super Admin.

1. Admin cria uma categoria.
2. Admin sobe o arquivo.
3. Admin informa título, descrição, categoria e status.
4. Quando o status vira `published`, o material aparece para todas as professoras.
5. Professora acessa o app PWA, entra em Material de Apoio e baixa o arquivo.

## Status

- `draft`: material em preparacao, invisivel para professoras.
- `published`: disponível para professoras autenticadas.
- `archived`: removido da biblioteca ativa, mantido para historico.

## Banco e storage

Tabelas:

- `material_categories`
- `materials`

Bucket:

- `material-files`

Regras:

- Apenas Admin/Super Admin faz upload, edita, publica ou arquiva.
- Professoras podem visualizar e baixar apenas materiais publicados.
- Materiais gerais não devem ser misturados com fotos ou relatórios de crianças.

## Campos principais

- título;
- descrição;
- categoria;
- nome do arquivo;
- tipo do arquivo;
- tamanho do arquivo;
- status;
- data de publicação;
- contador de downloads.

## Pendente

Quando o Supabase liberar:

- conectar upload real ao Storage;
- gerar URL segura de download;
- exibir materiais publicados no app das professoras;
- incrementar `downloads_count`;
- registrar publicacoes importantes em `admin_action_logs`.
