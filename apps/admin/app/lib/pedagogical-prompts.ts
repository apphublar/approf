import type { AiGenerationType } from './ai-usage'

export interface BuildPromptInput {
  generationType: AiGenerationType
  promptVersion: string
  reportKind?: string
  docKind?: string
  studentName?: string
  className?: string
  ageGroup?: string
  mode?: string
  selectedAnnotations?: Array<{ date?: string; label?: string; text?: string }>
  ignoredNotes?: string
  blankContext?: string
  extraContext?: string
  objective?: string
  theme?: string
  bnccFields?: string[]
  useAnnotations?: boolean
  attachments?: Array<{ name?: string; type?: string; size?: number }>
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
 * Etapa 1: rascunho pedagógico — organiza contexto, anotações e estrutura do documento.
 */
export function buildStage1DraftPrompt(input: BuildPromptInput): PedagogicalPrompt {
  const kind = input.reportKind || input.docKind || mapGenerationType(input.generationType)
  const pv = pipelineStagePromptVersion(input.promptVersion, 1)

  const system = [
    `Voce executa a ETAPA 1 (rascunho pedagogico) do pipeline textual do Approf (${pv}).`,
    'Produza um RASCUNHO em portugues brasileiro para Educacao Infantil (0 a 5 anos), alinhado a BNCC, direitos de aprendizagem e campos de experiencia.',
    'Use estrutura formal de documento pedagogico: titulo, identificacao quando houver, secoes com subtitulos, paragrafos coesos e encerramento/encaminhamentos.',
    'Siga padrao ABNT adaptado para uso escolar: linguagem formal, objetiva, sem emojis, sem listas excessivas, sem informalidade, com organizacao clara e hierarquia textual.',
    'Organize o contexto recebido em secoes logicas com titulos claros.',
    'Use linguagem descritiva e acolhedora; evite linguagem julgadora ou rotulos para a crianca.',
    'Nunca compare criancas entre si.',
    'Nunca realize diagnostico medico, clinico ou psicologico.',
    'Nao invente fatos: use apenas o contexto fornecido.',
    'A saida desta etapa e um rascunho que sera revisado nas etapas seguintes; nao precisa estar perfeita, mas deve ser completa e estruturada.',
  ].join('\n')

  const user = buildContextUserBlock(kind, input)

  return { system, user }
}

/**
 * Etapa 2: revisão BNCC e segurança pedagógica — coerência, campos de experiência, segurança textual.
 */
export function buildStage2BnccReviewPrompt(input: BuildPromptInput, draftFromStage1: string): PedagogicalPrompt {
  const kind = input.reportKind || input.docKind || mapGenerationType(input.generationType)
  const pv = pipelineStagePromptVersion(input.promptVersion, 2)

  const system = [
    `Voce executa a ETAPA 2 (revisao BNCC e seguranca pedagogica) do pipeline textual do Approf (${pv}).`,
    'Voce recebe um RASCUNHO da etapa anterior. Revise e reescreva o texto completo.',
    'Garanta coerencia com BNCC da Educacao Infantil (0 a 5 anos), campos de experiencia e linguagem nao clinica.',
    'Verifique se o texto esta em formato formal adequado para documento escolar, com organizacao inspirada na ABNT (titulo, secoes, paragrafos, objetividade e coesao).',
    'Remova ou neutralize qualquer comparacao entre criancas, diagnostico ou conclusao clinica, e linguagem julgadora.',
    'Mantenha apenas observacoes pedagogicas e descritivas.',
    'Preserve fatos e intencoes do rascunho; nao invente novos fatos.',
    'Responda APENAS com o texto final revisado (sem prefacio, sem comentarios meta, sem markdown de explicacao).',
  ].join('\n')

  const user = [
    `TIPO DE DOCUMENTO: ${kind}`,
    `TIPO DE GERACAO: ${input.generationType}`,
    `CRIANCA: ${input.studentName ?? 'Nao informado'}`,
    `TURMA: ${input.className ?? 'Nao informado'}`,
    '',
    'RASCUNHO DA ETAPA 1 (revise integralmente o texto abaixo):',
    '',
    draftFromStage1.trim(),
  ].join('\n')

  return { system, user }
}

/**
 * Etapa 3: refinamento final e humanização — fluidez, personalização, tom humano, pronto para uso.
 */
export function buildStage3FinalRefinementPrompt(input: BuildPromptInput, textFromStage2: string): PedagogicalPrompt {
  const kind = input.reportKind || input.docKind || mapGenerationType(input.generationType)
  const pv = pipelineStagePromptVersion(input.promptVersion, 3)

  const system = [
    `Voce executa a ETAPA 3 (refinamento final e humanizacao) do pipeline textual do Approf (${pv}).`,
    'Voce recebe um texto ja revisado pedagogicamente. Melhore fluidez, clareza e tom humano e acolhedor.',
    'Personalize levemente quando fizer sentido (sem inventar dados) para leitura pela professora e familias.',
    'Mantenha todas as regras: Educacao Infantil 0-5 anos, BNCC, sem diagnostico clinico, sem comparacao entre criancas, sem linguagem julgadora.',
    'Entregue em formato de documento final: titulo claro, secoes bem nomeadas, paragrafos formais e texto pronto para exportar em PDF/Word.',
    'A professora podera editar depois: o texto deve estar pronto para uso, mas sem tom robotizado.',
    'Responda APENAS com o texto final (sem prefacio, sem comentarios meta).',
  ].join('\n')

  const user = [
    `TIPO DE DOCUMENTO: ${kind}`,
    `CRIANCA: ${input.studentName ?? 'Nao informado'}`,
    `TURMA: ${input.className ?? 'Nao informado'}`,
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
  const bncc = input.bnccFields?.length ? input.bnccFields.join(', ') : 'Nao informado'
  const attachments = formatAttachments(input.attachments)
  const selectedAnnotations = formatAnnotations(input.selectedAnnotations)

  return [
    `TIPO DE DOCUMENTO: ${kind}`,
    `TIPO DE GERACAO: ${input.generationType}`,
    `CRIANCA: ${input.studentName ?? 'Nao informado'}`,
    `TURMA: ${input.className ?? 'Nao informado'}`,
    `FAIXA ETARIA: ${input.ageGroup ?? 'Nao informado'}`,
    `MODO: ${input.mode ?? 'Nao informado'}`,
    `CAMPOS BNCC: ${bncc}`,
    `TEMA: ${input.theme?.trim() || 'Nao informado'}`,
    `OBJETIVO: ${input.objective?.trim() || 'Nao informado'}`,
    `USAR ANOTACOES: ${input.useAnnotations === false ? 'nao' : 'sim'}`,
    '',
    'ANOTACOES SELECIONADAS:',
    selectedAnnotations || '- Nenhuma anotacao enviada.',
    '',
    'INFORMACOES PARA DESCONSIDERAR:',
    input.ignoredNotes?.trim() || '- Nenhuma informacao.',
    '',
    'CONTEXTO LIVRE (QUANDO GERADO DO ZERO):',
    input.blankContext?.trim() || '- Nao informado.',
    '',
    'ORIENTACAO EXTRA DA PROFESSORA:',
    input.extraContext?.trim() || '- Nao informado.',
    '',
    'ANEXOS AUTORIZADOS COMO REFERENCIA (apenas nomes/metadados; nao analise o conteudo binario):',
    attachments || '- Nenhum anexo enviado.',
    '',
    'INSTRUCOES DE FORMATO DO RASCUNHO:',
    '- Estruture em formato formal, inspirado na ABNT para documento escolar: titulo, identificacao/contexto, desenvolvimento, encaminhamentos e fechamento quando couber.',
    '- Estruture em secoes com titulos claros.',
    '- Use paragrafos objetivos, coesos e linguagem formal, evitando emojis, slogans e excesso de topicos.',
    '- Inclua sintese do percurso, pontos de apoio e encaminhamentos pedagogicos quando couber.',
    '- Termine com orientacoes de continuidade entre escola e familia quando fizer sentido.',
  ].join('\n')
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
      return 'Relatorio de desenvolvimento'
    case 'planning':
      return 'Planejamento pedagogico'
    case 'portfolio_text':
      return 'Portfolio pedagogico (texto)'
    case 'specialist_report':
      return 'Relatorio pedagogico para especialista'
    case 'general_report':
      return 'Relatorio pedagogico'
    default:
      return 'Documento pedagogico'
  }
}
