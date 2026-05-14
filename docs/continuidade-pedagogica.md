# Continuidade Pedagogica da Crianca

Atualizado em: 2026-05-09

## Objetivo

Garantir que a jornada pedagogica da crianca acompanhe sua historia, mesmo quando muda de professora, turma, escola ou ano letivo.

O Approf deve preservar a memoria pedagogica individual da crianca sem transformar isso em busca publica ou exposicao de dados sensiveis.

## Codigos unicos

Cada professora deve ter um codigo unico de cadastro.

Exemplo:

```txt
PROF-ANA-2026
```

Cada crianca deve ter um codigo unico de continuidade.

Exemplo:

```txt
CRI-LUC-4F8K
```

## Fluxo 1: nova professora com codigo da crianca

1. A professora informa o codigo unico da crianca.
2. O sistema localiza a crianca.
3. O sistema mostra uma previa segura.
4. A professora confirma que e a mesma crianca.
5. O sistema vincula a crianca a nova turma/professora.
6. A timeline e a memoria pedagogica seguem continuas.

## Fluxo 2: nova professora sem codigo

Quando a professora nao tem o codigo, ela pode buscar por:

- nome da crianca;
- data de nascimento;
- escola/turma anterior, quando existir.

O sistema pode mostrar uma previa segura para reconhecimento.

Essa previa pode conter:

- nome;
- idade/data de nascimento;
- escola ou turma anterior;
- quantidade de registros;
- categorias gerais da timeline;
- marcos resumidos sem fotos, documentos ou relatorios completos.

Nao mostrar sem autorizacao:

- fotos;
- anexos;
- documentos;
- relatorios completos;
- observacoes sensiveis;
- dados familiares privados.

Quando houver duvida ou ausencia de autorizacao direta, o Super Admin pode aprovar manualmente com registro de auditoria.

## Super Admin

O Super Admin deve ter uma area propria para:

- visualizar solicitacoes de vinculo;
- aprovar ou negar casos sem codigo;
- acompanhar transferencias entre professoras;
- auditar buscas por nome/data de nascimento;
- revisar casos sensiveis;
- garantir que previas nao exponham fotos, anexos ou relatorios completos.
- aprovar ou negar solicitacoes com justificativa obrigatoria.

Cada decisao deve registrar:

- ator;
- data;
- crianca;
- professora solicitante;
- decisao;
- justificativa;
- dados usados para conferencia.

No modal de decisao, o Super Admin pode visualizar uma previa segura da timeline contendo apenas:

- periodo ou data geral;
- categoria pedagogica;
- resumo do marco;
- nenhuma foto;
- nenhum anexo;
- nenhum relatorio completo;
- nenhuma observacao sensivel.

## Fluxo 3: transferencia feita pela professora atual

A professora atual pode entrar no perfil da crianca e transferir para:

- outra professora, usando o codigo unico da professora de destino;
- outra turma da mesma professora, sem codigo externo.

Regras:

- a transferencia deve registrar origem, destino, data e motivo;
- a professora de destino deve aceitar ou o Super Admin deve aprovar;
- o historico pedagogico acompanha a crianca;
- fotos e anexos continuam privados e so ficam acessiveis apos vinculo aprovado.

## Regra central

A crianca nao pertence a professora.

A professora possui acesso pedagogico autorizado a jornada daquela crianca.

Cada crianca continua sendo unica. Este recurso nunca deve ser usado para comparacao entre criancas.
