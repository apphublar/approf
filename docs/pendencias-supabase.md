# Pendencias Para Quando o Supabase Liberar

## Status atual da integracao

- SDK `@supabase/supabase-js` instalado no app das professoras.
- Cliente Supabase criado em `apps/professora/src/services/supabase`.
- App das professoras ganhou tela de login/cadastro quando `VITE_APPROF_DATA_MODE=supabase`.
- Enquanto URL/key nao estiverem configuradas, o app continua em modo `mock`.
- Migration `0002_auth_profile_bootstrap.sql` criada para gerar `profiles` e `subscriptions` automaticamente no cadastro via Supabase Auth.

## 1. Criar projeto e rodar schema

- Criar projeto Supabase.
- Confirmar regiao.
- Ativar Auth por email.
- Executar `supabase/migrations/0001_initial_privacy_foundation.sql`.
- Executar `supabase/migrations/0002_auth_profile_bootstrap.sql`.
- Executar `supabase/migrations/0003_student_photo_position.sql`.
- Executar `supabase/migrations/0004_calendar_events.sql`.
- Executar `supabase/migrations/0005_attendance_records.sql`.
- Conferir se todos os buckets foram criados como privados.

## 2. Variaveis de ambiente

Preencher:

```txt
apps/professora/.env
apps/site/.env
apps/admin/.env
```

Com:

```txt
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

No app das professoras, os nomes reais sao:

```txt
VITE_APPROF_DATA_MODE=supabase
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

No frontend, usar somente anon key. Service role fica apenas server-side no Admin/API.

## 3. Primeiro super admin

- Criar usuario pelo Supabase Auth.
- Inserir/atualizar registro em `profiles` com `role = 'super_admin'`.
- Testar login no Admin.

## 4. Testes obrigatorios de RLS

Antes de colocar usuarias reais:

- Professora A nao pode ver alunos da professora B.
- Professora A nao pode ver fotos da professora B.
- Professora nao pode alterar `subscriptions` diretamente.
- Admin consegue listar professoras, assinaturas e uso de IA.
- Buckets `child-photos` e `report-exports` nao podem ter URL publica.

## 5. Trocar camada de dados

Implementar:

```txt
apps/professora/src/services/supabase-data.ts
apps/professora/src/services/supabase-client.ts
apps/admin/lib/supabase-server.ts
apps/site/lib/supabase-client.ts
```

Depois mudar:

```txt
VITE_APPROF_DATA_MODE=supabase
```

## 6. Lista de espera

- Criar tabela `waitlist`.
- Conectar formulario do site.
- Registrar origem/campanha se houver.

## 7. Assinatura manual

- Usar `subscriptions.provider = 'manual'`.
- Admin deve liberar, bloquear ou renovar acesso.
- Registrar alteracoes em `admin_action_logs`.

## 8. Materiais de apoio

- Criar categorias iniciais em `material_categories`.
- Conectar upload do Super Admin ao bucket `material-files`.
- Salvar metadados em `materials`.
- Publicar somente quando `status = 'published'`.
- No app das professoras, listar apenas materiais publicados.
- Permitir download dos arquivos publicados.
- Registrar ou incrementar `downloads_count` quando a professora baixar.

## 9. Timeline e memoria pedagogica

- Conectar `student_timeline_events`. (iniciado: listagem e criacao de marcos no app das professoras)
- Persistir eventos criados diretamente no perfil da crianca. (iniciado)
- Transformar anotacoes relevantes em eventos de timeline.
- Persistir `tags` e `persistence` nas anotacoes. (iniciado: criacao e listagem conectadas a `annotations`)
- Persistir `attachment_path` nas anotacoes com upload privado de anexo.
- Persistir anexos de timeline em bucket privado.
- Garantir que anexos sensiveis usem bucket privado.
- Nunca criar comparacao entre criancas.

## 10. Turmas e criancas

- Trocar cadastro e edicao local de turmas por insert/update em `classes`. (iniciado: criacao, edicao e listagem real de turmas conectadas)
- Trocar cadastro e edicao local de criancas por insert/update em `students`. (iniciado: criacao, edicao e listagem real de criancas conectadas)
- Manter separacao por professora via RLS.
- Foto opcional da crianca conectada ao bucket privado `child-photos` no app das professoras.
- Gerar URL assinada somente para a professora autorizada. (iniciado no app das professoras)
- Persistir ajuste de posicao da foto para avatar redondo com `students.photo_position`.
- Garantir auditoria minima de alteracoes sensiveis em criancas.

## 11. Relatorios com IA

- Criar backend/API server-side para chamadas de Claude e OpenAI.
- Garantir que `ANTHROPIC_API_KEY` e `OPENAI_API_KEY` nunca sejam expostas ao frontend.
- Criar prompts pedagogicos versionados para relatorios, planejamentos e encaminhamentos.
- Definir `prompt_version` em cada documento gerado.
- Validar que todo prompt siga BNCC, Educacao Infantil 0 a 5 anos e linguagem nao clinica.
- Registrar modelo usado, tokens, custo e dados usados na geracao.
- Persistir o contexto adicional informado antes da geracao.
- Conectar anexos de relatorio a bucket privado.
- Enviar para a IA somente anexos autorizados e necessarios.
- Registrar quais dados/anexos foram usados em cada geracao.
- Manter historico para auditoria e transparencia com a professora.

## 11.1 Proxima fase recomendada

Prioridade tecnica imediata:

1. Conectar anotacoes reais em `annotations` e `annotation_targets`.
2. Testar anotacoes reais com duas professoras para validar RLS.
3. Criar API server-side de IA.
4. Versionar prompts pedagogicos.
5. Gerar e salvar relatorios/planejamentos reais em `reports`.
6. Testar RLS e auditoria antes de liberar para uso real.

## 12. Calendario e Telegram

- Eventos manuais do calendario conectados a `calendar_events`. (iniciado)
- Criar rotina server-side para enviar lembretes via Telegram.
- Usar `calendar_events.telegram_notified_at` para evitar notificacoes duplicadas.
- Incluir datas comemorativas e pedagogicas anuais na rotina de notificacao.
- Permitir configurar antecedencia do lembrete por professora.

## 13. Continuidade pedagogica

- Criar codigo unico da professora em `profiles`.
- Criar identidade continua da crianca em tabela propria, como `child_profiles`.
- Criar codigo unico da crianca.
- Separar identidade da crianca do vinculo com turma/professora.
- Criar tabela de transferencias, como `child_transfers`.
- Criar tabela de permissoes de acesso, como `child_access_grants`.
- Permitir busca por codigo da crianca.
- Permitir busca segura por nome + data de nascimento com previa limitada.
- Permitir transferencia por codigo da professora.
- Registrar todas as buscas, solicitacoes, aprovacoes e transferencias em auditoria.
- Nunca liberar fotos, anexos ou relatorios completos sem vinculo aprovado.
- Timeline deve acompanhar `child_profiles` para manter continuidade entre professoras.
