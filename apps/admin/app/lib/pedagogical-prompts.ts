import type { AiGenerationType } from './ai-usage'

import { FORBIDDEN_PEDAGOGICAL_WORDS } from '@approf/types'

export interface BuildPromptInput {
  generationType: AiGenerationType
  promptVersion: string
  reportKind?: string
  docKind?: string
  studentName?: string
  className?: string
  ageGroup?: string
  evaluationPeriod?: string
  mode?: string
  historyScope?: 'model' | 'student'
  selectedAnnotations?: Array<{ date?: string; label?: string; text?: string }>
  ignoredNotes?: string
  blankContext?: string
  extraContext?: string
  objective?: string
  theme?: string
  diaryDate?: string
  diaryTheme?: string
  diaryRawText?: string
  bnccFields?: string[]
  useAnnotations?: boolean
  attachments?: Array<{ name?: string; type?: string; size?: number }>
  interventionMode?: 'suggestions' | 'feedback_analysis'
  observation?: string
  studentAge?: string
  interventionChosen?: Record<string, unknown>
  teacherReturn?: string
  returnChoice?: string
}

export interface PedagogicalPrompt {
  system: string
  user: string
}

/** Sufixo de versão por etapa do pipeline (registro em auditoria). */
export function pipelineStagePromptVersion(baseVersion: string, stage: 1 | 2 | 3): string {
  const suffix = stage === 1 ? 's1-draft' : stage === 2 ? 's2-bncc' : 's3-refine'
  return `${baseVersion}-${suffix}`
}

/**
 * Etapa 1: rascunho pedagógico â€” organiza contexto, anotações e estrutura do documento.
 */
export function buildStage1DraftPrompt(input: BuildPromptInput): PedagogicalPrompt {
  const kind = input.reportKind || input.docKind || mapGenerationType(input.generationType)
  const pv = pipelineStagePromptVersion(input.promptVersion, 1)
  const documentGuidelines = buildDocumentPromptGuidelines(input)
  if (isInterventionMode(input, 'suggestions')) {
    return buildInterventionSuggestionsPrompt(input, pv, 1)
  }
  if (isInterventionMode(input, 'feedback_analysis')) {
    return buildInterventionFeedbackPrompt(input, pv, 1)
  }

  const system = [
    `Você executa a ETAPA 1 (rascunho pedagógico) do pipeline textual do Approf (${pv}).`,
    'Produza um RASCUNHO em portugues brasileiro para Educação Infantil (0 a 5 anos), alinhado a BNCC.',
    'Priorize texto util para o dia a dia escolar: claro, objetivo, profissional e natural.',
    'Evite tom academico excessivo, introducoes longas, repeticoes e paragrafos extensos.',
    'Mantenha estrutura organizada com secoes curtas e foco pratico.',
    'Organize o contexto recebido em secoes logicas com titulos claros.',
    'Use linguagem descritiva e acolhedora; evite linguagem julgadora ou rótulos para a criança.',
    'Nunca compare crianças entre si.',
    'Nunca realize diagnostico medico, clinico ou psicologico.',
    'Não invente fatos: use apenas o contexto fornecido.',
    `Evite em todos os documentos estas expressoes: ${FORBIDDEN_PEDAGOGICAL_WORDS.join(', ')}.`,
    'Transforme as informações da professora: preserve detalhes relevantes, organize melhor, corrija a escrita e humanize sem apagar o que foi informado.',
    ...documentGuidelines.system,
    'A saida desta etapa e um rascunho que sera revisado nas etapas seguintes; não precisa estar perfeita, mas deve ser completa e estruturada.',
  ].join('\n')

  const user = buildContextUserBlock(kind, input)

  return { system, user }
}

/**
 * Etapa 2: revisão BNCC e segurança pedagógica â€” coerência, campos de experiência, segurança textual.
 */
export function buildStage2BnccReviewPrompt(input: BuildPromptInput, draftFromStage1: string): PedagogicalPrompt {
  const kind = input.reportKind || input.docKind || mapGenerationType(input.generationType)
  const pv = pipelineStagePromptVersion(input.promptVersion, 2)
  const documentGuidelines = buildDocumentPromptGuidelines(input)
  if (isInterventionMode(input, 'suggestions')) {
    return buildInterventionSuggestionsPrompt(input, pv, 2, draftFromStage1)
  }
  if (isInterventionMode(input, 'feedback_analysis')) {
    return buildInterventionFeedbackPrompt(input, pv, 2, draftFromStage1)
  }

  const system = [
    `Você executa a ETAPA 2 (revisão BNCC e segurança pedagógica) do pipeline textual do Approf (${pv}).`,
    'Você recebe um RASCUNHO da etapa anterior. Revise e reescreva o texto completo.',
    'Revise a BNCC apenas quando o tipo de documento pedir; não force códigos, teoria ou citações longas.',
    'Mantenha formato profissional, leitura leve e objetiva, sem linguagem academica exagerada.',
    'Remova ou neutralize qualquer comparacao entre crianças, diagnostico ou conclusao clinica, e linguagem julgadora.',
    'Mantenha apenas observacoes pedagogicas e descritivas.',
    'Preserve fatos e intencoes do rascunho; não invente novos fatos.',
    `Remova linguagem artificial ou bacharelesca, especialmente: ${FORBIDDEN_PEDAGOGICAL_WORDS.join(', ')}.`,
    ...documentGuidelines.system,
    'Responda APENAS com o texto final revisado (sem prefacio, sem comentarios meta, sem markdown de explicacao).',
  ].join('\n')

  const user = [
    `TIPO DE DOCUMENTO: ${kind}`,
    `TIPO DE GERACAO: ${input.generationType}`,
    `CRIANÇA: ${input.studentName ?? 'Não informado'}`,
    `TURMA: ${input.className ?? 'Não informado'}`,
    '',
    'RASCUNHO DA ETAPA 1 (revise integralmente o texto abaixo):',
    '',
    draftFromStage1.trim(),
  ].join('\n')

  return { system, user }
}

/**
 * Etapa 3: refinamento final e humanização â€” fluidez, personalização, tom humano, pronto para uso.
 */
export function buildStage3FinalRefinementPrompt(input: BuildPromptInput, textFromStage2: string): PedagogicalPrompt {
  const kind = input.reportKind || input.docKind || mapGenerationType(input.generationType)
  const pv = pipelineStagePromptVersion(input.promptVersion, 3)
  const documentGuidelines = buildDocumentPromptGuidelines(input)
  if (isInterventionMode(input, 'suggestions')) {
    return buildInterventionSuggestionsPrompt(input, pv, 3, textFromStage2)
  }
  if (isInterventionMode(input, 'feedback_analysis')) {
    return buildInterventionFeedbackPrompt(input, pv, 3, textFromStage2)
  }

  const system = [
    `Você executa a ETAPA 3 (refinamento final e humanização) do pipeline textual do Approf (${pv}).`,
    'Você recebe um texto já revisado pedagogicamente. Melhore fluidez, clareza e tom humano e acolhedor.',
    'Personalize levemente quando fizer sentido (sem inventar dados) para leitura pela professora e familias.',
    'Mantenha todas as regras: Educação Infantil 0-5 anos, BNCC, sem diagnostico clinico, sem comparacao entre crianças, sem linguagem julgadora.',
    `Se aparecer alguma destas expressoes, substitua por linguagem natural: ${FORBIDDEN_PEDAGOGICAL_WORDS.join(', ')}.`,
    'Entregue em formato final curto e pratico: secoes claras, paragrafos curtos e linguagem natural.',
    ...documentGuidelines.system,
    'A professora podera editar depois: o texto deve estar pronto para uso e sem tom robotizado.',
    'Responda APENAS com o texto final (sem prefacio, sem comentarios meta).',
  ].join('\n')

  const user = [
    `TIPO DE DOCUMENTO: ${kind}`,
    `CRIANÇA: ${input.studentName ?? 'Não informado'}`,
    `TURMA: ${input.className ?? 'Não informado'}`,
    '',
    'TEXTO DA ETAPA 2 (refine e humanize integralmente):',
    '',
    textFromStage2.trim(),
  ].join('\n')

  return { system, user }
}

/**
 * @deprecated Preferir buildStage1DraftPrompt no pipeline em cascata.
 * Mantido para compatibilidade com imports antigos.
 */
export function buildPedagogicalPrompt(input: BuildPromptInput): PedagogicalPrompt {
  return buildStage1DraftPrompt(input)
}

function buildContextUserBlock(kind: string, input: BuildPromptInput): string {
  const bncc = input.bnccFields?.length ? input.bnccFields.join(', ') : 'Não informado'
  const attachments = formatAttachments(input.attachments)
  const selectedAnnotations = formatAnnotations(input.selectedAnnotations)
  const requiredStructure = buildRequiredStructureInstructions(input)
  const documentGuidelines = buildDocumentPromptGuidelines(input)

  return [
    `TIPO DE DOCUMENTO: ${kind}`,
    `TIPO DE GERACAO: ${input.generationType}`,
    `CRIANÇA: ${input.studentName ?? 'Não informado'}`,
    `TURMA: ${input.className ?? 'Não informado'}`,
    `FAIXA ETÁRIA: ${input.ageGroup ?? 'Não informado'}`,
    `PERÍODO DE AVALIAÇÃO: ${input.evaluationPeriod ?? 'Não informado'}`,
    `MODO: ${input.mode ?? 'Não informado'}`,
    `ESCOPO DE HISTÓRICO: ${input.historyScope === 'student' ? 'desta criança' : 'deste modelo'}`,
    `CAMPOS BNCC: ${bncc}`,
    `TEMA: ${input.theme?.trim() || 'Não informado'}`,
    `DATA DO DIÁRIO: ${input.diaryDate?.trim() || 'Não informado'}`,
    `TEMA DO DIÁRIO: ${input.diaryTheme?.trim() || 'Não informado'}`,
    `OBJETIVO: ${input.objective?.trim() || 'Não informado'}`,
    `USAR ANOTACOES: ${input.useAnnotations === false ? 'não' : 'sim'}`,
    '',
    'ANOTACOES SELECIONADAS:',
    selectedAnnotations || '- Nenhuma anotação enviada.',
    '',
    'INFORMAÇÕES PARA DESCONSIDERAR:',
    input.ignoredNotes?.trim() || '- Nenhuma informação.',
    '',
    'CONTEXTO LIVRE (QUANDO GERADO DO ZERO):',
    input.blankContext?.trim() || '- Não informado.',
    '',
    'ANOTAÇÃO BRUTA DA PROFESSORA (quando for Diário de Bordo):',
    input.diaryRawText?.trim() || '- Não informado.',
    '',
    'ORIENTAÇÃO EXTRA DA PROFESSORA:',
    input.extraContext?.trim() || '- Não informado.',
    '',
    'ANEXOS AUTORIZADOS COMO REFERÃŠNCIA (apenas nomes/metadados; não analise o conteúdo binário):',
    attachments || '- Nenhum anexo enviado.',
    '',
    'INSTRUCOES DE FORMATO DO RASCUNHO:',
    '- Entregue texto pratico e diretamente utilizavel no dia a dia escolar.',
    '- Estruture em secoes com titulos claros.',
    '- Use paragrafos curtos, linguagem natural e objetiva, sem excesso de teoria.',
    '- Evite repeticoes, floreios e texto longo sem necessidade.',
    '- Inclua apenas informações pedagogicamente úteis para professora, escola e família.',
    ...documentGuidelines.user.map((item) => `- ${item}`),
    ...(requiredStructure.length
      ? [
          '',
          'ESTRUTURA OBRIGATORIA PARA ESTE TIPO DE DOCUMENTO:',
          ...requiredStructure.map((item) => `- ${item}`),
        ]
      : []),
  ].join('\n')
}

function buildDocumentPromptGuidelines(input: BuildPromptInput) {
  const type = input.generationType
  const system: string[] = []
  const user: string[] = []

  if (type === 'class_diary') {
    system.push(
      'Este documento é um diário de bordo coletivo: não transforme em relatório individual.',
      'Não mencione BNCC no texto final. Use 1 a 3 parágrafos curtos, sem títulos acadêmicos.',
      'Tom: professora experiente registrando a rotina do dia com leveza, objetividade e humanidade.',
    )
    user.push('Tamanho final: 1 a 3 parágrafos, sem lista longa e sem linguagem acadêmica.')
  } else if (type === 'development_report' || type === 'general_report') {
    system.push(
      'Este relatório é individual, médio e empático. Valorize avanços, interesses, participação e pontos de continuidade.',
      'A introdução deve mencionar naturalmente que o relatório considera BNCC, PPP e Currículo da Cidade.',
      'A BNCC pode aparecer de modo contextual e discreto, nunca como bloco dominante ou lista teórica.',
      'Evite conclusões fechadas; prefira observou-se, percebe-se, vem demonstrando, segue em acompanhamento.',
    )
    user.push('Tamanho final: relatório médio, com seções curtas e linguagem compreensível para escola e família.')
  } else if (type === 'weekly_planning') {
    system.push(
      'Este documento é um planejamento semanal prático, escaneável e aplicável na rotina.',
      'Use BNCC de forma objetiva nos campos/intencionalidades, sem texto teórico longo.',
      'Organize por dias ou blocos da semana, com objetivos, propostas, materiais e observação.',
    )
    user.push('Tamanho final: planejamento de leitura rápida, com listas úteis e sem parágrafos extensos.')
  } else if (type === 'daily_lesson_plan') {
    system.push(
      'Este documento é um plano de aula diário, direto e operacional.',
      'Priorize objetivo, tempo, materiais, desenvolvimento, adaptação e observação.',
      'Use BNCC apenas como referência pedagógica breve, sem dominar o documento.',
    )
    user.push('Tamanho final: curto a médio, pronto para a professora aplicar no dia.')
  } else if (type === 'pedagogical_project') {
    system.push(
      'Este documento é um projeto pedagógico específico, com estrutura própria e linguagem institucional simples.',
      'Inclua justificativa, objetivos, etapas, propostas, registros, culminância opcional e avaliação processual.',
      'Use BNCC como sustentação pedagógica contextual, sem parecer artigo acadêmico.',
    )
    user.push('Tamanho final: estruturado, objetivo e completo o suficiente para apresentar à coordenação.')
  } else if (type === 'specialist_referral' || type === 'specialist_report') {
    system.push(
      'Este documento é um encaminhamento para especialista: formal, objetivo e sem diagnóstico.',
      'Use apenas comportamentos observáveis, frequência/contexto quando informado e estratégias já tentadas.',
      'Não use termos clínicos como suspeita, transtorno, laudo, déficit, TEA, TDAH ou diagnóstico.',
      'BNCC não deve aparecer como seção central; o foco é registro escolar observável.',
    )
    user.push('Tamanho final: formal e objetivo, sem afirmar causa, hipótese clínica ou diagnóstico.')
  } else if (type === 'parents_meeting_record') {
    system.push(
      'Este documento é um planejamento de reunião de pais: acolhedor, objetivo e prático para conduzir a reunião.',
      'Não use BNCC nem linguagem acadêmica. Organize abertura, pauta, informações gerais da turma, combinados e encerramento.',
      'Não cite nomes de crianças. Fale da turma como grupo e preserve dados sensíveis.',
    )
    user.push('Tamanho final: curto, com roteiro de reunião, tempos estimados e espaço para anotações.')
  } else if (type === 'portfolio_text') {
    system.push(
      'Este documento é portfólio textual: narrativa pedagógica com evidências, memória de percurso e tom afetivo-profissional.',
      'Valorize produções, falas, brincadeiras, descobertas e avanços sem transformar em relatório clínico.',
      'BNCC pode aparecer de forma discreta, conectada às experiências observadas.',
    )
    user.push('Tamanho final: narrativa média, com evidências e linguagem sensível, sem exagero acadêmico.')
  }

  return { system, user }
}

function formatAnnotations(annotations?: Array<{ date?: string; label?: string; text?: string }>) {
  if (!annotations?.length) return ''
  return annotations
    .slice(0, 40)
    .map((annotation) => {
      const date = annotation.date ?? 'Sem data'
      const label = annotation.label ?? 'Registro'
      const text = annotation.text?.trim() || 'Sem conteudo'
      return `- ${date} | ${label}: ${text}`
    })
    .join('\n')
}

function formatAttachments(attachments?: Array<{ name?: string; type?: string; size?: number }>) {
  if (!attachments?.length) return ''
  return attachments
    .slice(0, 20)
    .map((attachment) => {
      const name = attachment.name ?? 'arquivo'
      const type = attachment.type ?? 'application/octet-stream'
      const size = typeof attachment.size === 'number' ? `${attachment.size} bytes` : 'tamanho desconhecido'
      return `- ${name} (${type}, ${size})`
    })
    .join('\n')
}

function mapGenerationType(generationType: AiGenerationType) {
  switch (generationType) {
    case 'development_report':
      return 'Relatório de desenvolvimento'
    case 'class_diary':
      return 'Diário de bordo'
    case 'weekly_planning':
      return 'Planejamento semanal'
    case 'daily_lesson_plan':
      return 'Plano de aula diário'
    case 'pedagogical_project':
      return 'Projeto pedagógico específico'
    case 'specialist_referral':
      return 'Encaminhamento para especialista'
    case 'parents_meeting_record':
      return 'Planejamento de reunião de pais'
    case 'planning':
      return 'Planejamento pedagógico'
    case 'portfolio_text':
      return 'Portfólio pedagógico (texto)'
    case 'specialist_report':
      return 'Relatório pedagógico para especialista'
    case 'general_report':
      return 'Relatório pedagógico'
    default:
      return 'Documento pedagógico'
  }
}

function buildRequiredStructureInstructions(input: BuildPromptInput) {
  const normalizedKind = normalize(input.reportKind ?? input.docKind ?? '')

  if (normalizedKind.includes('diario de bordo')) {
    return [
      'Documento coletivo da turma (não transformar em relatório individual)',
      'Registrar rotina, experiências e participação coletiva do dia',
      'Citar criança específica apenas quando realmente necessário',
      'Saída final com 1 a 3 parágrafos curtos e leitura leve',
    ]
  }

  if (
    input.generationType === 'planning'
    || input.generationType === 'weekly_planning'
    || input.generationType === 'daily_lesson_plan'
  ) {
    return [
      'Tema',
      'Objetivo',
      'Atividade/Desenvolvimento',
      'Materiais necessários',
      'Duração estimada',
      'Observações de acompanhamento',
    ]
  }

  if (input.generationType === 'development_report' || input.generationType === 'general_report') {
    return [
      'Informações básicas (criança, faixa etária BNCC, turma, período)',
      'Descrição geral e adaptação',
      'Desenvolvimento nos Campos de Experiencia da BNCC',
      'Conquistas e pontos de atenção em linguagem construtiva',
      'Observações finais',
    ]
  }

  if (input.generationType === 'pedagogical_project') {
    return [
      'Justificativa',
      'Objetivos do projeto',
      'Etapas de desenvolvimento',
      'Avaliação e acompanhamento',
    ]
  }

  if (input.generationType === 'specialist_referral' || input.generationType === 'specialist_report') {
    return [
      'Motivo do encaminhamento',
      'Comportamentos observáveis na rotina',
      'Estratégias pedagógicas já aplicadas',
      'Solicitação de avaliação externa',
    ]
  }

  if (input.generationType === 'parents_meeting_record') {
    return [
      'Abertura acolhedora',
      'Pauta da reunião com tempos estimados',
      'Informações gerais da turma sem citar nomes de crianças',
      'Combinados gerais com as famílias',
      'Espaço para anotações',
      'Encerramento',
    ]
  }

  return []
}

function isInterventionMode(input: BuildPromptInput, mode: BuildPromptInput['interventionMode']) {
  return input.generationType === 'other' && input.interventionMode === mode
}

function buildInterventionSuggestionsPrompt(
  input: BuildPromptInput,
  promptVersion: string,
  stage: 1 | 2 | 3,
  previous?: string,
): PedagogicalPrompt {
  const baseSystem = [
    `Você executa a etapa ${stage} do fluxo de Intervenções do Approf (${promptVersion}).`,
    'Você é um assistente pedagógico especializado em educação infantil.',
    'Suas sugestões devem estar alinhadas a BNCC para Educação Infantil e aos direitos de aprendizagem.',
    'Você NÃƒO pode diagnosticar, citar transtornos, usar linguagem clínica ou emitir laudos.',
    'Use linguagem acolhedora, prática, pedagógica, simples e profissional.',
    'Nunca use termos: problema, transtorno, diagnostico, falhou, deficit.',
    'Use termos: observou-se, recomenda-se, sugere-se, houve avanço, continuidade do acompanhamento.',
    'Responda APENAS em JSON válido.',
    'Formato JSON obrigatório: {"suggestions":[{"title":"...","summary":"...","objective":"...","howToApply":"...","whatToObserve":"...","recordText":"..."}]}',
    'Gere entre 3 e 5 alternativas pedagógicas.',
  ].join('\n')

  const initialUser = [
    'Você é um assistente pedagógico especializado em educação infantil.',
    '',
    'Sua função é ajudar professoras a pensarem em intervenções pedagógicas a partir de observações feitas sobre crianças durante a rotina escolar.',
    '',
    'Você NÃƒO pode:',
    '- fazer diagnósticos',
    '- citar transtornos',
    '- usar linguagem clínica',
    '- emitir laudos',
    '',
    'Sua resposta deve ser:',
    '- acolhedora',
    '- prática',
    '- pedagógica',
    '- simples',
    '- profissional',
    '',
    `Dados:`,
    `Aluno: ${input.studentName ?? 'Não informado'}`,
    `Idade: ${input.studentAge ?? 'Não informado'}`,
    'Observação da professora:',
    input.observation?.trim() || 'Não informado',
    '',
    'Gere de 3 a 5 alternativas de intervenção pedagógica.',
    '',
    'Para cada alternativa inclua:',
    '1. Título da intervenção',
    '2. Objetivo pedagógico',
    '3. Como aplicar',
    '4. O que observar na resposta da criança',
    '5. Texto curto para registro pedagógico.',
  ].join('\n')

  if (!previous) return { system: baseSystem, user: initialUser }

  return {
    system: baseSystem,
    user: [
      'Revise e refine a proposta anterior mantendo todas as regras.',
      'Retorne apenas JSON válido no formato solicitado.',
      '',
      previous.trim(),
    ].join('\n'),
  }
}

function buildInterventionFeedbackPrompt(
  input: BuildPromptInput,
  promptVersion: string,
  stage: 1 | 2 | 3,
  previous?: string,
): PedagogicalPrompt {
  const baseSystem = [
    `Você executa a etapa ${stage} do fluxo de Análise de Retorno de Intervenções (${promptVersion}).`,
    'Você é um assistente pedagógico especializado em educação infantil.',
    'Sua analise deve permanecer alinhada a BNCC para Educação Infantil e ao acompanhamento pedagógico continuo.',
    'Você NÃƒO pode diagnosticar, sugerir transtornos, usar linguagem médica ou emitir parecer clínico.',
    'Use linguagem prática, pedagógica, acolhedora, profissional e simples.',
    'Responda APENAS em JSON válido.',
    'Formato JSON obrigatório:',
    '{"analysisText":"...","evolutionRecord":"...","recommendedSuggestions":[{"title":"...","summary":"...","objective":"...","howToApply":"...","whatToObserve":"...","recordText":"..."}]}',
    'Quando houver avanço, recommendedSuggestions pode ser vazio.',
    'Quando não houver avanço completo, gere de 2 a 4 alternativas em recommendedSuggestions.',
  ].join('\n')

  const initialUser = [
    'Você é um assistente pedagógico especializado em educação infantil.',
    '',
    'Analise o retorno da professora após uma intervenção pedagógica aplicada.',
    '',
    'Você NÃƒO pode:',
    '- diagnosticar',
    '- sugerir transtornos',
    '- usar linguagem médica',
    '- emitir parecer clínico',
    '',
    `Dados:`,
    `Aluno: ${input.studentName ?? 'Não informado'}`,
    'Observação inicial:',
    input.observation?.trim() || 'Não informado',
    '',
    'Intervenção aplicada:',
    JSON.stringify(input.interventionChosen ?? {}, null, 2),
    '',
    'Retorno da professora:',
    input.teacherReturn?.trim() || 'Não informado',
    '',
    'Status informado:',
    input.returnChoice ?? 'não informado',
    '',
    'Se houve avanço:',
    '- gere um texto de evolução pedagógica',
    '- sugira continuidade',
    '',
    'Se houve avanço parcial:',
    '- registre a evolução parcial',
    '- sugira adaptações',
    '',
    'Se ainda necessita acompanhamento:',
    '- sugira novas estratégias pedagógicas',
    '- mantenha linguagem acolhedora',
    '- recomende continuidade do acompanhamento pedagógico',
    '',
    'A resposta deve ser:',
    '- prática',
    '- pedagógica',
    '- profissional',
    '- simples',
    '- pronta para salvar no histórico.',
  ].join('\n')

  if (!previous) return { system: baseSystem, user: initialUser }

  return {
    system: baseSystem,
    user: [
      'Refine a analise anterior preservando regras e objetividade.',
      'Retorne apenas JSON valido no formato solicitado.',
      '',
      previous.trim(),
    ].join('\n'),
  }
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
