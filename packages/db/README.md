# @approf/db

Banco de dados e regras de privacidade do Approf.

O schema inicial esta em `supabase/migrations/0001_initial_privacy_foundation.sql`.

## Decisoes Confirmadas

- O projeto segue como monorepo.
- A nomenclatura tecnica do banco e do codigo pode permanecer em ingles.
- Tabelas como `classes`, `students`, `annotations`, `reports`, `calendar_events`, `attendance_records`, `ai_usage_wallets`, `ai_semester_entitlements`, `ai_generation_logs` e `ai_extra_credit_purchases` sao o padrao atual.
- `annotations` guarda o texto pedagogico, tags e persistencia.
- `annotation_targets` guarda os vinculos da anotacao com crianca, turma, escola ou professora.

## Principios Obrigatorios

- RLS ativo desde o primeiro dia.
- Fotos de criancas ficam em buckets privados.
- Arquivos sensiveis usam caminho com prefixo do `owner_id`.
- Super admin pode auditar e operar, mas o app da professora so acessa seus proprios dados.
- Eventos sensiveis devem gerar registro em `admin_action_logs` quando feitos pelo painel interno.
- Chamadas de IA devem ser feitas apenas por backend/API server-side.
- Prompts pedagogicos devem ser versionados e alinhados a BNCC para Educacao Infantil de 0 a 5 anos.
- `docs/ia-bncc-inclusao.md` e uma referencia pedagogica inicial obrigatoria para prompts e validacoes de IA.
- Referencias externas registradas nesse documento devem ser importadas para o repo antes de virar regra automatica de prompt.
- Relatorios gerados devem registrar modelo, prompt_version, tokens, custo e dados usados.
- O uso de IA deve ser apresentado como GizTokens para a professora, mas registrado com custo estimado/real para controle interno.
- O teto operacional de custo incluso por professora deve ser controlado no backend, com extras pagos quando o limite for excedido.
- Relatorios semestrais de desenvolvimento devem ter garantia por crianca/ciclo, sem depender apenas do saldo mensal de GizTokens.

## Migrations Atuais

```txt
0001_initial_privacy_foundation.sql
0002_auth_profile_bootstrap.sql
0003_student_photo_position.sql
0004_calendar_events.sql
0005_attendance_records.sql
0006_ai_usage_and_giztokens.sql
```

## Convencao De Storage

```txt
child-photos/{teacher_user_id}/{student_id}/{file_name}
report-exports/{teacher_user_id}/{report_id}.pdf
material-files/{category}/{file_name}
```
