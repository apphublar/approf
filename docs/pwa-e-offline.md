# PWA e Offline

## Implementado

No app das professoras:

- Manifest em `apps/professora/public/manifest.webmanifest`.
- Icone em `apps/professora/public/icons/icon.svg`.
- Tela offline em `apps/professora/public/offline.html`.
- Service worker em `apps/professora/public/sw.js`.
- Registro em `apps/professora/src/services/pwa.ts`.

## Comportamento atual

- O service worker registra somente em build de producao.
- O app shell e assets principais entram em cache.
- Navegacoes offline tentam carregar o app cacheado.
- Se nao houver app shell, cai na pagina `offline.html`.

## Pendente para offline real

Quando o backend estiver conectado:

1. Criar fila local de mutacoes.
2. Salvar anotacoes offline com status `pending_sync`.
3. Sincronizar ao reconectar.
4. Resolver conflitos por `updated_at`.
5. Mostrar estado visual: salvo localmente, sincronizando, sincronizado, erro.
6. Evitar cachear fotos de criancas sem necessidade.

## Regra de privacidade offline

Dados sensiveis em cache local devem ser minimizados. Fotos de criancas nao devem ser salvas agressivamente no cache do service worker.
