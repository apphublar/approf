import type {
  CreatorDocumentType,
  CreatorImageFormat,
  CreatorMode,
  CreatorSourceMode,
  CreatorTone,
  CreatorVisualStyle,
} from './types'

export const CREATOR_MODES: Array<{ id: CreatorMode; title: string; description: string }> = [
  {
    id: 'guided',
    title: 'Documento Pedagógico',
    description: 'Relatórios, planejamentos, portfólios escritos e documentos pedagógicos com linguagem profissional.',
  },
  {
    id: 'visual_portfolio',
    title: 'Portfólio Visual',
    description: 'Transforme anotações e registros em painéis, capas e imagens pedagógicas.',
  },
  {
    id: 'free',
    title: 'Criação Livre',
    description: 'Crie textos, imagens, comunicados, ideias, cartazes e materiais diversos — como no ChatGPT.',
  },
]

export const GUIDED_TYPES_WITH_ANNOTATIONS: CreatorDocumentType[] = [
  'individual_report',
  'portfolio_text',
  'pedagogical_referral',
]

export function guidedTypeUsesAnnotations(documentType: CreatorDocumentType) {
  return GUIDED_TYPES_WITH_ANNOTATIONS.includes(documentType)
}

export const GUIDED_TYPES: Array<{ id: CreatorDocumentType; label: string }> = [
  { id: 'individual_report', label: 'Relatório de Desenvolvimento Individual' },
  { id: 'portfolio_text', label: 'Portfólio Escrito' },
  { id: 'daily_log', label: 'Diário de Bordo' },
  { id: 'weekly_plan', label: 'Planejamento Semanal' },
  { id: 'lesson_plan', label: 'Plano de Aula' },
  { id: 'project', label: 'Projeto Pedagógico' },
  { id: 'family_meeting', label: 'Reunião com Família' },
  { id: 'pedagogical_referral', label: 'Encaminhamento Pedagógico' },
  { id: 'other_pedagogical', label: 'Outro Documento Pedagógico' },
]

export const VISUAL_TYPES: Array<{ id: CreatorDocumentType; label: string }> = [
  { id: 'visual_portfolio_individual', label: 'Portfólio Individual da Criança' },
  { id: 'visual_cover', label: 'Capa de Portfólio' },
  { id: 'visual_learning_panel', label: 'Painel de Aprendizagens' },
  { id: 'visual_timeline', label: 'Linha do Tempo Visual' },
  { id: 'visual_class_panel', label: 'Painel da Turma' },
  { id: 'visual_project', label: 'Projeto Pedagógico Visual' },
]

export const SOURCE_MODES: Array<{ id: CreatorSourceMode; label: string }> = [
  { id: 'prompt_only', label: 'Criar apenas com meu pedido' },
  { id: 'student_notes', label: 'Usar anotações da criança' },
  { id: 'class_notes', label: 'Usar anotações da turma' },
  { id: 'notes_and_prompt', label: 'Usar anotações + meu pedido' },
]

export const VISUAL_STYLES: Array<{ id: CreatorVisualStyle; label: string }> = [
  { id: 'delicado', label: 'Delicado' },
  { id: 'escolar', label: 'Escolar' },
  { id: 'moderno', label: 'Moderno' },
  { id: 'minimalista', label: 'Minimalista' },
  { id: 'colorido', label: 'Colorido' },
  { id: 'ludico', label: 'Lúdico' },
]

export const TONE_OPTIONS: Array<{ id: CreatorTone; label: string }> = [
  { id: 'acolhedor', label: 'Acolhedor' },
  { id: 'objetivo', label: 'Objetivo' },
  { id: 'detalhado', label: 'Detalhado' },
  { id: 'simples', label: 'Simples' },
  { id: 'formal', label: 'Formal' },
]

export const IMAGE_FORMATS: Array<{ id: CreatorImageFormat; label: string }> = [
  { id: 'portrait', label: 'Retrato' },
  { id: 'landscape', label: 'Paisagem' },
  { id: 'square', label: 'Quadrado' },
]

export const RECOMMENDED_PROMPTS: Record<CreatorDocumentType, string> = {
  individual_report: 'Crie um relatório de desenvolvimento individual para Educação Infantil, com linguagem pedagógica, acolhedora, profissional e clara. Use as anotações selecionadas como base principal. Organize o texto em uma narrativa coerente sobre o desenvolvimento da criança, destacando avanços, interesses, interações, linguagem, autonomia, participação nas propostas, movimento, brincadeiras, relação com a rotina e experiências significativas. Não invente informações que não estejam nas anotações. Não compare com outras crianças. Não use diagnóstico, suspeita clínica, laudo ou linguagem médica. Quando não houver evidência suficiente sobre algum aspecto, não force essa informação. Finalize com considerações respeitosas e possibilidades de continuidade do acompanhamento pedagógico.',
  portfolio_text: 'Crie um texto de portfólio pedagógico para Educação Infantil com linguagem afetiva, profissional, sensível e baseada em evidências reais. Use as anotações selecionadas como fonte principal para narrar experiências, descobertas, interações, brincadeiras, produções, avanços, interesses e participação da criança na rotina. O texto deve valorizar o percurso da criança de forma respeitosa e singular. Não invente acontecimentos, falas, conquistas ou comportamentos. Não compare com outras crianças. Não use diagnóstico ou linguagem clínica. O resultado deve parecer uma documentação pedagógica escrita por uma professora atenta, acolhedora e profissional.',
  daily_log: 'Crie um diário de bordo com linguagem natural, pedagógica e acolhedora, registrando os acontecimentos mais relevantes da rotina. Use as anotações como base, preservando situações reais observadas. O texto deve ter fluidez narrativa e parecer escrito por uma professora atenta ao cotidiano das crianças. Não transforme o texto em relatório técnico. Não cite BNCC diretamente, a menos que seja solicitado. Não invente fatos. Não compare crianças. Não use linguagem diagnóstica.',
  weekly_plan: 'Crie um planejamento semanal para Educação Infantil com linguagem pedagógica e estrutura clara. Inclua tema ou eixo de trabalho, objetivos de aprendizagem, campos de experiência da BNCC quando aplicável, organização por dias da semana, propostas de atividades, materiais necessários, intencionalidade pedagógica e formas de observação/avaliação. As atividades devem ser adequadas à faixa etária, viáveis para a rotina escolar e coerentes com uma prática lúdica, investigativa, inclusiva e respeitosa. Evite propostas genéricas. Cada dia deve ter intencionalidade própria.',
  lesson_plan: 'Crie um plano de aula para Educação Infantil com título, faixa etária, duração aproximada, objetivos, campos de experiência da BNCC quando aplicável, materiais, organização do espaço, desenvolvimento da proposta, papel da professora, possibilidades de adaptação e avaliação por observação. A linguagem deve ser profissional, objetiva e aplicável à prática. A proposta deve ser lúdica, segura, viável e adequada à faixa etária.',
  project: 'Crie um projeto pedagógico para Educação Infantil com justificativa, objetivos, campos de experiência da BNCC quando aplicável, desenvolvimento em etapas, propostas de experiências, materiais, papel da professora, participação das crianças, documentação pedagógica e avaliação processual. A proposta deve ser lúdica, investigativa, viável, contextualizada e adequada à faixa etária. Evite linguagem artificial ou excessivamente burocrática.',
  family_meeting: 'Crie uma pauta ou registro de reunião com família, com linguagem acolhedora, objetiva, profissional e respeitosa. Organize os principais pontos a conversar, evidências observadas, avanços, combinados e próximos passos. Evite exposição desnecessária, julgamento, comparação ou linguagem clínica. O texto deve favorecer parceria entre escola e família.',
  pedagogical_referral: 'Crie um encaminhamento pedagógico com linguagem formal, cuidadosa e baseada apenas em comportamentos observáveis. Descreva o contexto, as situações observadas, as estratégias já realizadas pela escola/professora e os motivos do encaminhamento. Não use diagnóstico, suspeita clínica, nomes de transtornos, laudos ou afirmações médicas. O texto deve apoiar o diálogo com a família ou especialistas sem rotular a criança.',
  other_pedagogical: 'Crie o documento pedagógico solicitado pela professora com linguagem profissional, acolhedora e adequada à Educação Infantil. Siga exatamente as instruções fornecidas. Quando houver anotações, use-as como base principal. Não invente fatos, falas, comportamentos, datas ou conquistas. Não compare crianças. Não use diagnóstico ou linguagem clínica. Estruture o texto de forma clara, útil e pronta para uso.',
  visual_portfolio_individual: 'Crie um portfólio visual pedagógico para Educação Infantil utilizando as anotações selecionadas como base principal. O material deve destacar experiências significativas, descobertas, interesses, interações, brincadeiras e avanços observados. A composição deve ter aparência escolar, acolhedora, organizada e adequada para famílias. Não invente acontecimentos, conquistas ou situações que não estejam nas anotações. Não use linguagem diagnóstica. Não compare crianças. Se houver texto na imagem, use frases curtas, em português brasileiro, com boa legibilidade.',
  visual_cover: 'Crie uma capa de portfólio visual acolhedora para Educação Infantil com base nas anotações selecionadas. Destaque a criança ou turma de forma respeitosa, com composição limpa e frases curtas legíveis. Não invente fatos.',
  visual_learning_panel: 'Crie um painel visual de aprendizagens para Educação Infantil com base nas anotações selecionadas. Organize descobertas, interesses e avanços em blocos visuais claros. Frases curtas, sem diagnóstico.',
  visual_timeline: 'Crie uma linha do tempo visual pedagógica com base nas anotações selecionadas, ordenando experiências significativas de forma clara e acolhedora. Não invente datas ou eventos.',
  visual_class_panel: 'Crie um painel visual da turma com base nos registros coletivos selecionados. Destaque vivências compartilhadas, propostas e momentos significativos. Não compare crianças individualmente de forma exposta.',
  visual_project: 'Crie um material visual de projeto pedagógico para Educação Infantil com base nas anotações selecionadas. Composição escolar, organizada e acolhedora.',
  free_text: 'Crie o conteúdo solicitado com clareza, qualidade e linguagem adequada ao contexto escolar. Siga exatamente as instruções escritas pela professora. Se for um texto, entregue pronto para uso.',
  free_image: 'Crie a imagem solicitada com descrição visual clara, segura e apropriada para Educação Infantil. Siga exatamente as instruções da professora.',
}

export function defaultDocumentTypeForMode(mode: CreatorMode): CreatorDocumentType {
  if (mode === 'visual_portfolio') return 'visual_portfolio_individual'
  if (mode === 'free') return 'free_text'
  return 'individual_report'
}

export function outputFormatForFreeChoice(choice: 'text' | 'image'): CreatorDocumentType {
  return choice === 'image' ? 'free_image' : 'free_text'
}
