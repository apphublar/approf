# @approf/db

Banco de dados e regras de privacidade do Approf.

O schema inicial esta em `supabase/migrations/0001_initial_privacy_foundation.sql`.

## Decisoes Confirmadas

- O projeto segue como monorepo.
- A nomenclatura tecnica do banco e do codigo pode permanecer em ingles.
- Tabelas como `classes`, `students`, `annotations`, `reports`, `calendar_events` e `attendance_records` sao o padrao atual.
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

## Convencao De Storage

```txt
child-photos/{teacher_user_id}/{student_id}/{file_name}
report-exports/{teacher_user_id}/{report_id}.pdf
material-files/{category}/{file_name}
```
