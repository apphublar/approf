# Privacidade e LGPD no Approf

## Dados sensiveis tratados

- Nome, email e telefone de professoras.
- Escola, turma e rotina profissional.
- Nome, idade, etiquetas de apoio e observacoes de alunos.
- Anotacoes pedagogicas.
- Relatorios gerados por IA.
- Fotos e arquivos de criancas.
- Consentimentos de responsaveis.

## Principio pedagogico

- O Approf nunca deve comparar criancas entre si.
- Cada crianca deve ser acompanhada em sua propria jornada.
- O sistema nao deve criar ranking, nota comparativa ou classificacao entre alunos.

## Regras tecnicas obrigatorias

- RLS sempre ativo.
- Cada professora acessa somente seus proprios dados.
- Super Admin acessa dados apenas para operacao, suporte, auditoria e seguranca.
- Fotos de criancas ficam em bucket privado.
- PDFs de relatorio ficam em bucket privado.
- Service role nunca pode ir para frontend.
- Eventos administrativos sensiveis devem ser registrados em `admin_action_logs`.

## Fotos de criancas

Nenhuma foto deve ser publica por padrao.

Padrao de storage:

```txt
child-photos/{teacher_user_id}/{student_id}/{file_name}
```

Antes de anexar ou usar fotos em qualquer recurso:

- verificar consentimento do responsavel;
- registrar tipo de consentimento;
- guardar evidencia quando houver documento;
- permitir remocao definitiva quando solicitado.

## Anexos em anotacoes

O app tera recurso de anexar imagem ou arquivo em anotacoes.

Regras:

- considerar todo anexo como potencialmente sensivel;
- fotos de criancas devem ser privadas por padrao;
- anexos nao devem ficar em URL publica;
- antes de usar anexos com IA, verificar consentimento;
- o service worker nao deve fazer cache agressivo de fotos de criancas.

## IA e relatorios

- Relatorios com IA devem ser editaveis antes de exportar.
- Guardar uso em `reports_usage`.
- Versionar prompts.
- Evitar mandar fotos para IA sem consentimento explicito.
- Nao usar dados de criancas para treino de modelo.

## Telegram e emails

- Telegram deve exigir vinculacao voluntaria.
- Registrar `telegram_chat_id` apenas depois do opt-in.
- Permitir desativar notificacoes.
- Nao enviar dados sensiveis completos em mensagens externas.
- Preferir mensagem curta com link seguro para o app.

## Comunidade

- A Comunidade deve ter liberacao gradual pelo Super Admin.
- Posts nao devem conter nome completo, foto ou dados identificaveis de criancas.
- A moderacao precisa existir antes da liberacao para toda a base.
- Super Admin deve poder ocultar ou remover posts.
- Acesso pode ser global ou por professora selecionada.

## Checklist antes de usuarias reais

- RLS testado com pelo menos duas professoras.
- Buckets privados testados.
- Super admin protegido por role.
- `.env` sem chaves sensiveis commitadas.
- Fluxo de exclusao/exportacao de dados definido.
- Politica de privacidade publica revisada.
