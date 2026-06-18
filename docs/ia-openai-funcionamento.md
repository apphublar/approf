# IA OpenAI no Approf — visão do produto e operação

Atualizado em: 2026-06-08

Este documento descreve **o que é o Approf** e, em seguida, **como a OpenAI (GPT e modelos relacionados) funciona hoje no app** — endpoints, regras, limites e causas comuns de respostas “estranhas”, especialmente no chat.

Documentos relacionados:

- [Arquitetura de IA (visão histórica)](./arquitetura-ia.md)
- [Geração de imagem / portfólio](./geracao-imagem-openai-portfolio.md)
- [Admin operacional](./admin-operacional.md)
- [Princípios de produto](./principios-de-produto.md)

---

## 1. O que é o Approf

O **Approf** é um aplicativo para **professoras da Educação Infantil** (crianças de **0 a 5 anos**). Ele ajuda a **registrar, organizar e transformar** o trabalho pedagógico do dia a dia em documentação útil, segura e alinhada à BNCC — **sem substituir o julgamento da professora**.

### Público e propósito

- **Quem usa:** professoras em sala de aula, coordenação e famílias (via compartilhamentos controlados).
- **O que resolve:** anotações da rotina, marcos de desenvolvimento, relatórios, planejamentos, portfólios, intervenções pedagógicas e materiais de apoio.
- **Princípio central:** cada criança é única — o Approf **nunca compara** crianças entre si e **não emite diagnósticos clínicos**.

### Componentes do sistema

| Parte | URL / pasta | Função |
|-------|-------------|--------|
| **App professora** | `apps/professora` · app.approf.com.br | PWA usado no dia a dia: turmas, crianças, anotações, documentos, IA, comunidade |
| **Admin / API** | `apps/admin` · admin.approf.com.br | Painel interno da equipe **e** backend que o app chama (IA, Stripe, conta, coordenadora) |
| **Supabase** | `supabase/` | Banco, autenticação, storage privado, RLS, auditoria |

Fluxo simplificado:

```
App professora
      │  JWT Supabase
      ▼
Admin (API /api/...)
      ├──► Supabase
      ├──► Stripe (assinaturas)
      └──► OpenAI (texto, imagem, transcrição, moderação)
```

### O que a professora faz no app (contexto para a IA)

- **Anotações** por criança ou turma (texto, áudio transcrito, categorias).
- **Documentos pedagógicos** gerados com IA: relatórios, diários, planejamentos, encaminhamentos, portfólios.
- **Intervenções** — sugestões pedagógicas e análise de retorno após aplicação.
- **Chat livre** dentro da tela de nova anotação (conversa genérica, sem o mesmo rigor dos documentos).
- **Imagens** — portfólio visual da criança ou imagens avulsas para materiais.
- **Comunidade** — materiais compartilhados, com moderação automática por IA no upload.

### Cobrança de IA (GizTokens)

Gerações que consomem API passam por **reserva → execução → finalização** (ou **estorno** se falhar). O saldo mensal e limites vêm de `ai_usage_wallets` e variáveis de ambiente (`AI_MONTHLY_INCLUDED_COST_CENTS`, etc.).

---

## 2. Provedor e modelos em produção

**Estado atual do código (jun/2026):** todo o texto pedagógico e o chat usam **OpenAI**. Não há integração Anthropic/Claude ativa no backend, embora documentos antigos ainda mencionem Claude.

Modelos padrão (`apps/admin/app/lib/openai-models.ts`):

| Uso | Modelo padrão | Variável de ambiente |
|-----|---------------|----------------------|
| Texto (documentos, chat) | `gpt-5.5` | `OPENAI_DRAFT_MODEL`, `OPENAI_REVIEW_MODEL`, `OPENAI_CHAT_MODEL` |
| Humanização (etapa 3) | `gpt-5.5` | `OPENAI_HUMANIZE_MODEL` |
| Intervenções | `gpt-5.5` | `OPENAI_INTERVENTIONS_MODEL` |
| Imagens (portfólio e avulsas) | `gpt-image-2` | `OPENAI_IMAGE_MODEL`, `OPENAI_STANDALONE_IMAGE_MODEL` |
| Transcrição de áudio | `gpt-4o-mini-transcribe` | `OPENAI_TRANSCRIPTION_MODEL` |
| Moderação de materiais | `gpt-4o-mini` | `OPENAI_MATERIAL_REVIEW_MODEL` |

**Regras globais de segurança:**

- Chaves (`OPENAI_API_KEY`) **somente no servidor** — nunca no app da professora.
- Toda geração relevante é **persistida e auditável** (`reports`, `ai_generation_logs`, `admin_action_logs`).
- IA pedagógica: BNCC 0–5, **sem diagnóstico**, **sem comparação entre crianças**; a professora **sempre** pode editar o resultado.

---

## 3. Funcionalidades que usam OpenAI

### Resumo rápido

| Funcionalidade | Onde no app | Endpoint | Tipo | Regras pedagógicas |
|----------------|-------------|----------|------|-------------------|
| Chat livre | Nova anotação → aba Chat | `POST /api/ai/chat` | GPT texto | **Mínimas** |
| Documentos / Criador | Geração de relatórios e documentos | `POST /api/ai/generate-text` | GPT texto (3 etapas) | **Completas** |
| Intervenções | Tela Intervenções | `POST /api/ai/generate-text` | GPT texto (1 etapa, JSON) | **Completas** |
| Transcrição | Nova anotação → gravar áudio | `POST /api/ai/transcribe-audio` | Transcrição | Nenhuma |
| Portfólio imagem | Criador → saída imagem | `POST /api/ai/generate-portfolio-image` | Imagem | Parcial (prompt) |
| Imagem avulsa | Gerador de imagens | `POST /api/ai/generate-image` | Imagem | Básicas |
| Moderação upload | Comunidade → enviar material | `POST /api/materials` (interno) | GPT JSON | Privacidade |
| Validação compartilhamento | Documento → compartilhar como material | `POST /api/materials/share-generated` | GPT JSON | Anonimização |

Arquivos principais no backend:

- `apps/admin/app/api/ai/chat/route.ts`
- `apps/admin/app/api/ai/generate-text/route.ts`
- `apps/admin/app/api/ai/transcribe-audio/route.ts`
- `apps/admin/app/api/ai/generate-portfolio-image/route.ts`
- `apps/admin/app/api/ai/generate-image/route.ts`
- `apps/admin/app/lib/ai-generation.ts`
- `apps/admin/app/lib/pedagogical-prompts.ts`
- `apps/admin/app/lib/ai-image.ts`
- `apps/admin/app/lib/ai-transcription.ts`
- `apps/admin/app/api/materials/material-upload.ts`

---

## 4. Chat livre (Nova Anotação)

### Onde aparece

Tela **Nova anotação** → aba **Chat**. Texto na UI: *“Inicie uma conversa. O chat é livre e responde em texto.”*

### O que é enviado à API

- Histórico de mensagens (`user` / `assistant`) — **últimas 16 mensagens**, só o texto digitado.
- `classId` e `studentId` — usados para **cobrança e log**, **não entram no prompt** enviado ao GPT.
- **Não** são enviados: anotações da tela, nome da criança, turma, categorias, áudio transcrito ou contexto pedagógico.

### System prompt (únicas regras do chat)

Definido em `apps/admin/app/api/ai/chat/route.ts`:

- Assistente útil e cordial para professoras de educação infantil.
- Resposta em **português brasileiro**, direta, **até 3 parágrafos curtos**.
- **Sem Markdown** (sem `*`, `#`, listas, negrito).
- `max_completion_tokens: 700`.
- Histórico limitado a 16 mensagens; resposta passa por `stripMarkdown()` no servidor.

### O que o chat **não** faz

- Não segue pipeline BNCC de documentos.
- Não aplica proibição de diagnóstico ou comparação entre crianças.
- Não garante fidelidade às anotações ou instruções da professora além do que ela **digitar na conversa**.
- Não “vê” anexos, fotos ou áudio da anotação.

### Por que o chat pode “não entender”

| Expectativa comum | Realidade no código |
|-------------------|---------------------|
| “Sabe qual criança estou anotando” | **Não** — `studentId` não vai no prompt |
| “Usa minhas anotações selecionadas” | **Não** — só mensagens do chat |
| “Gera relatório / planejamento estruturado” | **Não** — isso é o **Criador de documentos** (`/api/ai/generate-text`) |
| “Resposta longa e detalhada” | **Não** — limite de ~700 tokens e 3 parágrafos |
| “Mesmas regras dos documentos” | **Não** — regras pedagógicas completas estão em `pedagogical-prompts.ts`, não no chat |

**Conclusão operacional:** pedidos que dependem de contexto da turma/criança/anotações devem usar o **fluxo de documentos** ou incluir **todo o contexto explicitamente** no texto do chat.

---

## 5. Geração de documentos pedagógicos

### Onde aparece

Tela de **geração de documentos / Criador** (`apps/professora/src/subscreens/Report.tsx`).

### Endpoint e pipeline

`POST /api/ai/generate-text` → `generatePedagogicalText()` em `ai-generation.ts`.

**Três etapas em cascata (todas OpenAI GPT):**

| Etapa | Nome | Função |
|-------|------|--------|
| 1 | Rascunho pedagógico | Organiza contexto, anotações e estrutura |
| 2 | Revisão BNCC e segurança | Gramática, coerência pedagógica, remove diagnóstico/comparação |
| 3 | Humanização final | Fluidez, tom humano, pronto para uso |

Após as etapas:

1. **Validação de estrutura** — seções obrigatórias por tipo de documento.
2. **Validação de qualidade** — palavras proibidas, tamanho, regras específicas (ex.: diário sem BNCC).
3. **Reparo automático** se faltar seção ou houver problema detectado.

Prompts versionados em `apps/admin/app/lib/pedagogical-prompts.ts` (sufixos `-s1-draft`, `-s2-bncc`, `-s3-refine`).

### Modo “Criador livre” (comportamento atual)

O app envia:

- `promptVersion: 'criador-livre-v1'`
- `unifiedCreator: true`

Isso ativa o **modo criador livre**:

- A professora define **título, estrutura, tom e conteúdo** via título do documento e campo **“Instruções finais da professora”** (`extraContext`).
- **Prioridade absoluta:** *“INSTRUÇÕES FINAIS DA PROFESSORA — seguir à risca, sem exceção.”*
- Não impõe modelos rígidos de relatório/planejamento quando a professora pede outro formato.

O **tipo pedagógico** é inferido pelo **título** (`reportKind`), por exemplo:

- Título contém “diário de bordo” → regras de diário coletivo.
- “reunião de pais” → regras de pauta/ata.
- “encaminhamento” / “especialista” → regras de encaminhamento formal.
- Caso contrário → relatório genérico (`general_report`).

### Contexto enviado (`requestSummary`)

Quando preenchido pelo app, o backend monta o prompt com:

- Nome da criança, turma, faixa etária, período de avaliação.
- Anotações selecionadas (até 40), marcos, textos a **desconsiderar**.
- Campos BNCC, objetivo, intencionalidade, recursos, metodologia, avaliação.
- Dados de diário de bordo, reunião de pais, projeto pedagógico (conforme o fluxo).
- **`extraContext`** — instruções finais da professora (máxima prioridade).
- **Anexos:** nome, tipo, tamanho; se houver `extractedText` no cliente, até 3000 caracteres entram como referência.
- Anexos **sem** texto extraído: apenas metadados — o prompt diz explicitamente para **não analisar o binário**.

### Regras pedagógicas comuns (etapas 1–3)

**Sempre aplicadas:**

- Português do Brasil; não inventar fatos além do contexto fornecido.
- Não diagnosticar; não comparar crianças; linguagem acolhedora, não julgadora.
- **Fidelidade:** preservar nomes, situações, datas e detalhes da professora — não generalizar (“Pedro caiu no parque” não vira “uma criança apresentou dificuldade”).
- Evitar expressões artificiais listadas em `FORBIDDEN_PEDAGOGICAL_WORDS` (`packages/types/src/documents.ts`).

**Lista de palavras/expressões a evitar nos documentos:**

`evidenciou`, `no que tange`, `em consonância`, `outrossim`, `consoante`, `destarte`, `hodiernamente`, `mister se faz`, `apresentou déficit`, `comprometimento cognitivo`, `corrobora`, `supracitado`, `doravante`, `haja vista`.

**Validação pós-geração também bloqueia:**

`diagnóstico`, `transtorno`, `déficit`, `laudo`, `TEA`, `TDAH`, `suspeita de`, `incapaz`, `problema de comportamento`.

### Regras por tipo de documento (quando detectado)

| Tipo | Regras principais |
|------|-------------------|
| **Diário de bordo** | 1–3 parágrafos; **sem BNCC** no texto; registro natural da rotina |
| **Relatório de desenvolvimento** | Seções: adaptação, linguagem, motor, cognitivo/autonomia, interesses, família, considerações finais; **sem** seção “Campos de experiência”; declarar quando não houver registro suficiente |
| **Planejamento semanal** | Por dia da semana; intencionalidade **distinta por dia** |
| **Plano de aula diário** | Objetivo, tempo, materiais; operacional |
| **Projeto pedagógico** | Justificativa, objetivos, etapas, avaliação processual |
| **Encaminhamento especialista** | Comportamentos observáveis; sem linguagem clínica |
| **Reunião de pais** | Foco na pauta; sem nomes de crianças |
| **Portfólio (texto)** | Narrativa com evidências; não descrever conteúdo visual das fotos (fotos entram pela aplicação) |

### Limites de tamanho (palavras)

Definidos em `DOCUMENT_WORD_LIMITS` — exemplos: diário ~150, relatório ~600, planejamento semanal ~400, projeto ~2000. Ultrapassar ~125% do limite dispara reparo automático.

---

## 6. Intervenções pedagógicas

**Onde:** `apps/professora/src/subscreens/Interventions.tsx`  
**Endpoint:** `POST /api/ai/generate-text` com `generationType: 'other'`.

Usa **uma chamada GPT** (sem pipeline de 3 etapas), com resposta **obrigatória em JSON**.

### Modo A — Sugestões (`interventionMode: 'suggestions'`)

- Entrada: observação da professora, nome e idade da criança.
- Saída JSON: 3–5 alternativas com `title`, `summary`, `objective`, `howToApply`, `whatToObserve`, `recordText`.
- **Proibido:** diagnóstico, transtorno, linguagem clínica, laudo.
- **Evitar:** problema, transtorno, diagnóstico, falhou, déficit.
- **Preferir:** observou-se, recomenda-se, sugere-se, houve avanço, continuidade do acompanhamento.

### Modo B — Análise de retorno (`interventionMode: 'feedback_analysis'`)

- Entrada: observação inicial, intervenção aplicada, retorno da professora, status (avanço / parcial / continua).
- Saída JSON: `analysisText`, `evolutionRecord`, `recommendedSuggestions` (pode ser vazio se houve avanço).
- Mesmas proibições clínicas do modo A.

---

## 7. Transcrição de áudio

**Onde:** Nova anotação → botão de transcrever áudio.  
**Endpoint:** `POST /api/ai/transcribe-audio`  
**Arquivo:** `apps/admin/app/lib/ai-transcription.ts`

| Regra | Valor |
|-------|--------|
| Duração máxima | 30 segundos |
| Tamanho máx. | 6 MB |
| Idioma | `pt` (forçado) |
| Modelo | `gpt-4o-mini-transcribe` |

Não é chat: converte fala → texto para colar na anotação. Sem regras pedagógicas.

---

## 8. Geração de imagens (OpenAI Images)

Não usa Chat Completions de texto; usa API de imagens (`/v1/images/generations` ou `/v1/images/edits`).

### Portfólio visual

**Endpoint:** `POST /api/ai/generate-portfolio-image`  
**Modelo:** `gpt-image-2`  
**Arquivo:** `apps/admin/app/lib/ai-image.ts`

Regras do prompt:

- Layout tipo cartaz escolar, tons pastel; textos em português brasileiro.
- Usar **apenas evidências** das anotações selecionadas + `extraContext`.
- Não inventar fatos; sem diagnóstico, comparação, nota ou QR code.
- **Com foto da criança:** preservar foto real (modo `edits`); não redesenhar o rosto.

**Limitação:** modelos de imagem podem errar acentuação e textos pequenos dentro da imagem.

### Imagem avulsa

**Endpoint:** `POST /api/ai/generate-image`  
Segue descrição livre da professora; formatos retrato, paisagem ou quadrado; evita conteúdo impróprio para ambiente escolar.

---

## 9. Moderação de materiais (comunidade)

### Upload de material

**Fluxo:** `POST /api/materials` → análise em `material-upload.ts`  
**Modelo:** `gpt-4o-mini` (Chat Completions ou Responses API, JSON estruturado).

Critérios analisados:

- Relação com educação infantil e utilidade pedagógica.
- **Dados pessoais:** CPF, telefone, e-mail, endereço, nomes completos de crianças.
- Conteúdo inadequado, spam, imagem sensível.
- Direito autoral suspeito — **informativo**; não bloqueia sozinho.

Decisão automática (`resolveMaterialStatus`):

- `blocked` — conteúdo inadequado ou reprovado.
- `review_required` — dados pessoais, imagem sensível ou confiança abaixo do limiar (`MATERIAL_AI_CONFIDENCE_THRESHOLD`, padrão 0,6).
- `published` — aprovado automaticamente.

Se o arquivo não tiver texto extraído e não for imagem/PDF analisável, a confiança tende a ser baixa → fila manual no admin.

### Compartilhar documento gerado

**Endpoint:** `POST /api/materials/share-generated`  
Valida versão anonimizada antes de publicar (sem nomes reais, escola, contatos, imagem sensível).

---

## 10. Fluxo de cobrança (GizTokens)

Toda chamada paga segue:

1. **`reserveAiUsage`** — reserva saldo com custo estimado.
2. Execução da API OpenAI.
3. **`completeAiUsageReservation`** — grava custo real (tokens) ou **`refundAiUsageReservation`** se falhar.

Implementação: `apps/admin/app/lib/ai-usage.ts`.

Estimativas por funcionalidade (ordem de grandeza):

- **Chat:** ~20+ GizTokens; ~500 tokens de saída estimados.
- **Documentos:** proporcional às 3 etapas + possíveis reparos de estrutura/qualidade.
- **Intervenções:** override fixo (~280–350 GizTokens conforme modo).
- **Transcrição:** proporcional à duração (até 30 s).

---

## 11. Diferença entre chat e documentos (referência rápida)

```
┌─────────────────────────────────────────────────────────────┐
│  CHAT (/api/ai/chat)                                        │
│  • Só texto da conversa                                     │
│  • Regras mínimas, resposta curta                           │
│  • Sem contexto de criança/turma/anotações                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  DOCUMENTOS (/api/ai/generate-text)                         │
│  • Anotações, instruções, metadados, anexos (texto)         │
│  • 3 etapas + validação + reparo                            │
│  • Regras BNCC, fidelidade, proibição clínica                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 12. Documentação desatualizada e gaps conhecidos

| Tema | Situação |
|------|----------|
| Claude / Anthropic | Mencionado em docs antigos; **código usa só OpenAI** para texto |
| Análise de anexos | Binários **não** são lidos pela IA; só metadados + `extractedText` se o app enviar |
| Texto dentro de imagem de portfólio | Modelo de imagem pode errar acentos; arquitetura ideal é texto via GPT + layout determinístico |
| Embeddings / busca semântica | Planejado; **não implementado** |
| Chat com contexto pedagógico | **Não implementado** — melhoria futura possível |

Para evolução de arquitetura e backlog histórico, ver [arquitetura-ia.md](./arquitetura-ia.md) e [backlog-producao-approf.md](./backlog-producao-approf.md).

---

## 13. Variáveis de ambiente relevantes

| Variável | Uso |
|----------|-----|
| `OPENAI_API_KEY` | Todas as chamadas OpenAI |
| `OPENAI_DRAFT_MODEL` | Etapa 1 documentos |
| `OPENAI_REVIEW_MODEL` | Etapa 2 documentos |
| `OPENAI_HUMANIZE_MODEL` | Etapa 3 documentos |
| `OPENAI_CHAT_MODEL` | Chat livre |
| `OPENAI_INTERVENTIONS_MODEL` | Intervenções |
| `OPENAI_IMAGE_MODEL` | Portfólio imagem |
| `OPENAI_STANDALONE_IMAGE_MODEL` | Imagem avulsa |
| `OPENAI_TRANSCRIPTION_MODEL` | Áudio |
| `OPENAI_MATERIAL_REVIEW_MODEL` | Moderação materiais |
| `AI_USD_TO_BRL` | Conversão para centavos de custo |
| `AI_MONTHLY_INCLUDED_COST_CENTS` | Cota mensal incluída |
| `MATERIAL_AI_CONFIDENCE_THRESHOLD` | Limiar de confiança na moderação (padrão 0,6) |
| `VITE_APPROF_ADMIN_API_URL` | URL do admin no app professora |

Configuradas na Vercel do projeto `approf-admin` (ver [admin-operacional.md](./admin-operacional.md)).
