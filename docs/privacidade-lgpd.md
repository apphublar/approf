# Privacidade e LGPD no Approf

## Dados sensíveis tratados

- Nome, email e telefone de professoras.
- Escola, turma e rotina profissional.
- Nome, idade, etiquetas de apoio e observações de alunos.
- Anotações pedagógicas.
- Relatórios gerados por IA.
- Fotos e arquivos de crianças.
- Consentimentos de responsaveis.

## Principio pedagogico

- O Approf nunca deve comparar crianças entre si.
- Cada criança deve ser acompanhada em sua propria jornada.
- O sistema não deve criar ranking, nota comparativa ou classificacao entre alunos.

## Regras tecnicas obrigatorias

- RLS sempre ativo.
- Cada professora acessa somente seus proprios dados.
- Super Admin acessa dados apenas para operacao, suporte, auditoria e segurança.
- Fotos de crianças ficam em bucket privado.
- PDFs de relatório ficam em bucket privado.
- Service role nunca pode ir para frontend.
- Eventos administrativos sensíveis devem ser registrados em `admin_action_logs`.

## Fotos de crianças

Nenhuma foto deve ser publica por padrao.

Padrao de storage:

```txt
child-photos/{teacher_user_id}/{student_id}/{file_name}
```

Antes de anexar ou usar fotos em qualquer recurso:

- verificar consentimento do responsável;
- registrar tipo de consentimento;
- guardar evidencia quando houver documento;
- permitir remocao definitiva quando solicitado.

## Anexos em anotações

O app tera recurso de anexar imagem ou arquivo em anotações.

Regras:

- considerar todo anexo como potencialmente sensível;
- fotos de crianças devem ser privadas por padrao;
- anexos não devem ficar em URL publica;
- antes de usar anexos com IA, verificar consentimento;
- o service worker não deve fazer cache agressivo de fotos de crianças.

## IA e relatórios

- Relatórios com IA devem ser editaveis antes de exportar.
- Guardar uso em `reports_usage`.
- Versionar prompts.
- Evitar mandar fotos para IA sem consentimento explicito.
- Nao usar dados de crianças para treino de modelo.

## Telegram e emails

- Telegram deve exigir vinculacao voluntaria.
- Registrar `telegram_chat_id` apenas depois do opt-in.
- Permitir desativar notificacoes.
- Nao enviar dados sensíveis completos em mensagens externas.
- Preferir mensagem curta com link seguro para o app.

## Comunidade

- A Comunidade deve ter liberacao gradual pelo Super Admin.
- Posts não devem conter nome completo, foto ou dados identificáveis de crianças.
- A moderacao precisa existir antes da liberacao para toda a base.
- Super Admin deve poder ocultar ou remover posts.
- Acesso pode ser global ou por professora selecionada.

## Checklist antes de usuarias reais

- RLS testado com pelo menos duas professoras.
- Buckets privados testados.
- Super admin protegido por role.
- `.env` sem chaves sensíveis commitadas.
- Fluxo de exclusao/exportacao de dados definido.
- Politica de privacidade publica revisada.
