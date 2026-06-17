# Análise do redesign — Admin Approf

Documento de paridade entre o protótipo **Admin modernizado e organizado** (`.dc.html` interativo + screenshots) e o admin em produção (`apps/admin`).

**Protótipo extraído em:** `.prototype-admin/`  
**Admin atual:** `https://admin.approf.com.br` · Next.js App Router

---

## 1. Resumo executivo

O protótipo não é só visual — ele **reorganiza a navegação**, **unifica operações por professora** (ficha única) e adiciona **Avisos no app**, uma funcionalidade **inexistente** hoje no backend e no app professora.

| Categoria | Situação |
|-----------|----------|
| **Redesign visual (shell, cores, tipografia)** | ~40% já próximo; falta topbar global, grupos no menu, tokens do protótipo |
| **Telas existentes repaginadas** | Lógica backend em grande parte pronta; UI precisa ser reescrita |
| **Ficha única da professora** | **Não existe** — maior gap funcional |
| **Busca global** | **Não existe** |
| **Avisos no app** | **Não existe** (admin + Supabase + app) |
| **Toast de feedback** | **Não existe** (hoje usa `redirect` após forms) |
| **Dashboard novo** | Parcial — métricas e filas diferentes |
| **Auditoria com nome** | Parcial — metadata tem e-mail em alguns casos, UI mostra ID |
| **Privacidade com status real** | **Não existe** — hoje é checklist estático |

**Estimativa de esforço para paridade ~100%:** 3–5 semanas (1 dev), sendo ~40% UI, ~35% ficha + busca, ~25% Avisos no app (full stack).

---

## 2. Mapa do protótipo

### 2.1 Rotas / telas

| Rota protótipo | Rota admin atual | Grupo menu |
|----------------|------------------|------------|
| `dashboard` | `/` | — |
| `professoras` | `/professoras` | Pessoas |
| `professora` (ficha) | **inexistente** | — |
| `verificacoes` | `/verificacoes` | Pessoas (+ badge) |
| `assinaturas` | `/assinaturas` | Pessoas |
| `continuidade` | `/continuidade` | Pessoas |
| `materiais` | `/materiais` | Conteúdo (+ badge) |
| `liberacoes` | `/liberacoes` | Conteúdo |
| `avisos` | **inexistente** | Comunicação |
| `ia` | `/ia` | Sistema |
| `notificacoes` | `/notificacoes` | Sistema |
| `auditoria` | `/auditoria` | Sistema |
| `privacidade` | `/privacidade` | Sistema |

### 2.2 Shell global (presente em todas as telas)

| Elemento | Protótipo | Admin atual |
|----------|-----------|-------------|
| Sidebar 252px, `#0c2a1e` | Sim | ~280px, `--green-900` similar |
| Logo + “Operação e privacidade” | Sim | Sim |
| Menu com **grupos** (PESSOAS, CONTEÚDO, COMUNICAÇÃO, SISTEMA) | Sim | Lista flat em `mock-admin-data.ts` |
| **Badges** Verificações / Materiais | Sim (contagem pendente) | Não |
| Topbar sticky com **busca global** | Sim | Não |
| Badge **Produção** na topbar | Sim | Badge dentro de cada `PageHeader` |
| Fonte **Plus Jakarta Sans** | Sim | Inter |
| Toast fixo canto inferior direito | Sim | Não |
| Fundo `#f6f6f2`, cards brancos `#e8e7e1` | Sim | `#f6f8f5`, bordas `--line` |

---

## 3. Análise tela a tela

### 3.1 Dashboard (`/`)

**Protótipo mostra:**

- 4 cards: Professoras (total + pagando/trial), Assinaturas ativas, Custo IA 30d, **GizTokens liberados (bônus do mês)**
- Seção **“Filas que precisam de você”** — 3 cards clicáveis: verificações pendentes, denúncias abertas, pagamentos em atraso
- Tabela professoras recentes **clicável** → ficha
- Sidebar direita: **Distribuição de planos** (barras) + card escuro **GizTokens por plano**

**Admin atual:**

- 4 cards diferentes (inclui “Trials ativos”, sem GizTokens bônus)
- Grid com materiais recentes + checklist privacidade + 1 alerta denúncias
- Professoras recentes **não clicáveis**
- Métrica “Professoras” imprecisa (conta assinaturas de forma estranha)

**Implementar:**

| Item | Backend | UI |
|------|---------|-----|
| Métricas corretas (professoras, pagando, trial) | Query `profiles` + `subscriptions` | Card grid 4 colunas |
| GizTokens bônus mês | Somar `admin_action_logs` `teacher_giztokens_adjusted` ou delta `ai_usage_wallets.notes` | Card + formato “12,4k” |
| Filas clicáveis | Já tem dados (`teacher_profile_verifications`, `material_reports`, `subscriptions`) | Links `/verificacoes`, `/materiais`, `/assinaturas` |
| Distribuição planos | `group by plan` em subscriptions | Barras horizontais |
| Remover painéis materiais/privacidade do dashboard | — | Alinhar ao protótipo |

---

### 3.2 Professoras (`/professoras`)

**Protótipo:**

- Form GizTokens com **toggle** Adicionar / Definir mínimo (não `<select>`)
- Tabela: avatar iniciais, plano, status, verificação, IA mês, **barra progresso GizTokens**, chevron
- **Clique na linha** → ficha `/professoras/[id]`

**Admin atual:**

- Form GizTokens funcional (`adjustTeacherGiztokensAction`) ✓
- Tabela mais densa (telefone, link pagamento inline) — protótipo simplifica
- Sem link para ficha, sem barra de progresso visual, sem avatares

**Implementar:**

- Refatorar layout da tabela conforme protótipo
- Barra: `giztokensRemaining / giztokensIncluded` (dados já em `loadTeacherWalletsForMonth`)
- `onClick` → `router.push(/professoras/${id})`
- Manter server action; trocar `redirect` por toast (ver seção 6)

---

### 3.3 Ficha única (`/professoras/[id]`) — **NOVA**

**Protótipo — abas:**

| Aba | Conteúdo | Fonte de dados hoje |
|-----|----------|---------------------|
| Visão geral | Turmas, alunos, gerações mês, custo IA, saldo GizTokens, atividade recente | `profiles`, `classes`, `students`, `ai_generation_logs`, `ai_usage_wallets` |
| Assinatura | Editar plano, status, datas, link Stripe | `assinaturas/actions.ts` → `updateTeacherSubscription` |
| IA & GizTokens | Métricas 30d + form ajuste | `giztokens-admin.ts` |
| Verificação | Documento + aprovar/rejeitar | `/api/account/verification/admin` |
| Histórico | Audit log filtrado por professora | `admin_action_logs` filtrado por `metadata.teacherId` ou `target_id` |

**Header da ficha:**

- Nome, e-mail, escola (`schools.name`)
- Badges status / plano / verificação
- Botões rápidos: Liberar grátis, Avisar atraso, Bloquear → já existem em `assinaturas/actions.ts`

**Implementar:**

```
apps/admin/app/professoras/[id]/page.tsx
apps/admin/app/professoras/[id]/actions.ts (ou reexport)
apps/admin/app/components/TeacherDetailTabs.tsx
apps/admin/app/components/ToastProvider.tsx
```

**Paridade 100%:** todas as abas wired às actions/APIs existentes + histórico de auditoria enriquecido.

---

### 3.4 Assinaturas (`/assinaturas`)

**Protótipo:** métricas 4 + banner atraso + tabela simplificada (nome clicável, botões Grátis/Avisar/Bloquear por linha).

**Admin atual:** métricas similares ✓, banner bulk ✓, mas cada professora tem **formulário completo** inline (plano, status, datas, link) — protótipo **move isso para a ficha**.

**Decisão:** remover forms inline da listagem e manter só na aba Assinatura da ficha (como protótipo). Bulk actions permanecem na listagem.

---

### 3.5 Verificações (`/verificacoes`)

**Protótipo:** cards horizontais (nome, e-mail, Ver documento, Rejeitar, Aprovar). Empty state “Tudo em dia”.

**Admin atual:** funcional via API ✓, layout diferente (mais detalhes, notas, escolas).

**Implementar:** repaginar para cards; manter lógica `loadRequests` / `updateStatus`. Badge no menu = `pendingCount`.

---

### 3.6 Materiais (`/materiais`)

**Protótipo:** 4 métricas + tabela (título, autora, status, Publicar/Bloquear). Badge “DENÚNCIA”.

**Admin atual:** muito mais completo (fila denúncias, categorias, preview IA, múltiplos status).

**Gap:** protótipo **simplifica** — para 100% visual, esconder seções extras ou mover para drawer/modal. Funcionalidade de denúncias deve permanecer (badge menu = `material_reports` open count).

---

### 3.7 Liberações (`/liberacoes`)

**Protótipo:** card por feature, toggle **Selecionadas | Todas** apenas.

**Admin atual:** toggle + **lista de professoras** para grant/revoke quando `selected`.

**Gap crítico:** protótipo não mostra UI de seleção — **decidir** se mantém lista atual (mais completa) ou adiciona modal “gerenciar selecionadas” ao clicar em Selecionadas.

---

### 3.8 Continuidade (`/continuidade`)

**Protótipo:** cards aluno → de → para, input turma destino, Recusar/Aprovar.

**Admin atual:** `ContinuityRequestsPanel.tsx` — funcional ✓.

**Implementar:** apenas redesign visual alinhado aos cards do protótipo.

---

### 3.9 Uso de IA (`/ia`)

**Protótipo:** badge “somente leitura”, colunas Gerações / Tokens / Custo / Falhas.

**Admin atual:** dados reais de `ai_generation_logs` ✓, colunas similares.

**Implementar:** badge + estilo tabela; linhas clicáveis opcional → ficha aba IA.

---

### 3.10 Avisos no app (`/avisos`) — **NOVA (full stack)**

**Protótipo — composer:**

| Campo | Valores |
|-------|---------|
| Tipo | novidade, info, alerta, manutencao (cores distintas) |
| Título | texto livre |
| Mensagem | max **240 caracteres** |
| Público | todas, pagando, trial, atraso, verificadas |
| CTA opcional | texto botão |
| Fixar no topo | toggle — visível até dispensar |

**Preview:** mock do card no app (barra lateral colorida, ícone por tipo).

**Histórico:** avisos enviados com público, alcance, data.

**Estado atual:**

- App professora só exibe `payment_overdue_notice` via `notification_events` (`channel: system`)
- Não há tipo genérico de aviso admin
- Não há dismiss / fixar / CTA

**Implementação necessária (100% paridade):**

#### Banco (migration sugerida)

```sql
-- Opção A: tabela dedicada (recomendado)
create table public.app_announcements (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- novidade | info | alerta | manutencao
  title text not null,
  body text not null check (char_length(body) <= 240),
  audience text not null, -- todas | pagando | trial | atraso | verificadas
  cta_label text,
  cta_url text,
  pinned boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table public.app_announcement_deliveries (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.app_announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);
```

#### Admin

- `apps/admin/app/avisos/page.tsx` + server action `sendAnnouncementAction`
- Resolver público com query Supabase (mesma lógica do protótipo `avisoAlcance`)
- Inserir deliveries em batch ou lazy na primeira leitura do app
- Auditoria: `app_announcement_sent`

#### App professora

- Componente `AppAnnouncementBanner` na Home (e global se `pinned`)
- API `/api/account` ou endpoint dedicado listando avisos não dispensados
- Ação dismiss → `dismissed_at`

#### Configuração

- Nenhuma env nova obrigatória
- Opcional: `ANNOUNCEMENT_MAX_BODY=240`

---

### 3.11 Notificações (`/notificacoes`)

**Protótipo:** lista simples (ícone, assunto, canal, status).

**Admin atual:** mais completo (métricas fila/enviada/falha) ✓.

**Implementar:** simplificar visual; manter dados de `notification_events`.

---

### 3.12 Auditoria (`/auditoria`)

**Protótipo:** `Ação · Nome da professora` + detalhe + autor + quando.

**Admin atual:** mostra `prof · abc12345…` para muitos logs.

**Implementar:**

- Expandir `actionLabels` incluindo `teacher_giztokens_adjusted`, `teacher_payment_overdue_notice_sent`, etc.
- Resolver nome: join `profiles` via `metadata.teacherEmail` / `metadata.teacherId` / `target_id`
- Na ficha, filtrar logs por professora

---

### 3.13 Privacidade (`/privacidade`)

**Protótipo:** checklist com status **OK** ou **Pendente** (6 itens).

**Admin atual:** texto estático + lista buckets.

**Implementar checks reais (exemplos):**

| Item | Como verificar |
|------|----------------|
| Buckets privados RLS | Query storage policies / migration flags |
| Consentimento LGPD | Campo em `profiles` ou tabela consent |
| Auditoria ativa | `admin_action_logs` count > 0 |
| Materiais IA + moderação | `materials.ai_analysis_status` |
| Revisão trimestral admin | Manual / flag em config |
| Política retenção | Manual até doc existir → Pendente |

---

## 4. Design system — tokens do protótipo

Para paridade visual pixel-close:

```css
/* Cores principais */
--admin-bg: #f6f6f2;
--admin-ink: #16201b;
--admin-muted: #5f6b63;
--admin-line: #e8e7e1;
--admin-sidebar: #0c2a1e;
--admin-sidebar-active: #1f5138;
--admin-accent: #1c6b46;
--admin-accent-soft: #e3f2e9;
--admin-warn: #f0b429;
--admin-danger: #d4685c;

/* Layout */
--sidebar-width: 252px;
--content-padding: 32px 40px;
--radius-card: 14px;
--radius-button: 9px;

/* Fonte */
font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
```

**Arquivos a alterar:**

- `apps/admin/app/globals.css` — tokens + componentes
- `apps/admin/app/layout.tsx` — import Google Font
- `apps/admin/app/components/AdminShell.tsx` — sidebar groups, topbar, badges
- Novo `apps/admin/app/components/AdminTopbar.tsx`
- Novo `apps/admin/app/components/Toast.tsx` + provider client

---

## 5. Busca global

**Comportamento protótipo:**

- Input topbar: “Buscar professora por nome ou e-mail…”
- Dropdown com iniciais, nome, e-mail, badge status
- Clique → abre ficha

**Implementação:**

- Client component no shell
- API `GET /api/admin/teachers/search?q=` ou debounce fetch
- Query: `profiles` where `role=teacher` ilike `%q%` on `full_name`, `email` limit 8
- Índice: considerar `pg_trgm` se base crescer

**Configuração:** nenhuma.

---

## 6. Feedback (Toast) vs redirect

Hoje actions usam `redirect('/professoras')` após sucesso — protótipo usa toast “Saldo atualizado: X Giz para Maria”.

**Padrão recomendado:**

```ts
// cookies ou searchParams: ?toast=...
redirect('/professoras?toast=' + encodeURIComponent(msg))
// AdminShell lê e exibe Toast client-side
```

Ou migrar actions críticas para retorno JSON + `useFormStatus` em client forms.

**Paridade 100%:** toast em GizTokens, assinatura, verificação, avisos, moderação.

---

## 7. O que você precisa configurar

### 7.1 Já configurado (nada a mudar)

| Item | Onde |
|------|------|
| Login admin | Supabase Auth + `ADMIN_ALLOWED_EMAILS` |
| Stripe / OpenAI | Vercel env (APIs do app) |
| GizTokens ajuste | Backend pronto |
| Assinaturas / verificações / materiais | Supabase + actions existentes |

### 7.2 Configurar para o redesign

| Item | Ação |
|------|------|
| **Fonte Plus Jakarta Sans** | `next/font/google` em `layout.tsx` |
| **Badge “Produção”** | `NEXT_PUBLIC_ADMIN_ENV=production` (opcional staging) |
| **Migration Avisos** | Rodar no Supabase prod após criar migration |
| **Feature flags** | Manter registros em `feature_flags` (liberações) |
| **Auditoria GizTokens** | Adicionar label em `auditoria/page.tsx` |

### 7.3 Não está no protótipo (decidir se mantém)

- Página de login redesenhada
- Export CSV
- Stripe Customer Portal link
- Confirmação manual de e-mail

---

## 8. Plano de implementação sugerido

### Fase 1 — Fundação UI (3–4 dias)

- [ ] Tokens CSS + Plus Jakarta Sans
- [ ] `AdminShell`: grupos menu, badges dinâmicos, topbar, badge Produção
- [ ] Sistema de Toast
- [ ] Remover `PageHeader` action “Produção” duplicado

### Fase 2 — Dashboard + listagens (3–4 dias)

- [ ] Dashboard conforme protótipo (métricas, filas, planos, GizTokens plano)
- [ ] Repaginar Professoras (tabela + barra Giz)
- [ ] Repaginar Assinaturas, Verificações, Materiais, IA, Notificações, Auditoria, Privacidade

### Fase 3 — Ficha única + busca (5–7 dias)

- [ ] Rota `/professoras/[id]` com 5 abas
- [ ] Busca global → ficha
- [ ] Dashboard: linhas recentes clicáveis
- [ ] Auditoria enriquecida (nome professora)
- [ ] Histórico na ficha

### Fase 4 — Avisos no app (5–7 dias)

- [ ] Migration `app_announcements` + deliveries
- [ ] Admin `/avisos` composer + preview + histórico
- [ ] API + UI app professora (banner, pin, dismiss, CTA)
- [ ] Auditoria + testes E2E manuais

### Fase 5 — Polimento paridade (2–3 dias)

- [ ] Privacidade checks dinâmicos
- [ ] Liberacoes: UX seleção de professoras
- [ ] QA visual vs screenshots (`screenshots/*.png`)
- [ ] Atualizar `docs/admin-operacional.md`

---

## 9. Checklist de paridade visual (QA)

Use os screenshots em `.prototype-admin/screenshots/`:

| Tela | Arquivo | Critérios |
|------|---------|-----------|
| Shell | `dash.png` | Sidebar 252px, grupos, badges 2/2, busca, Produção |
| Dashboard | `dash2.png`, `dash3.png` | 4 métricas, 3 filas, tabela + barras plano |
| Avisos | `avisos.png`, `avisos2.png`, `avisos3.png` | Composer, preview app, histórico |
| Geral | `uploads/FireShot...png` | Comparar com prod atual |

**Critérios gerais:**

- [ ] Cantos arredondados 14px cards / 9px botões
- [ ] Sidebar item ativo `#1f5138`
- [ ] Badges status cores (verde trial azul atraso amarelo bloqueio vermelho)
- [ ] Toast animação `toastIn` 2,6s
- [ ] Empty states (“Tudo em dia”, “Nenhum aviso enviado”)
- [ ] Hover em filas e linhas clicáveis `#f8f8f4`

---

## 10. Riscos e decisões de produto

1. **Liberações “Selecionadas”** — protótipo incompleto; manter UI atual de checkboxes ou adicionar modal.
2. **Materiais simplificado** — risco de esconder moderação avançada; sugerir aba “Avançado” ou manter seção denúncias abaixo da tabela.
3. **Avisos vs Notificações** — hoje `notification_events` serve transacional; avisos broadcast merecem tabela própria.
4. **Assinaturas inline vs ficha** — alinhar ao protótipo evita duplicação, mas equipe precisa saber que edição de plano mudou de lugar.
5. **Limite 200 professoras** na listagem atual — busca/ficha deve funcionar para todas (`limit` ou paginação).

---

## 11. Referência rápida — código existente reutilizável

| Funcionalidade | Arquivo |
|----------------|---------|
| GizTokens adjust | `apps/admin/app/lib/giztokens-admin.ts`, `professoras/actions.ts` |
| Assinaturas | `apps/admin/app/assinaturas/actions.ts` |
| Verificações API | `apps/admin/app/api/account/verification/admin/route.ts` |
| Materiais moderação | `apps/admin/app/materiais/page.tsx` |
| Liberações | `apps/admin/app/liberacoes/actions.ts` |
| Continuidade | `apps/admin/app/continuidade/ContinuityRequestsPanel.tsx` |
| IA métricas | `apps/admin/app/ia/page.tsx` |
| Notificações | `apps/admin/app/notificacoes/page.tsx` |
| Aviso atraso (parcial) | `assinaturas/actions.ts` → `createPaymentNotice` |
| Shell atual | `apps/admin/app/components/AdminShell.tsx` |
| Menu atual | `apps/admin/app/lib/mock-admin-data.ts` |

---

*Análise gerada em junho/2026 a partir do zip “Admin modernizado e organizado”.*
