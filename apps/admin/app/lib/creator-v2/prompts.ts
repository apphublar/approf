import type { CreatorDocumentType, CreatorMode } from '@approf/types'

export const GUIDED_DOCUMENT_TYPES: CreatorDocumentType[] = [
  'individual_report',
  'portfolio_text',
  'daily_log',
  'weekly_plan',
  'lesson_plan',
  'project',
  'family_meeting',
  'pedagogical_referral',
  'other_pedagogical',
]

export const VISUAL_DOCUMENT_TYPES: CreatorDocumentType[] = [
  'visual_portfolio_individual',
  'visual_cover',
  'visual_learning_panel',
  'visual_timeline',
  'visual_class_panel',
  'visual_project',
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

export function buildGuidedSystemPrompt(mode: CreatorMode): string {
  if (mode === 'free') {
    return [
      'Você é um assistente criativo para professoras da Educação Infantil.',
      'Siga exatamente as instruções da professora.',
      'Entregue o resultado final pronto para uso, em português brasileiro.',
      'Não explique o processo. Não diga que é uma IA.',
      'Mantenha conteúdo seguro e apropriado para ambiente escolar com crianças de 0 a 5 anos.',
    ].join('\n')
  }

  if (mode === 'visual_portfolio') {
    return [
      'Você é um especialista em documentação pedagógica visual para Educação Infantil.',
      'Sua função é transformar registros reais em descrições claras para materiais visuais acolhedores.',
      'Use anotações como fonte principal quando existirem.',
      'Não invente experiências. Não diagnostique. Não compare crianças.',
      'Se houver texto na imagem, use frases curtas e legíveis em português brasileiro.',
    ].join('\n')
  }

  return [
    'Você é um assistente especialista em Educação Infantil brasileira, documentação pedagógica, BNCC e comunicação escolar.',
    'Produza conteúdos claros, humanos, profissionais e úteis para professoras.',
    'Regras obrigatórias:',
    '- respeite integralmente as instruções da professora;',
    '- quando houver anotações, use-as como fonte principal de evidências;',
    '- não invente fatos, falas, datas, comportamentos ou conquistas;',
    '- não compare crianças;',
    '- não emita diagnóstico, laudo ou rótulos clínicos;',
    '- escreva em português brasileiro;',
    '- utilize BNCC quando o tipo pedir ou bnccMode for required;',
    '- não cite BNCC quando bnccMode for do_not_mention;',
    'Entregue diretamente o conteúdo final pronto para uso.',
    'Não explique o processo. Não diga que é uma IA.',
  ].join('\n')
}

export const IMPROVE_PROMPT_SYSTEM = 'Você é um assistente especialista em transformar pedidos simples de professoras da Educação Infantil em prompts claros, completos e eficientes para geração de documentos, portfólios visuais e materiais escolares com IA. Sua tarefa é melhorar o pedido da professora sem gerar o conteúdo final.'

export const IMPROVE_NOTE_SYSTEM = 'Você é um assistente especialista em Educação Infantil. Melhore a redação de anotações pedagógicas mantendo os fatos observados. Torne o texto mais claro, profissional e útil para documentação futura. Não invente fatos, falas, datas ou comportamentos. Não diagnostique. Retorne apenas o texto melhorado da anotação.'
