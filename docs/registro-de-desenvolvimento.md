# Registro de Desenvolvimento do Approf

Atualizado em: 2026-05-13

## Decisao de arquitetura

O projeto sera mantido como monorepo profissional. Essa e a decisao oficial do projeto, mesmo que documentos antigos mencionem repositorios separados.

Motivos:

- facilita compartilhar tipos, regras de acesso, configuracoes e utilitarios entre site, app e admin;
- reduz retrabalho enquanto o produto ainda esta sendo consolidado;
- permite builds e deploys independentes por app na Vercel;
- mantem a arquitetura organizada sem fragmentar o desenvolvimento cedo demais.

```txt
apps/
  site/          Landing page publica
  professora/   App PWA usado pelas professoras
  admin/        Super Admin interno
packages/
  auth/          Regras compartilhadas de acesso
  config/        Configuracoes compartilhadas
  db/            Documentacao do banco e privacidade
  notifications/ Eventos de email, Telegram e sistema
  types/         Tipos compartilhados
supabase/
  migrations/    Schema e politicas RLS
docs/
  *.md           Registro do projeto e pendencias
```

Convencao confirmada: tabelas, tipos e codigo podem manter nomes em ingles, como `classes`, `students`, `annotations`, `reports` e `attendance_records`.

## Diretriz de IA pedagogica

As APIs de Claude e ChatGPT/OpenAI devem ser usadas somente por backend/API server-side. Nenhuma chave de IA pode ficar no frontend.

A IA do Approf nao deve ser tratada como um chat generico. Toda geracao precisa passar por uma camada pedagogica propria, com:

- prompts versionados no banco ou em camada server-side versionada;
- system prompt alinhado a Educacao Infantil de 0 a 5 anos;
- regras explicitas da BNCC e dos campos de experiencia;
- linguagem pedagogica, acolhedora, descritiva e nao clinica;
- proibicao de comparacao entre criancas;
- proibicao de diagnostico medico;
- trilha de auditoria indicando tipo de documento, modelo usado, prompt_version, dados usados, tokens e custo;
- revisao/validacao da professora antes de exportar ou compartilhar qualquer documento.

Observacao: "treinar" a IA, no contexto do MVP, significa configurar prompts, exemplos, criterios de validacao e roteamento de modelos. Fine-tuning so deve ser avaliado depois que houver volume suficiente de documentos revisados e autorizacao adequada de uso dos dados.

## Implementado ate agora

- Monorepo com `apps/site`, `apps/professora` e `apps/admin`.
- Super Admin MVP visual em `apps/admin`.
- Super Admin reorganizado em rotas:
  - dashboard;
  - professoras;
  - assinaturas manuais;
  - materiais de apoio;
  - uso de IA;
  - privacidade;
  - auditoria;
  - notificacoes.
- Tela de materiais no Super Admin para categorias, upload mockado, status e lista de arquivos.
- Migration Supabase inicial em `supabase/migrations/0001_initial_privacy_foundation.sql`.
- Tabelas planejadas para professoras, assinaturas manuais, escolas, turmas, alunos, consentimentos, fotos, anotacoes, relatorios, uso de IA, Telegram, notificacoes e auditoria.
- Materiais de apoio planejados com categorias, status `draft/published/archived`, metadados de arquivo e contador de downloads.
- RLS previsto desde o primeiro schema.
- Buckets privados planejados para fotos de criancas e PDFs de relatorio.
- PWA base no app das professoras:
  - `manifest.webmanifest`;
  - icone;
  - service worker;
  - tela offline;
  - metadados mobile.
- Camada de dados inicial em `apps/professora/src/services`:
  - `mock` ativo agora;
  - placeholder para `supabase` quando a conta estiver validada.
- Arquivos `.env.example` para site, app e admin.
- Escopo confirmado do app da professora registrado em `docs/escopo-app-professora.md`.
- Principio permanente registrado: o Approf nunca compara criancas entre si.
- Comunidade criada no app com controle de acesso mockado.
- Super Admin ganhou rota `/liberacoes` para mapear liberacao global ou por professora.
- Schema planejado ganhou `feature_flags`, `feature_user_access` e `community_posts`.
- Perfil da Crianca ampliado com dados individuais, observacoes gerais, jornada individual e timeline.
- Anotacoes ganharam persistencia pedagogica: relatorio atual, proximo relatorio, observacao continua, planejamento futuro, observacao importante e evolucao positiva.
- App da professora ganhou cadastro local de nova turma.
- App da professora ganhou cadastro local de nova crianca dentro da turma.
- Cadastro de crianca ja deixa marcado que foto infantil sera upload privado quando o Supabase Storage estiver conectado.
- Fluxo de relatorio com IA ganhou etapa obrigatoria antes da geracao para contexto adicional da professora.
- Antes de gerar relatorio, a professora pode orientar a IA, selecionar sugestoes de direcionamento e anexar imagem/documento com seletor local real.
- Diretriz central registrada: Approf atende professoras da educacao infantil com criancas de 0 a 5 anos.
- App da professora ganhou edicao local de turma.
- App da professora ganhou edicao local de crianca, preservando o tratamento privado de fotos.
- Modelo de continuidade pedagogica registrado em `docs/continuidade-pedagogica.md`.
- Definido que professoras e criancas terao codigos unicos para transferencia e continuidade da jornada.
- App da professora ganhou cadastro local de eventos na timeline da crianca.
- Eventos da timeline aceitam tipo, titulo, registro da professora, tags rapidas e anexo opcional.
- Super Admin ganhou rota `/continuidade` para acompanhar vinculos, transferencias e casos de aprovacao manual.
- Painel de continuidade mostra metricas, solicitacoes, transferencias e auditoria recente.
- Super Admin ganhou modal visual para aprovar ou negar solicitacao de vinculo com justificativa obrigatoria.
- Modal de continuidade passou a exibir previa segura da timeline com data, categoria e resumo sem fotos/anexos/relatorios completos.
- IA Pedagogica do app ganhou cards funcionais para todos os documentos visiveis.
- Cards de relatorio abrem o fluxo com contexto extra e anexos antes da geracao.
- Cards de Planejamento, Atividade Tematica e Roda de Conversa abrem gerador visual com turma, faixa etaria, tema, BNCC, orientacao extra, anexos e preview.
- IA Pedagogica passou a usar Relatorio de desenvolvimento no lugar de Relatorio Individual e Parecer Descritivo.
- Foram incluidos os cards Diario de bordo e Portfolio pedagogico.
- Fluxo de relatorio passou a permitir escolher a crianca, gerar com anotacoes selecionadas ou comecar do zero.
- Relatorio Atipico segue o mesmo fluxo, com observacao explicita de que nao faz diagnostico clinico.
- Campo BNCC no gerador pedagogico passou a aceitar multiplas escolhas.
- Planejamento pode ser gerado considerando anotacoes e ideias registradas pela professora.
- Previews da IA passaram a ter estruturas diferentes por tipo: relatorio de desenvolvimento, relatorio atipico, diario de bordo, portfolio pedagogico e planejamento.
- IA Pedagogica foi reorganizada por categorias: relatorios pedagogicos, planejamentos, especialistas e documentacao complementar.
- Foram incluidos os tipos do PDF de educacao infantil: planejamento anual, semestral, mensal, quinzenal, semanal e plano de aula diario.
- Foram incluidos relatorios para neuropediatra, psiquiatra infantil, fonoaudiologo, terapeuta ocupacional, psicologo e psicopedagogo.
- Foi incluido encaminhamento para especialista com foco em observacoes pedagogicas, sem diagnostico.
- Foram incluidos projeto pedagogico especifico, ficha de anamnese e registro de reuniao de pais.
- Modelos de especialistas passaram a trazer eixos especificos: linguagem/comunicacao, socializacao, comportamento, sensorial, sono, alimentacao, autonomia, psicomotricidade, aprendizagem e regulacao emocional.
- IA Pedagogica ganhou busca por modelo e filtros por categoria para facilitar navegacao entre muitos documentos.
- Cards da IA Pedagogica, Material de Apoio e Acesso Rapido da home foram ajustados para lista de largura cheia, evitando espacos vazios quando houver quantidade impar de itens.
- Lousa da home ganhou textura sutil de giz apagado com linhas fracas e manchas leves.
- Saudacao da home passou a remover prefixos como Prof., Profª e variacoes quebradas antes de exibir o primeiro nome na lousa.
- Lousa da home passou a exibir obrigatoriamente o formato `Prof. Nome`, usando apenas o primeiro nome limpo da professora.
- SDK do Supabase foi instalado no app das professoras.
- App das professoras ganhou cliente Supabase, checagem de variaveis e tela de login/cadastro ativada por `VITE_APPROF_DATA_MODE=supabase`.
- Foi criada a migration `0002_auth_profile_bootstrap.sql` para criar perfil e trial automaticamente no cadastro via Supabase Auth.
- App das professoras passou a carregar perfil e turmas reais do Supabase apos login.
- Criacao e edicao de turmas passaram a salvar em `schools` e `classes` quando o modo Supabase esta ativo.
- Formularios de nova/edicao de turma tiveram rodape ajustado para manter o botao de salvar sempre visivel.
- Nome da professora passou a ser normalizado em formato de nome proprio, exibindo `Prof. Thiago` mesmo quando o cadastro vem em caixa alta.
- Subscreens passaram a ficar acima do BottomNav para evitar que botoes de acao, como `Salvar turma`, sejam cobertos pela navegacao inferior.
- App das professoras passou a carregar criancas reais da tabela `students` dentro de cada turma.
- Criacao e edicao de criancas passaram a salvar em `students` quando o modo Supabase esta ativo.
- Cadastro e edicao de criancas ganharam upload real de foto para bucket privado `child-photos`.
- Fotos de criancas passaram a usar URL assinada, avatar redondo e ajuste de posicao para enquadrar o rosto no circulo.
- Foi criada a migration `0003_student_photo_position.sql` para persistir o ajuste visual da foto.
- Timeline da crianca passou a carregar eventos reais de `student_timeline_events` no Supabase.
- Criacao de marco/evolucao passou a salvar em `student_timeline_events` quando o modo Supabase esta ativo.
- Contador de registros do perfil da crianca passou a considerar os marcos reais carregados do Supabase.
- Calendario pedagogico ganhou criacao de eventos por data com horario, observacoes e alerta.
- Foi criada a migration `0004_calendar_events.sql` para salvar eventos do calendario no Supabase com RLS por professora.
- Eventos manuais do calendario passaram a salvar/carregar da tabela `calendar_events` quando o modo Supabase esta ativo.
- Datas comemorativas e pedagogicas anuais passaram a ser calculadas no app, incluindo datas fixas e moveis.
- A tabela `calendar_events` ja inclui `telegram_notified_at` para futura integracao de lembretes via Telegram.
- IA Pedagogica foi simplificada: planejamentos ficaram unificados em um card com escolha de periodo.
- Atividade Tematica, Roda de Conversa e relatorios especificos para especialistas foram removidos como cards independentes.
- Encaminhamento para especialista foi mantido.
- Turmas ganharam lista de chamada, calendario de frequencia e relatorio local de presencas/faltas.
- Foi criada a migration `0005_attendance_records.sql` para persistir chamadas por turma/data no Supabase com RLS.
- Foi definida como proxima fase tecnica: conectar anotacoes reais e IA real segura, antes de expandir novas telas.
- Anotacoes passaram a carregar da tabela `annotations` quando o app esta em modo Supabase.
- Criacao de anotacoes passou a salvar em `annotations` e vincular destinos em `annotation_targets`.
- O app mantem fallback local para anotacoes quando esta em modo mock ou sem Supabase configurado.
- Anexos de anotacoes continuam como pendencia de upload privado; o app ainda nao grava `attachment_path` real sem storage.

## Proximas funcionalidades confirmadas para o app

- Conectar IA Pedagogica real aos prompts versionados e ao OpenAI quando Supabase/env estiverem prontos.
- Criar backend/API server-side para IA com Claude e OpenAI, mantendo chaves fora do frontend.
- Criar tabela/estrutura de `ai_prompts` ou equivalente para versionar system prompts pedagogicos.
- Criar validacao pedagogica obrigatoria dos documentos gerados, alinhada a BNCC e Educacao Infantil 0 a 5 anos.
- Foi registrado o documento `docs/ia-bncc-inclusao.md` como referencia inicial para a IA pedagogica sobre BNCC, direitos de aprendizagem, campos de experiencia e inclusao de criancas atipicas.
- O PDF de apoio foi salvo em `docs/referencias/bncc-educacao-infantil-inclusao.pdf` para consulta interna do projeto.
- O link Manus do material BNCC tambem foi registrado: `https://manus.im/share/file/1191b89d-14b6-42c4-bbee-01f0dedcc4c6`.
- Foi registrada uma referencia externa complementar do Manus: "Relatorio Abrangente: A Crianca Atipica no Contexto Escolar" (`https://manus.im/share/file/d5e4f93b-305f-485e-b015-b747cf3692b8`), pendente de importacao completa caso o arquivo baixavel seja disponibilizado.
- Sugestoes inteligentes na home.
- Sistema de `@` para vincular anotacoes a multiplos destinos.
- Tags rapidas de observacao.
- Anexar imagem ou arquivo na anotacao.
- Perfil do aluno com barras de desenvolvimento.
- Material de apoio com busca e categorias expandidas.
- Filtros de alunos dentro da turma.
- Relatorios pendentes sugeridos pela IA.
- Comunidade com postagens, liberada via Super Admin.
- Upload privado de anexos nas anotacoes e persistencia real de `attachment_path`.

## Funcionalidades adiadas/ocultas

- Datas comemorativas com geracao de atividades.
- Conquistas, XP, niveis, selos e modal de selo.

## Validacao feita

O comando abaixo passou:

```txt
pnpm build
```

Ele validou:

- `@approf/site`
- `@approf/professora`
- `@approf/admin`

## Pendente por bloqueio externo

Supabase ainda nao foi conectado porque a conta aguarda validacao de email.

Quando a conta for liberada, voltar para:

1. Criar projeto Supabase.
2. Rodar `supabase/migrations/0001_initial_privacy_foundation.sql`.
3. Configurar URL e anon key nos `.env`.
4. Criar primeiro usuario super admin.
5. Testar RLS com usuario professora e usuario admin.
6. Conectar app e admin aos dados reais.
7. Conectar upload de materiais ao bucket `material-files`.
8. Listar materiais publicados no app das professoras com download.
9. Persistir criacao/edicao de turmas e criancas no Supabase.
10. Rodar `0003_student_photo_position.sql` nos ambientes Supabase que ainda nao receberam a coluna de ajuste da foto.
11. Persistir orientacoes e anexos usados na geracao de relatorios.
12. Conectar anexos de relatorio a bucket privado e incluir no prompt da IA somente quando permitido.
13. Garantir que prompts, exemplos e materiais respeitem educacao infantil de 0 a 5 anos.
14. Implementar continuidade pedagogica no Supabase com codigos unicos, permissoes, transferencias e auditoria.
15. Evoluir timeline para identidade continua da crianca, nao apenas por turma atual.
16. Persistir decisoes de continuidade com justificativa em auditoria.
17. Persistir e carregar previa segura da timeline para avaliacao do Super Admin.

## Regra importante

Dados de professoras e fotos de criancas sao dados sensiveis. Nenhuma foto de crianca deve ficar publica. Todo arquivo desse tipo deve usar bucket privado e caminho por professora/aluno.
