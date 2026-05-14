# Comunidade e Liberacoes

## Decisao

A Comunidade sera implementada no app, mas podera ficar oculta por controle do Super Admin.

O Super Admin deve conseguir:

- manter a Comunidade desligada;
- liberar apenas para professoras selecionadas;
- liberar para todas as contas;
- remover acesso de uma professora especifica;
- registrar alteracoes em auditoria.

## Fluxo no app

1. App consulta a feature `community`.
2. Se `release_mode = all`, mostra a Comunidade para todas.
3. Se `release_mode = selected`, mostra apenas para quem estiver em `feature_user_access`.
4. Se `release_mode = off`, a Comunidade fica oculta ou mostra tela de acesso restrito.

## Funcionalidades da Comunidade

- Feed de postagens.
- Criar postagem.
- Categoria da postagem:
  - duvida;
  - ideia;
  - material;
  - relato.
- Curtidas e comentarios mockados nesta fase.
- Moderacao futura pelo Super Admin.

## Banco planejado

- `feature_flags`
- `feature_user_access`
- `community_posts`

## Privacidade

- Nao permitir postagem com dados completos de criancas.
- Criar moderacao antes de liberar para toda a base.
- Permitir ocultar/remover post pelo Super Admin.
- Evitar imagens de criancas na Comunidade sem consentimento explicito.
