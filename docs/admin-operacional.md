# Admin Approf — Documento operacional

**URL produção:** https://admin.approf.com.br  
**Login:** https://admin.approf.com.br/login

O admin é o painel interno da equipe Approf. Ele não é usado pelas professoras no dia a dia — é onde a equipe opera cadastros, assinaturas, moderação, IA e suporte.

---

## 1. O que o admin faz (visão geral)

O admin cumpre **dois papéis**:

| Papel | O que é |
|--------|---------|
| **Painel operacional** | Telas para ver professoras, assinaturas, verificações, materiais, etc. |
| **Backend do app** | APIs que o app `professora` chama (IA, documentos, Stripe, conta, coordenadora) |

Parte do que roda em `admin.approf.com.br` **não aparece no menu** — são rotas `/api/...` consumidas pelo app.

```
App professora (app.approf.com.br)
        │
        │  API + JWT
        ▼
Admin (admin.approf.com.br)
        │
        ├──► Supabase (banco + auth + storage)
        ├──► Stripe
        ├──► OpenAI
        └──► Resend (e-mail via Supabase SMTP)
```

---

## 2. Acesso e segurança

### Quem entra

- Login com **e-mail + senha** (conta Supabase Auth).
- Só entra quem:
  - tem `role` de admin no perfil (`canAccessAdmin`), **ou**
  - está na lista `ADMIN_ALLOWED_EMAILS` (Vercel / `.env`).

### Sessão

- Cookie `approf-admin-access-token` após login.
- Middleware bloqueia todas as rotas exceto as públicas (login, portal coordenadora, APIs do app).

### Auditoria

- Ações sensíveis gravam em `admin_action_logs`.
- Consulta em **Auditoria** (`/auditoria`).

---

## 3. Menu lateral — mapa das telas

| Menu | Rota | Para que serve |
|------|------|----------------|
| **Dashboard** | `/` | Resumo: professoras recentes, materiais, custo IA, denúncias abertas |
| **Professoras** | `/professoras` | Lista de contas + **ajustar GizTokens** |
| **Verificações** | `/verificacoes` | Aprovar/rejeitar comprovante de vínculo escolar |
| **Assinaturas** | `/assinaturas` | Plano, status, bloqueio, link de pagamento, aviso de atraso |
| **Materiais** | `/materiais` | Moderar biblioteca de apoio + denúncias |
| **Liberações** | `/liberacoes` | Ligar/desligar features por professora ou para todas |
| **Continuidade** | `/continuidade` | Aprovar transferência de aluno entre professoras |
| **Uso de IA** | `/ia` | Custo e volume de gerações (30 dias) — só leitura |
| **Privacidade** | `/privacidade` | Checklist operacional (estático) |
| **Auditoria** | `/auditoria` | Log de ações admin |
| **Notificações** | `/notificacoes` | Fila de e-mail / Telegram / sistema — só leitura |

**Fora do menu (mesmo domínio):**

- `/coordenadora/[token]` — portal da coordenadora (público com link).
- `/coordenadora/documento/[token]` — revisão de documento.
- `/public/reports/[id]` — link público de relatório.

---

## 4. Telas em detalhe

### 4.1 Dashboard (`/`)

**O que mostra:** métricas rápidas, 5 professoras recentes, materiais recentes, alerta de denúncias.

**O que você faz aqui:** visão geral; links para Professoras e Materiais.

**Limitação:** métrica “Professoras” usa contagem de assinaturas de forma simplificada — é indicativo, não relatório financeiro.

---

### 4.2 Professoras (`/professoras`)

**O que mostra:** e-mail, plano, verificação, turmas, alunos, uso de IA, **saldo GizTokens do mês**.

**O que você faz:**

| Ação | Como |
|------|------|
| Ver cadastros | Tabela |
| **Liberar GizTokens** | Formulário no topo: professora → tipo → quantidade → observação |
| Ir para planos | Link “Gerenciar planos” → Assinaturas |

**Tipos de ajuste GizTokens:**

- **Adicionar GizTokens** — soma ao saldo do mês (ex.: +5.000).
- **Definir saldo mínimo do mês** — garante pelo menos X (não reduz se já estiver acima).

**Importante:** bônus vale **só no mês atual**; dia 1 volta ao plano (8k / 9k / 10k). Gera auditoria `teacher_giztokens_adjusted`.

**O que NÃO faz aqui:** mudar plano Stripe, bloquear conta, aprovar verificação.

---

### 4.3 Verificações (`/verificacoes`)

**O que mostra:** fila de comprovantes enviados pelas professoras (documentos no storage).

**O que você faz:**

- Ver PDFs/arquivos (link assinado).
- **Aprovar** → libera badge de escola no app.
- **Rejeitar** → com observação interna.
- Atualizar lista (botão Atualizar).

**Efeito no app:** nome da escola pode aparecer em documentos; fluxo de “conta bloqueada por verificação” depende do status da assinatura.

---

### 4.4 Assinaturas (`/assinaturas`)

**Centro de controle de acesso pago/grátis.**

**Métricas:** acesso livre, pagando, em atraso, bloqueadas.

**Por professora:**

| Botão | Efeito |
|--------|--------|
| **Liberar grátis** | Plano `free` + active + aprova verificação automaticamente |
| **Avisar atraso** | Notificação in-app (não bloqueia) |
| **Bloquear** | Status `blocked` → app trava |
| Formulário plano/status | Edita manualmente: trial, mensal, semestral, anual, datas, link pagamento |

**Em massa (contas em atraso):**

- Avisar todas
- Bloquear todas em atraso

**Regras importantes:**

- Atraso **não bloqueia sozinho** — a equipe decide.
- Plano **semestral/anual** no admin é manual; cobrança real vem do **Stripe** (checkout no app).
- Indicação: ao marcar `active` em plano pago, pode disparar bônus de indicação.

---

### 4.5 Materiais (`/materiais`)

**Biblioteca comunitária de apoio pedagógico.**

**Métricas:** aprovados, em revisão, bloqueados, denúncias abertas.

**Por material:**

- Abrir arquivo (URL assinada).
- Mudar status: publicado, em análise, bloqueado, arquivado, etc.
- Ver preview / análise de IA.

**Denúncias:** materiais reportados por professoras aparecem na fila; dashboard alerta quantidade aberta.

---

### 4.6 Liberações (`/liberacoes`)

**Feature flags** — funcionalidades do app que podem ficar ocultas.

**Modos por feature:**

- **Selecionadas** — só professoras marcadas na lista.
- **Todas as contas** — libera para toda a base.

**Pré-requisito:** registros na tabela `feature_flags` no Supabase (se vazio, a tela avisa).

**Uso típico:** beta de funcionalidade nova antes de liberar geral.

---

### 4.7 Continuidade (`/continuidade`)

**Transferência de histórico pedagógico de aluno entre professoras.**

**Fluxo admin:**

1. Ver solicitações pendentes.
2. Para aprovar: informar **ID da turma de destino** da professora receptora.
3. Aprovar ou recusar.

**Regras:** prévia sem dados sensíveis; acesso completo só após aprovação; tudo auditado.

Documentação complementar: `docs/continuidade-pedagogica.md`.

---

### 4.8 Uso de IA (`/ia`)

**Somente leitura** — últimos 30 dias.

Mostra por professora: nº de gerações, tokens, custo estimado/real, flag se muitas falhas.

**Não permite:** ajustar GizTokens (isso está em Professoras).

Documentação complementar: `docs/arquitetura-ia.md`.

---

### 4.9 Notificações (`/notificacoes`)

**Somente leitura** — fila `notification_events`.

Canais: e-mail, Telegram, sistema. Status: na fila, enviada, falha.

Útil para confirmar se aviso de atraso chegou.

---

### 4.10 Privacidade (`/privacidade`)

**Checklist estático** — regras operacionais (consentimento, buckets privados, etc.).

Não executa ações; é referência para a equipe.

Documentação complementar: `docs/privacidade-lgpd.md`.

---

### 4.11 Auditoria (`/auditoria`)

Registro das ações admin, por exemplo:

- Plano atualizado
- Acesso grátis liberado
- Feature liberada/removida
- Material moderado
- Verificação aprovada/rejeitada
- GizTokens ajustados

---

## 5. O que o admin faz “por baixo dos panos” (APIs)

O app professora chama `admin.approf.com.br/api/...` com JWT da professora:

| Área | Rotas principais |
|------|------------------|
| **IA** | `/api/ai/generate-text`, `generate-portfolio-image`, `chat`, `transcribe-audio`, `usage-summary` |
| **Conta** | `/api/account`, `subscription`, `verification` |
| **Documentos** | `/api/reports`, `personal-documents` |
| **Materiais** | `/api/materials` |
| **Stripe** | `/api/stripe/checkout`, `webhook` |
| **Coordenadora** | `/api/coordinator/share`, portais públicos |
| **Continuidade** | `/api/continuity/search`, `requests` |

**Configuração (Vercel / `.env`, não no admin UI):**

- Stripe (preços, webhook)
- OpenAI
- `ADMIN_ALLOWED_EMAILS`
- `AI_MONTHLY_*` (padrões de GizTokens)
- Resend / Supabase SMTP (e-mail de confirmação)

---

## 6. Fluxos do dia a dia (cola rápida)

| Situação | Onde ir | O que fazer |
|----------|---------|-------------|
| Professora sem saldo de IA | **Professoras** | Adicionar GizTokens |
| Não consegue entrar no app | **Assinaturas** | Ver status; liberar grátis ou regularizar plano |
| E-mail não confirmado | **Supabase** Auth | Confirmar manualmente ou reenviar (não há tela admin) |
| Comprovante escolar pendente | **Verificações** | Aprovar/rejeitar |
| Pagamento atrasado | **Assinaturas** | Avisar → depois bloquear se necessário |
| Denúncia de material | **Materiais** ou Dashboard | Moderar / bloquear |
| Transferir aluno entre professoras | **Continuidade** | Aprovar com turma destino |
| Beta de feature | **Liberações** | Selecionar professoras |
| Ver se ajuste foi registrado | **Auditoria** | Buscar ação recente |

---

## 7. GizTokens e cotas (referência)

### Saldo mensal (GizTokens) — plano + bônus admin

| Plano | Giz/mês |
|-------|---------|
| Mensal | 8.000 |
| Semestral | 9.000 |
| Anual | 10.000 |

Margem técnica (~2.000) pode existir no backend além do valor exibido ao usuário.

### Cotas inclusas (0 Giz) — automáticas por aluno/ano

Não se ajustam no admin.

| Tipo | Cota |
|------|------|
| Relatório desenvolvimento | 2 / aluno / ano |
| Portfólio texto | 2 / aluno / ano |
| Portfólio imagem | 1 / aluno / ano |

Migration relacionada: `supabase/migrations/0043_student_yearly_entitlements.sql`.

### O que ainda não existe

- Compra de pacote extra de GizTokens (schema existe; fluxo de compra não implementado).
- Assinatura `overdue` / `canceled` **não bloqueia IA** automaticamente.

---

## 8. O que ainda NÃO existe no admin (oportunidades de melhoria)

Pontos que hoje **dificultam** o uso e valem evoluir:

| Gap | Impacto | Sugestão |
|-----|---------|----------|
| **Busca por e-mail/nome** | Achar professora em listas longas | Campo de busca global |
| **Ficha única da professora** | Dados espalhados (Professoras, Assinaturas, IA) | Página `/professoras/[id]` com tudo |
| **Confirmação de e-mail** | Só via Supabase | Ação “Confirmar e-mail” no admin |
| **Stripe** | Checkout/webhook; sem painel | Ver assinatura Stripe + link portal cliente |
| **GizTokens sem feedback** | Form recarrega a página | Toast “Saldo atualizado: X Giz” |
| **Auditoria genérica** | IDs truncados | Mostrar e-mail da professora no log |
| **Notificações** | Só leitura | Reenviar / criar aviso manual |
| **Privacidade** | Estático | Checklist com status real (OK/pendente) |
| **Dashboard** | Métricas imprecisas | Contagens corretas + atalhos de fila |
| **Verificações + Assinaturas** | Fluxos separados | Wizard “Nova professora” unificado |
| **Export CSV** | Não há | Professoras, IA, assinaturas |

### Backlog sugerido (prioridade)

1. **Ficha única da professora** — tudo num lugar.
2. **Busca por e-mail** — em Professoras e Assinaturas.
3. **Feedback visual** — após ações (GizTokens, plano, verificação).

---

## 9. Resumo mental

```
Professoras  → quem é + GizTokens
Assinaturas  → pode entrar no app? (plano/bloqueio)
Verificações → escola verificada?
Materiais    → conteúdo público ok?
Liberações   → features beta
Continuidade → transferir aluno
IA / Notif.  → monitorar (leitura)
Auditoria    → prova do que foi feito
```

---

## 10. Documentos relacionados

| Arquivo | Assunto |
|---------|---------|
| `docs/comunidade-e-liberacoes.md` | Feature flags e comunidade |
| `docs/continuidade-pedagogica.md` | Transferência entre professoras |
| `docs/materiais-de-apoio.md` | Biblioteca comunitária |
| `docs/arquitetura-ia.md` | IA, GizTokens, custos |
| `docs/privacidade-lgpd.md` | LGPD e dados |
| `docs/backlog-producao-approf.md` | Backlog geral do produto |

---

*Última atualização: junho/2026 — reflete admin com ajuste de GizTokens em Professoras (v0.1.14).*
