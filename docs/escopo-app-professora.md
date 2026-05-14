# Escopo Confirmado do App da Professora

Atualizado em: 2026-05-13

Este documento registra as funcionalidades confirmadas a partir da analise do prototipo `approf-v3.html`.

## Publico e faixa etaria

O app e voltado para professoras da educacao infantil que acompanham criancas de 0 a 5 anos.

Todos os exemplos, relatorios, atividades, materiais e prompts de IA devem respeitar essa faixa etaria.

## Diretriz obrigatoria para IA

A IA Pedagogica do Approf deve gerar documentos com linhagem pedagogica clara. Ela deve seguir a BNCC para Educacao Infantil de 0 a 5 anos e usar linguagem profissional, acolhedora, descritiva e nao classificatoria.

Referencia interna registrada: `docs/ia-bncc-inclusao.md`.

Regras permanentes:

- prompts de Claude e ChatGPT/OpenAI devem ser versionados;
- chamadas de IA devem passar por backend/API, nunca direto pelo frontend;
- o system prompt deve orientar BNCC, campos de experiencia, faixa etaria e limites eticos;
- a IA nao pode diagnosticar, comparar criancas, rotular negativamente ou produzir linguagem clinica sem base;
- os documentos devem ser revisados pela professora antes de uso externo;
- cada geracao deve registrar modelo, prompt_version, tipo de documento e dados usados.

## Entra na implementacao agora

### IA Pedagogica

- Criar IA Pedagogica como central propria no app.
- Ter tela dedicada para geracao de documentos.
- Todo relatorio deve ter uma etapa antes da geracao para a professora incluir contexto adicional.
- Antes de gerar, permitir orientacao livre para a IA seguir um caminho diferente.
- Antes de gerar, permitir anexar imagem, documento ou evidencia complementar.
- Incluir multiplos tipos de geracao:
  - Relatorio de desenvolvimento;
  - Diario de bordo;
  - Portfolio pedagogico;
  - Planejamento unificado, com escolha interna de periodo anual, semestral, mensal, quinzenal, semanal ou plano de aula diario;
  - Encaminhamento para especialista.
- Incluir documentacao complementar:
  - Projeto pedagogico especifico;
  - Ficha de anamnese;
  - Registro de reuniao de pais.
- Todos os cards visiveis da IA Pedagogica devem abrir um fluxo funcional para visualizacao:
  - documentos de relatorio usam o fluxo de relatorio com escolha da crianca, uso de anotacoes ou criacao do zero, contexto adicional e anexos;
  - planejamento usa gerador pedagogico visual com turma, faixa etaria, tema, multiplos campos BNCC, orientacao extra, anexos e preview.
- Relatorio Atipico deve permitir escolher a crianca e decidir se a IA usara anotacoes existentes ou um texto totalmente novo da professora.
- Quando usar anotacoes, a professora deve poder selecionar todas, apenas algumas ou informar o que deve ser desconsiderado.
- Relatorio de desenvolvimento substitui Relatorio Individual e Parecer Descritivo, pois cumprem o mesmo papel no MVP.
- Planejamento tambem pode nascer das anotacoes e ideias registradas diariamente pela professora.
- Exibir relatorios pendentes sugeridos pela IA na home.

### Home

- Adicionar sugestoes inteligentes na home.
- Exibir relatorios pendentes sugeridos pela IA.
- Manter quadro-negro e notas do quadro.

### Anotacoes

- Implementar sistema de `@` para vincular anotacoes a multiplos destinos.
- Permitir vincular uma anotacao a aluno, turma, escola ou contexto geral.
- Adicionar tags rapidas de observacao:
  - Evolucao positiva;
  - Linguagem;
  - Socializacao;
  - Coordenacao Motora;
  - Emocoes;
  - Alimentacao;
  - Agitacao;
  - Sono;
  - Expressao;
  - Movimento.
- Adicionar opcao de anexar imagem ou arquivo na anotacao.

### Perfil do aluno

- Adicionar barras de desenvolvimento.
- Adicionar dados individuais da crianca:
  - foto opcional;
  - idade em anos e meses;
  - data de nascimento;
  - observacoes gerais;
  - tags de apoio.
- Areas iniciais:
  - Linguagem;
  - Socializacao;
  - Coordenacao Motora;
  - Autonomia.

### Timeline da crianca

- Criar timeline vertical cronologica.
- Registrar evolucoes, atividades, fotos, emocoes, alimentacao, socializacao, desenvolvimento e marcos especiais.
- Permitir que a professora cadastre novos eventos diretamente no perfil da crianca.
- Permitir tags rapidas e anexo opcional no evento da timeline.
- Tratar a timeline como memoria afetiva e pedagogica individual.
- Nunca comparar com outras criancas.

### Calendario

- Implementar calendario pedagogico funcional visualmente.
- Nao implementar geracao automatica de atividades por datas comemorativas nesta etapa.

### Material de apoio

- Expandir tela de Material de Apoio.
- Adicionar busca.
- Adicionar categorias mais completas:
  - Plano de Aula;
  - Lista de Chamada;
  - Relatorios;
  - Portfolio;
  - Atividades;
  - Avaliacao;
  - Comunicados;
  - Aluno Atipico;
  - Musicalizacao;
  - Artes Visuais;
  - Reuniao de Pais;
  - Imagens e Recursos.
- Depois, conectar esta tela aos materiais publicados pelo Super Admin.

### Comunidade

- Criar funcionalidade de Comunidade com feed de postagens.
- Permitir que professoras publiquem relatos, duvidas, ideias e materiais.
- A funcionalidade deve ser controlada pelo Super Admin.
- O Super Admin deve poder liberar para todas as contas ou apenas para algumas professoras.
- Depois que estiver validada, pode ficar oculta para a base geral e disponivel apenas para professoras selecionadas.

### Turmas e alunos

- Criar turma pelo app.
- Editar dados da turma pelo app.
- Criar crianca dentro da turma.
- Editar dados individuais da crianca pelo app.
- Adicionar filtros de alunos dentro da turma:
  - Todos;
  - Atipicos;
  - Com relatorio.
- Manter busca de aluno.
- Persistencia real de criacao/edicao fica para a etapa de Supabase.

## Nao entra agora

### Datas comemorativas com geracao de atividades

- Nao implementar nesta etapa.
- O calendario pode exibir datas visualmente, mas nao deve gerar atividade automaticamente por data comemorativa.

### Conquistas, XP e selos

- Ocultar a aba/tela de conquistas por enquanto.
- Nao implementar XP, niveis, categorias de selos ou modal de selo agora.
- Registrar para fase futura.

## Observacoes de privacidade

- Anexos em anotacoes podem conter dados sensiveis e fotos de criancas.
- Fotos de criancas devem ir para bucket privado quando Supabase estiver conectado.
- O app nao deve cachear fotos de criancas agressivamente no service worker.
- IA nao deve receber imagem de crianca sem consentimento explicito.
- O Approf nunca deve comparar criancas entre si. Cada crianca tem uma jornada unica.
