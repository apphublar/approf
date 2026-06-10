import type { AiGenerationType } from './ai-usage'

import { FORBIDDEN_PEDAGOGICAL_WORDS } from '@approf/types'

export interface BuildPromptInput {
  generationType: AiGenerationType
  promptVersion: string
  unifiedCreator?: boolean
  documentTitle?: string
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
  planningPeriod?: string
  intentionality?: string[]
  resources?: string
  duration?: string
  justification?: string
  methodology?: string
  assessment?: string[]
  finalConsiderations?: string
  selectedMilestones?: Array<{ date?: string; label?: string; text?: string }>
  includeDayAnnotations?: boolean
  meetingDate?: string
  meetingDuration?: string
  meetingAgenda?: string
  theme?: string
  diaryDate?: string
  diaryTheme?: string
  diaryRawText?: string
  bnccFields?: string[]
  useAnnotations?: boolean
  attachments?: Array<{ name?: string; type?: string; size?: number; hasImageInPortfolio?: boolean; extractedText?: string }>
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
    'Produza um RASCUNHO em português brasileiro para Educação Infantil (0 a 5 anos), alinhado a BNCC.',
    'Use ortografia, acentuação, concordância e pontuação corretas do português do Brasil. Não use português de Portugal.',
    'Priorize texto util para o dia a dia escolar: claro, objetivo, profissional e natural.',
    'Evite tom academico excessivo, introducoes longas, repeticoes e paragrafos extensos.',
    'Mantenha estrutura organizada com secoes curtas e foco pratico.',
    'Organize o contexto recebido em secoes logicas com títulos claros.',
    'Use linguagem descritiva e acolhedora; evite linguagem julgadora ou rótulos para a criança.',
    'Nunca compare crianças entre si.',
    'Nunca realize diagnóstico medico, clinico ou psicologico.',
    'Não invente fatos: use apenas o contexto fornecido.',
    `Evite em todos os documentos estas expressoes: ${FORBIDDEN_PEDAGOGICAL_WORDS.join(', ')}.`,
    'FIDELIDADE OBRIGATÓRIA: preserve exatamente os detalhes fornecidos pela professora — nomes de crianças, situações específicas, datas, conquistas e fatos relatados. Nunca generalize uma situação específica (ex: se a professora escreveu "Pedro caiu no parque", não escreva "uma criança apresentou dificuldade"). Nunca omita informação específica para transformá-la em afirmação genérica.',
    'INSTRUÇÕES DA PROFESSORA TÊM PRIORIDADE ABSOLUTA: o campo "INSTRUÇÕES FINAIS DA PROFESSORA" deve ser seguido à risca, sem exceção. Se a professora pediu para destacar algo, destacar. Se pediu para omitir, omitir. Se deu um tom ou formato, usar.',
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
    'Faça revisão gramatical completa em português brasileiro: acentuação, concordância, regência, pontuação, grafia e fluidez.',
    'Revise a BNCC apenas quando o tipo de documento pedir; não force códigos, teoria ou citações longas.',
    'Mantenha formato profissional, leitura leve e objetiva, sem linguagem academica exagerada.',
    'Remova ou neutralize qualquer comparação entre crianças, diagnóstico ou conclusão clínica, e linguagem julgadora.',
    'Mantenha apenas observações pedagógicas e descritivas.',
    'Preserve fatos e intencoes do rascunho; não invente novos fatos.',
    `Remova linguagem artificial ou bacharelesca, especialmente: ${FORBIDDEN_PEDAGOGICAL_WORDS.join(', ')}.`,
    ...documentGuidelines.system,
    'Responda APENAS com o texto final revisado (sem prefácio, sem comentários meta, sem markdown de explicação).',
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
    'Você recebe um texto já revisado pedagógicamente. Melhore fluidez, clareza e tom humano e acolhedor.',
    'Entregue texto final impecável em português brasileiro, sem erros de ortografia, acentuação, concordância ou pontuação.',
    'Personalize levemente quando fizer sentido (sem inventar dados) para leitura pela professora e famílias.',
    'Mantenha todas as regras: Educação Infantil 0-5 anos, BNCC, sem diagnóstico clinico, sem comparação entre crianças, sem linguagem julgadora.',
    `Se aparecer alguma destas expressoes, substitua por linguagem natural: ${FORBIDDEN_PEDAGOGICAL_WORDS.join(', ')}.`,
    'Entregue em formato final curto e pratico: secoes claras, paragrafos curtos e linguagem natural.',
    ...documentGuidelines.system,
    'A professora podera editar depois: o texto deve estar pronto para uso e sem tom robotizado.',
    'Responda APENAS com o texto final (sem prefácio, sem comentários meta).',
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

function isFreeFormCreator(input: BuildPromptInput) {
  return input.unifiedCreator === true
    || input.promptVersion.startsWith('criador-livre')
    || input.promptVersion.startsWith('criador-pedagogico')
}

function buildContextUserBlock(kind: string, input: BuildPromptInput): string {
  const bncc = input.bnccFields?.length ? input.bnccFields.join(', ') : 'Não informado'
  const attachments = formatAttachments(input.attachments)
  const selectedAnnotations = formatAnnotations(input.selectedAnnotations)
  const requiredStructure = isFreeFormCreator(input) ? [] : buildRequiredStructureInstructions(input)
  const documentGuidelines = buildDocumentPromptGuidelines(input)
  const documentTitle = input.documentTitle?.trim() || kind

  return [
    `TITULO SOLICITADO PELA PROFESSORA: ${documentTitle}`,
    `TIPO DE DOCUMENTO: ${kind}`,
    `TIPO DE GERACAO: ${input.generationType}`,
    `CRIANÇA: ${input.studentName ?? 'Não informado'}`,
    `TURMA: ${input.className ?? 'Não informado'}`,
    `FAIXA ETÁRIA: ${input.ageGroup ?? 'Não informado'}`,
    `PERÍODO DE AVALIAÇÁO: ${input.evaluationPeriod ?? 'Não informado'}`,
    `MODO: ${input.mode ?? 'Não informado'}`,
    `ESCOPO DE HISTÓRICO: ${input.historyScope === 'student' ? 'desta criança' : 'deste modelo'}`,
    `CAMPOS BNCC: ${bncc}`,
    `TEMA: ${input.theme?.trim() || 'Não informado'}`,
    `ESCOLHA DIARIO/SEMANAL: ${input.planningPeriod?.trim() || 'Não informado'}`,
    `INTENCIONALIDADE / DIREITOS: ${input.intentionality?.join(', ') || 'Não informado'}`,
    `RECURSOS: ${input.resources?.trim() || 'Não informado'}`,
    `DURACAO DO PROJETO: ${input.duration?.trim() || 'Não informado'}`,
    `JUSTIFICATIVA DO PROJETO: ${input.justification?.trim() || 'Não informado'}`,
    `METODOLOGIA: ${input.methodology?.trim() || 'Não informado'}`,
    `AVALIAÇÁO / REGISTRO: ${input.assessment?.join(', ') || 'Não informado'}`,
    `CONSIDERACOES FINAIS: ${input.finalConsiderations?.trim() || 'Não informado'}`,
    `DATA DO DIÁRIO: ${input.diaryDate?.trim() || 'Não informado'}`,
    `TEMA DO DIÁRIO: ${input.diaryTheme?.trim() || 'Não informado'}`,
    `OBJETIVO: ${input.objective?.trim() || 'Não informado'}`,
    `PUXAR ANOTACOES DO DIARIO: ${input.includeDayAnnotations === false ? 'não' : 'sim'}`,
    `DATA DA REUNIAO: ${input.meetingDate?.trim() || 'Não informado'}`,
    `DURACAO DA REUNIAO: ${input.meetingDuration?.trim() || 'Não informado'}`,
    `PAUTA DA REUNIAO: ${input.meetingAgenda?.trim() || 'Não informado'}`,
    `USAR ANOTACOES: ${input.useAnnotations === false ? 'não' : 'sim'}`,
    '',
    'ANOTACOES SELECIONADAS:',
    selectedAnnotations || '- Nenhuma anotação enviada.',
    '',
    'MARCOS IMPORTANTES SELECIONADOS:',
    formatAnnotations(input.selectedMilestones) || '- Nenhum marco selecionado.',
    '',
    'INFORMAÇÕES PARA DESCONSIDERAR:',
    input.ignoredNotes?.trim() || '- Nenhuma informação.',
    '',
    'CONTEXTO LIVRE (QUANDO GERADO DO ZERO):',
    input.blankContext?.trim() || '- Não informado.',
    '',
    'ANOTAÇÁO BRUTA DA PROFESSORA (quando for Diário de Bordo):',
    input.diaryRawText?.trim() || '- Não informado.',
    '',
    'INSTRUÇÕES FINAIS DA PROFESSORA (prioridade máxima — seguir à risca, sem exceção):',
    input.extraContext?.trim() || '- Nenhuma instrução adicional.',
    '',
    'ANEXOS AUTORIZADOS COMO REFERÊNCIA (apenas nomes/metadados; não analise o conteúdo binário):',
    attachments || '- Nenhum anexo enviado.',
    '',
    'INSTRUCOES DE FORMATO DO RASCUNHO:',
    '- Entregue texto pratico e diretamente utilizavel no dia a dia escolar.',
    '- Estruture em secoes com títulos claros.',
    '- Use paragrafos curtos, linguagem natural e objetiva, sem excesso de teoria.',
    '- Evite repeticoes, floreios e texto longo sem necessidade.',
    '- Inclua apenas informações pedagógicamente úteis para professora, escola e família.',
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

  if (isFreeFormCreator(input)) {
    system.push(
      'A professora define livremente o tipo, estrutura, tom, extensão e conteúdo do documento.',
      'Não imponha modelos pré-definidos, seções fixas ou formatos padrão de relatório, planejamento ou portfólio.',
      'Siga o título e as instruções da professora com prioridade absoluta.',
      'Use anotações e anexos apenas como contexto autorizado — não invente fatos além deles.',
      'Mantenha português brasileiro correto, tom profissional e adequado à Educação Infantil.',
    )
    user.push('Organize o documento exatamente conforme pedido pela professora, sem adicionar seções não solicitadas.')
    return { system, user }
  }

  if (type === 'class_diary') {
    system.push(
      'Este documento é um diário de bordo coletivo: não transforme em relatório individual.',
      'Não mencione BNCC no texto final. Use 1 a 3 parágrafos curtos, sem títulos acadêmicos.',
      'Tom: professora experiente registrando a rotina do dia com leveza, objetividade e humanidade.',
    )
    user.push('Tamanho final: 1 a 3 parágrafos, sem lista longa e sem linguagem acadêmica.')
  } else if (type === 'development_report' || type === 'general_report') {
    system.push(
      'Este relatório é individual, médio e empático. Use somente informações reais fornecidas pela professora, anotações selecionadas, marcos selecionados, contexto livre e orientações adicionais.',
      'Não invente acontecimentos, falas, preferências, dificuldades, avanços, participação familiar ou características da criança. Se uma seção não tiver evidência suficiente, escreva que não há registros suficientes para afirmar aquele ponto.',
      'Não organize o relatório por campos de experiência da BNCC e não crie seção chamada Campos de experiência.',
      'A BNCC, PPP e Currículo da Cidade podem sustentar o olhar pedagógico, mas não devem aparecer como lista, bloco dominante ou eixo de organização.',
      'Organize obrigatoriamente por: Adaptação e convivência; Desenvolvimento da linguagem; Desenvolvimento motor; Desenvolvimento cognitivo e autonomia; Interesses e preferências; Participação da família; Considerações finais.',
      'Evite conclusões fechadas; prefira observou-se, percebe-se, vem demonstrando, segue em acompanhamento.',
    )
    user.push('Tamanho final: relatório médio, com as seções obrigatórias solicitadas, linguagem compreensível para escola e família, e sem separar por campos de experiência.')
  } else if (type === 'weekly_planning') {
    system.push(
      'Este documento é um planejamento semanal prático, escaneável e aplicável na rotina.',
      'Use BNCC de forma objetiva nos campos/intencionalidades, sem texto teórico longo.',
      'Organize por dias da semana (segunda, terça, quarta, quinta, sexta).',
      'OBRIGATÓRIO: cada dia da semana deve ter sua PRÓPRIA intencionalidade específica — nunca use um único objetivo geral para a semana inteira. Cada dia = intencionalidade distinta, proposta própria e materiais específicos.',
    )
    user.push('Tamanho final: planejamento de leitura rápida, com listas úteis e sem parágrafos extensos. Cada dia da semana deve ter sua própria intencionalidade, proposta e materiais — não use objetivo único semanal.')
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
      'Use apenas comportamentos observáveis, frequência/contexto quando informado e estrategias já tentadas.',
      'Não use termos clínicos como suspeita, transtorno, laudo, déficit, TEA, TDAH ou diagnóstico.',
      'BNCC não deve aparecer como seção central; o foco é registro escolar observável.',
    )
    user.push('Tamanho final: formal e objetivo, sem afirmar causa, hipótese clínica ou diagnóstico.')
  } else if (type === 'parents_meeting_record') {
    system.push(
      'Este documento é um planejamento de reunião de pais: acolhedor, objetivo e prático para conduzir a reunião.',
      'Não use BNCC nem linguagem acadêmica. Foque na PAUTA DA REUNIÃO como eixo central do documento.',
      'Não cite nomes de crianças. Fale da turma como grupo e preserve dados sensíveis.',
      'Estruture o documento em: Pauta da reunião (principal) e Observações/encaminhamentos. Não crie seções longas de abertura, informações gerais da turma, combinados ou encerramento — integre esses elementos como itens da pauta quando necessário.',
    )
    user.push('Tamanho final: curto, focado na pauta e nas observações, com espaço para anotações durante a reunião.')
  } else if (type === 'portfolio_text') {
    system.push(
      'Este documento é portfólio textual: narrativa pedagógica com evidências, memória de percurso e tom afetivo-profissional.',
      'Valorize produções, falas, brincadeiras, descobertas e avanços sem transformar em relatório clínico.',
      'BNCC pode aparecer de forma discreta, conectada às experiências observadas.',
      'Escreva em português brasileiro revisado, com frases naturais, sem erros de acentuação, concordância ou grafia.',
      'Não descreva o conteúdo visual das fotos anexadas; use-as apenas como registros que serão inseridos visualmente no documento pela aplicação.',
    )
    user.push('Tamanho final: narrativa média, com evidências e linguagem sensível, sem exagero acadêmico, em português brasileiro correto.')
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
      const text = annotation.text?.trim() || 'Sem conteúdo'
      return `- ${date} | ${label}: ${text}`
    })
    .join('\n')
}

function formatAttachments(attachments?: Array<{ name?: string; type?: string; size?: number; hasImageInPortfolio?: boolean; extractedText?: string }>) {
  if (!attachments?.length) return ''
  return attachments
    .slice(0, 20)
    .map((attachment) => {
      const name = attachment.name ?? 'arquivo'
      const type = attachment.type ?? 'application/octet-stream'
      const size = typeof attachment.size === 'number' ? `${attachment.size} bytes` : 'tamanho desconhecido'
      const visualNote = attachment.hasImageInPortfolio ? ', imagem será exibida no portfólio pela aplicação' : ''
      const extractedText = attachment.extractedText?.trim()
      const textNote = extractedText
        ? `\n  Trecho textual extraído para seguir como referência:\n  ${extractedText.slice(0, 3000)}`
        : ''
      return `- ${name} (${type}, ${size}${visualNote})${textNote}`
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
  if (isFreeFormCreator(input)) return []

  const normalizedKind = normalize(input.reportKind ?? input.docKind ?? '')

  if (normalizedKind.includes('diario de bordo')) {
    return [
      'Documento coletivo da turma (não transformar em relatório individual)',
      'Registrar rotina, experiências e participação coletiva do dia',
      'Citar criança específica apenas quando realmente necessário',
      'Saída final com 1 a 3 parágrafos curtos e leitura leve',
    ]
  }

  if (input.generationType === 'weekly_planning') {
    return [
      'Para cada dia da semana (segunda a sexta): intencionalidade específica do dia',
      'Para cada dia da semana: proposta/atividade do dia',
      'Para cada dia da semana: materiais necessários',
      'PROIBIDO: objetivo único geral para a semana inteira — cada dia tem sua própria intencionalidade',
      'Observações gerais ao final (opcional)',
    ]
  }

  if (
    input.generationType === 'planning'
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
      'Informações básicas (criança, turma e período)',
      'Adaptação e convivência',
      'Desenvolvimento da linguagem',
      'Desenvolvimento motor',
      'Desenvolvimento cognitivo e autonomia',
      'Interesses e preferências',
      'Participação da família',
      'Considerações finais',
      'Não incluir seção de campos de experiência da BNCC',
      'Não inventar informações ausentes; quando faltar evidência, declarar que não há registro suficiente',
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
      'Estrategias pedagógicas já aplicadas',
      'Solicitação de avaliação externa',
    ]
  }

  if (input.generationType === 'parents_meeting_record') {
    return [
      'Pauta da reunião (eixo central, com itens numerados e tempos estimados)',
      'Observações e encaminhamentos',
      'Espaço em branco para anotações durante a reunião',
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
    'Você NÁO pode diagnosticar, citar transtornos, usar linguagem clínica ou emitir laudos.',
    'Use linguagem acolhedora, prática, pedagógica, simples e profissional.',
    'Nunca use termos: problema, transtorno, diagnóstico, falhou, deficit.',
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
    'Você NÁO pode:',
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
    'Sua analise deve permanecer alinhada a BNCC para Educação Infantil e ao acompanhamento pedagógico contínuo.',
    'Você NÁO pode diagnosticar, sugerir transtornos, usar linguagem médica ou emitir parecer clínico.',
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
    'Você NÁO pode:',
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
    '- sugira novas estrategias pedagógicas',
    '- mantenhá linguagem acolhedora',
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
      'Refine a análise anterior preservando regras e objetividade.',
      'Retorne apenas JSON válido no formato solicitado.',
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
