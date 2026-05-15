# Arquitetura de IA do Approf

Atualizado em: 2026-05-15

Este documento registra a arquitetura de IA analisada a partir do arquivo local `approf-arquitetura-ia.docx` e compara essa visao com o estado atual do projeto.

## Principio Central

A IA do Approf deve funcionar como uma camada pedagogica assistiva para professoras de Educacao Infantil. Ela deve economizar tempo, melhorar a qualidade dos documentos e apoiar observacoes pedagogicas, sem substituir o julgamento da professora.

Regras obrigatorias:

- chaves de IA nunca ficam no frontend;
- chamadas para Claude/OpenAI acontecem apenas no backend;
- toda geracao relevante deve ser persistida e auditavel;
- toda geracao paga ou limitada deve passar por controle de uso;
- a IA deve seguir BNCC para Educacao Infantil de 0 a 5 anos;
- a IA nao deve diagnosticar, comparar criancas ou escrever conclusoes clinicas;
- a professora sempre deve poder revisar, editar, arquivar e escolher versao final.

## Provedores

Arquitetura desejada:

- Anthropic Claude: texto pedagogico, relatorios, planejamentos, classificacoes, alertas, revisoes e analises.
- OpenAI: imagens pedagogicas, embeddings e busca semantica.

Estado atual do projeto:

- Claude textual esta previsto no backend `apps/admin`, usando `ANTHROPIC_API_KEY`.
- OpenAI ainda nao esta implementado no codigo para imagem ou embeddings.
- O frontend da professora nao carrega chaves de IA, o que esta correto.

Observacao: nomes exatos de modelos e precos devem ser confirmados nas documentacoes oficiais antes de producao, porque mudam com frequencia.

## Camadas Do Sistema

### Frontend Professora

Responsabilidades:

- coletar contexto da professora;
- enviar token Supabase para o backend;
- exibir resultado gerado;
- permitir edicao, salvamento, arquivamento e versao final;
- mostrar efeitos leves de comemoracao quando uma IA ajuda a professora.

Nao deve:

- chamar Anthropic/OpenAI diretamente;
- guardar API keys;
- decidir cobranca real;
- confiar apenas no estado local para consumo de IA.

### Backend Admin/API

Responsabilidades:

- autenticar professora via Supabase;
- validar permissao do `owner_id`;
- reservar consumo antes da geracao;
- chamar provedores de IA;
- persistir documento e uso;
- finalizar ou estornar reserva;
- registrar metadados de auditoria;
- retornar mensagens seguras para o frontend.

Estado atual:

- `apps/admin/app/api/ai/generate-text/route.ts` cobre a primeira geracao textual server-side.
- `apps/admin/app/lib/ai-generation.ts` centraliza chamada ao Claude e persistencia de relatorios.
- `apps/admin/app/lib/ai-usage.ts` centraliza precificacao estimada, reserva, finalizacao e estorno.
- `apps/admin/app/lib/pedagogical-prompts.ts` centraliza prompts pedagogicos versionados em codigo.

### Supabase

Responsabilidades:

- persistir professoras, turmas, criancas, anotacoes e documentos;
- controlar RLS;
- registrar consumo de IA;
- garantir atomicidade de cotas e estornos via RPC.

Estado atual:

- `reports` e `reports_usage` sao usados para documentos e consumo;
- `ai_usage_wallets`, `ai_semester_entitlements`, `ai_generation_logs` e `ai_extra_credit_purchases` formam a base de uso de IA;
- as RPCs de reserva, finalizacao, estorno e versao final ja foram criadas em migrations separadas;
- `reports.is_final_version` permite uma versao final por crianca/tipo.

## Funcionalidades De IA

### P0 Implementado/Em Implementacao

1. Geracao textual de relatorios e planejamentos com Claude.
2. Persistencia em `reports`.
3. Registro de consumo em `reports_usage` e `ai_generation_logs`.
4. Controle de GizTokens/cotas com RPC transacional.
5. Estorno em caso de falha pos-reserva.
6. Tela de documentos com edicao, arquivamento e versao final.

### P0 Ainda Necessario Para Fechar A Conexao Real

1. Configurar `ANTHROPIC_API_KEY` no ambiente do `approf-admin`.
2. Confirmar URL publica do admin em `VITE_APPROF_ADMIN_API_URL` no app da professora.
3. Fazer build, commit, push e deploy dos arquivos locais de IA.
4. Testar geracao ponta a ponta com professora autenticada.
5. Validar se o provider/model retornado esta coerente com a cobranca estimada.

### P1 Recomendado

1. Geracao de imagens pedagogicas via OpenAI, sempre server-side.
2. Pipeline de anexos reais: upload privado, leitura/OCR quando permitido e referencia segura no prompt.
3. Classificacao inteligente de anotacoes com JSON estruturado e limiar de confianca.
4. Alertas inteligentes discretos na home.
5. Sugestoes de planejamento com base no historico real da turma.

### P2 Recomendado

1. Busca semantica com embeddings e pgvector.
2. Analise de padroes semanais.
3. Briefing interno para reuniao com familia.
4. Analise do termometro emocional.
5. Retrospectiva mensal pedagogica.

## Pontos Que Estao De Acordo Com O Projeto

- Separar Claude para texto e OpenAI para imagens/embeddings faz sentido.
- Manter API keys somente no backend esta correto.
- Persistir documentos gerados em `reports` evita duplicacao de tabelas.
- Usar logs de IA e consumo por geracao esta correto para auditoria e custo.
- Usar RPC transacional para reserva/finalizacao/estorno e versao final esta correto.
- A regra de BNCC 0-5, sem diagnostico e sem comparacao entre criancas esta alinhada ao produto.
- A professora manter controle editorial do texto gerado esta alinhado com a experiencia desejada.

## Decisao De Produto: 3 IAs Em Cascata Para Documentos

A arquitetura do Approf deve usar 3 etapas em cascata para documentos pedagogicos importantes, como relatorios, planejamentos e textos de portfolio.

O objetivo nao e apenas gerar texto, mas criar um documento com qualidade de especialista:

1. Rascunho pedagogico: organiza contexto, anotacoes e estrutura do documento.
2. Revisao BNCC: confere coerencia pedagogica, campos de experiencia, seguranca textual e ausencia de diagnostico/comparacao.
3. Refinamento final: melhora fluidez, personalizacao, tom humano e prontidao para uso pela professora.

Requisito tecnico:

- cada etapa deve ter prompt proprio e versao registrada;
- a geracao final deve continuar passando por reserva, finalizacao e estorno de uso;
- o resultado intermediario pode ficar fora do banco no MVP, mas o resultado final, provider/model, custo estimado e custo real devem ser persistidos;
- se qualquer etapa falhar, a reserva deve ser estornada e nenhum documento parcial deve ficar visivel para a professora;
- a professora continua sendo a revisora final.

Observacao: a implementacao atual de texto usa uma chamada Claude. Ela deve evoluir para o pipeline em cascata antes da liberacao definitiva da IA textual como experiencia premium.

## Portfolio Visual De Evolucao Da Crianca

O ChatGPT/OpenAI deve ser usado para gerar o portfolio visual de evolucao da crianca, com 1 imagem por crianca.

A imagem deve parecer um painel pedagogico ilustrado, inspirado nos exemplos fornecidos, contendo informacoes preenchidas a partir das anotacoes reais da professora.

Conteudo minimo do portfolio:

- titulo do portfolio;
- nome da crianca;
- idade/faixa etaria;
- turma;
- periodo;
- escola/professora quando disponivel;
- identificacao/sobre a crianca;
- campos de experiencia BNCC;
- avancos e conquistas por campo;
- evidencias de aprendizagem;
- linha do tempo ou marcos de evolucao quando houver dados suficientes;
- proximos passos pedagogicos;
- registros que contam ou sintese afetiva;
- mensagem final positiva.

Arquitetura recomendada para qualidade:

1. Claude cria um JSON pedagogico estruturado com todas as secoes do portfolio, usando as anotacoes da professora.
2. O app/backend valida se os campos obrigatorios estao preenchidos e aplica fallback quando faltar informacao.
3. A camada visual renderiza textos de forma deterministica em HTML/canvas/PDF ou template interno.
4. OpenAI gera elementos visuais/ilustrativos quando necessario, ou uma imagem de fundo/decoracao sem depender dela para escrever textos pequenos.

Ponto critico: nao e recomendado pedir para a IA de imagem escrever todo o texto final dentro da imagem, porque modelos de imagem podem errar acentuacao, letras, nomes, datas e textos pequenos. Para um portfolio profissional, o conteudo textual deve ser produzido/validado pelo Claude e renderizado pelo proprio sistema.

Privacidade:

- nao gerar rostos identificaveis de criancas artificialmente;
- fotos reais enviadas pela professora devem vir de bucket privado e aparecer apenas quando houver permissao/uso autorizado;
- se nao houver foto real autorizada, usar ilustracoes infantis sem rosto identificavel.

## Pontos Que Precisam De Correcao Ou Cuidado

- O documento fala em varios modelos e precos especificos; estes valores nao devem ser tratados como verdade fixa no codigo.
- O documento descreve tres chamadas em cascata para documentos. Isso agora foi assumido como decisao de produto, mas o codigo atual ainda usa uma chamada textual.
- O documento menciona prompt versionado no banco. O codigo atual versiona prompts em arquivo. Isso e aceitavel no MVP, mas depois deve migrar para uma tabela ou registry administravel.
- O documento fala em anexos e fotos sendo analisados. Para a fase atual, a professora pode anexar imagens/documentos como contexto, mas nao sera feita analise automatica do conteudo desses arquivos ainda.
- O documento fala em imagens via Batch API. Isso exige fluxo assincrono, status e notificacao; nao deve ser tratado como resposta instantanea.
- O documento inclui analises sensiveis de comportamento. Elas devem sempre usar linguagem pedagogica e evitar conclusoes clinicas.
- Busca semantica exige `pgvector`, politica de retencao e cuidado com dados pessoais de criancas.
- Jobs automaticos precisam de agendamento, idempotencia e limites de custo para nao gerar gasto silencioso.

## Melhorias Recomendadas

1. Criar uma camada `ai-orchestrator` no backend para separar provider, prompt, persistencia e cobranca.
2. Guardar `prompt_version`, `provider`, `model`, custo estimado, custo real e origem do contexto em toda geracao.
3. Adicionar um campo de `quality/safety_review` no futuro para registrar se o texto passou por validacao pedagogica automatica.
4. Implementar idempotency key por clique de geracao para evitar duplicidade em retries do frontend.
5. Adicionar rate limit por professora para proteger custo e evitar spam.
6. Criar uma tela administrativa simples de auditoria de IA: geracoes por professora, custo, status, erros e estornos.
7. Para imagens, proibir rostos identificaveis de criancas no prompt server-side, sem depender do frontend.
8. Para documentos sensiveis, manter exportacao/compartilhamento como etapa consciente da professora.

## Proximo Caminho Tecnico

Ordem recomendada:

1. Fechar o pipeline Claude em 3 etapas para documentos.
2. Testar relatorio e planejamento com dados reais.
3. Ajustar qualidade dos prompts com exemplos reais.
4. Implementar portfolio visual por crianca com Claude estruturando conteudo e OpenAI apoiando a parte visual.
5. Depois evoluir classificacao de anotacoes, alertas e busca semantica.

Nao recomendo implementar todos os 11 pontos de IA agora. O melhor caminho e consolidar documentos em cascata, portfolios visuais, documentos salvos, custo controlado e experiencia da professora antes de ampliar para automacoes.
