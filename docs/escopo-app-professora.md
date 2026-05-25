# Escopo Confirmado do App da Professora

Atualizado em: 2026-05-13

Este documento registra as funcionalidades confirmadas a partir da analise do prototipo `approf-v3.html`.

## Publico e faixa etaria

O app e voltado para professoras da educação infantil que acompanham crianças de 0 a 5 anos.

Todos os exemplos, relatórios, atividades, materiais e prompts de IA devem respeitar essa faixa etaria.

## Diretriz obrigatoria para IA

A IA Pedagógica do Approf deve gerar documentos com linhagem pedagógica clara. Ela deve seguir a BNCC para Educação Infantil de 0 a 5 anos e usar linguagem profissional, acolhedora, descritiva e nao classificatoria.

Referencia interna registrada: `docs/ia-bncc-inclusao.md`.

Regras permanentes:

- prompts de Claude e ChatGPT/OpenAI devem ser versionados;
- chamadas de IA devem passar por backend/API, nunca direto pelo frontend;
- o system prompt deve orientar BNCC, campos de experiencia, faixa etaria e limites eticos;
- a IA não pode diagnosticar, comparar crianças, rotular negativamente ou produzir linguagem clínica sem base;
- os documentos devem ser revisados pela professora antes de uso externo;
- cada geração deve registrar modelo, prompt_version, tipo de documento e dados usados.

## Entra na implementacao agora

### IA Pedagógica

- Criar IA Pedagógica como central propria no app.
- Ter tela dedicada para geração de documentos.
- Todo relatório deve ter uma etapa antes da geração para a professora incluir contexto adicional.
- Antes de gerar, permitir orientacao livre para a IA seguir um caminho diferente.
- Antes de gerar, permitir anexar imagem, documento ou evidencia complementar.
- Incluir multiplos tipos de geração:
  - Relatório de desenvolvimento;
  - Diario de bordo;
  - Portfólio pedagogico;
  - Planejamento unificado, com escolhá interna de periodo anual, semestral, mensal, quinzenal, semanal ou plano de aula diario;
  - Encaminhamento para especialista.
- Incluir documentacao complementar:
  - Projeto pedagogico especifico;
  - Fichá de anamnese;
  - Registro de reunião de pais.
- Todos os cards visiveis da IA Pedagógica devem abrir um fluxo funcional para visualizacao:
  - documentos de relatório usam o fluxo de relatório com escolhá da criança, uso de anotações ou criacao do zero, contexto adicional e anexos;
  - planejamento usa gerador pedagogico visual com turma, faixa etaria, tema, multiplos campos BNCC, orientacao extra, anexos e preview.
- Relatório Atipico deve permitir escolher a criança e decidir se a IA usara anotações existentes ou um texto totalmente novo da professora.
- Quando usar anotações, a professora deve poder selecionar todas, apenas algumas ou informar o que deve ser desconsiderado.
- Relatório de desenvolvimento substitui Relatório Individual e Parecer Descritivo, pois cumprem o mesmo papel no MVP.
- Planejamento tambem pode nascer das anotações e ideias registradas diariamente pela professora.
- Exibir relatórios pendentes sugeridos pela IA na home.

### Home

- Adicionar sugestoes inteligentes na home.
- Exibir relatórios pendentes sugeridos pela IA.
- Manter quadro-negro e notas do quadro.

### Anotações

- Implementar sistema de `@` para vincular anotações a multiplos destinos.
- Permitir vincular uma anotação a aluno, turma, escola ou contexto geral.
- Adicionar tags rapidas de observacao:
  - Evolução positiva;
  - Linguagem;
  - Socializacao;
  - Coordenacao Motora;
  - Emocoes;
  - Alimentacao;
  - Agitacao;
  - Sono;
  - Expressao;
  - Movimento.
- Adicionar opcao de anexar imagem ou arquivo na anotação.

### Perfil do aluno

- Adicionar barras de desenvolvimento.
- Adicionar dados individuais da criança:
  - foto opcional;
  - idade em anos e meses;
  - data de nascimento;
  - observações gerais;
  - tags de apoio.
- Areas iniciais:
  - Linguagem;
  - Socializacao;
  - Coordenacao Motora;
  - Autonomia.

### Timeline da criança

- Criar timeline vertical cronologica.
- Registrar evolucoes, atividades, fotos, emocoes, alimentacao, socializacao, desenvolvimento e marcos especiais.
- Permitir que a professora cadastre novos eventos diretamente no perfil da criança.
- Permitir tags rapidas e anexo opcional no evento da timeline.
- Tratar a timeline como memoria afetiva e pedagógica individual.
- Nunca comparar com outras crianças.

### Calendario

- Implementar calendario pedagogico funcional visualmente.
- Nao implementar geração automatica de atividades por datas comemorativas nesta etapa.

### Material de apoio

- Expandir tela de Material de Apoio.
- Adicionar busca.
- Adicionar categorias mais completas:
  - Plano de Aula;
  - Lista de Chamada;
  - Relatórios;
  - Portfólio;
  - Atividades;
  - Avaliação;
  - Comunicados;
  - Aluno Atipico;
  - Musicalizacao;
  - Artes Visuais;
  - Reunião de Pais;
  - Imagens e Recursos.
- Depois, conectar esta tela aos materiais publicados pelo Super Admin.

### Comunidade

- Criar funcionalidade de Comunidade com feed de postagens.
- Permitir que professoras publiquem relatos, duvidas, ideias e materiais.
- A funcionalidade deve ser controlada pelo Super Admin.
- O Super Admin deve poder liberar para todas as contas ou apenas para algumas professoras.
- Depois que estiver válidada, pode ficar oculta para a base geral e disponível apenas para professoras selecionadas.

### Turmas e alunos

- Criar turma pelo app.
- Editar dados da turma pelo app.
- Criar criança dentro da turma.
- Editar dados individuais da criança pelo app.
- Adicionar filtros de alunos dentro da turma:
  - Todos;
  - Atipicos;
  - Com relatório.
- Manter busca de aluno.
- Persistencia real de criacao/edicao fica para a etapa de Supabase.

## Nao entra agora

### Datas comemorativas com geração de atividades

- Nao implementar nesta etapa.
- O calendario pode exibir datas visualmente, mas não deve gerar atividade automaticamente por data comemorativa.

### Conquistas, XP e selos

- Ocultar a aba/tela de conquistas por enquanto.
- Nao implementar XP, niveis, categorias de selos ou modal de selo agora.
- Registrar para fase futura.

## Observações de privacidade

- Anexos em anotações podem conter dados sensíveis e fotos de crianças.
- Fotos de crianças devem ir para bucket privado quando Supabase estiver conectado.
- O app não deve cachear fotos de crianças agressivamente no service worker.
- IA não deve receber imagem de criança sem consentimento explicito.
- O Approf nunca deve comparar crianças entre si. Cada criança tem uma jornada unica.
