export type LegalSection = {
  title: string
  body?: string[]
  items?: string[]
}

export type LegalPageContent = {
  slug: string
  title: string
  subtitle: string
  updatedAt: string
  sections: LegalSection[]
}

const company =
  'Grupo CAPACARD, CNPJ 40.568.145/0001-08, Avenida Paulista, 1636, Conj 4 Pavmto 15, Bela Vista, São Paulo/SP, CEP 01310-200.'

export const legalPages: LegalPageContent[] = [
  {
    slug: 'termos',
    title: 'Termos de Uso',
    subtitle: 'Contrato entre o Approf e a professora usuária.',
    updatedAt: 'Maio de 2026',
    sections: [
      {
        title: '1. Aceitação dos Termos',
        body: [
          'Ao se cadastrar e utilizar a plataforma Approf, você declara ter lido, compreendido e concordado integralmente com estes Termos de Uso. Caso não concorde com qualquer disposição aqui prevista, não utilize a plataforma.',
          `Estes Termos constituem um contrato juridicamente vinculante entre você e o ${company}`,
        ],
      },
      {
        title: '2. Descrição do Serviço',
        body: [
          'O Approf é uma plataforma digital desenvolvida para professoras da Educação Infantil, com recursos para organizar a rotina pedagógica, registrar observações, acompanhar alunos e gerar documentos com apoio de inteligência artificial.',
          'Os documentos gerados pela IA são instrumentos de apoio à prática pedagógica. A responsabilidade pedagógica, ética e legal pelo conteúdo final utilizado é sempre da professora usuária.',
        ],
        items: [
          'Registro e organização de anotações pedagógicas diárias.',
          'Gestão de turmas, alunos, chamada, calendário e perfis individuais.',
          'Geração assistida por IA de relatórios, pareceres, portfólios, planejamentos, projetos e encaminhamentos.',
          'Geração de imagens pedagógicas ilustrativas, sem envio de fotos de crianças para IA.',
          'Intervenções pedagógicas, materiais de apoio e comunidade de professoras.',
        ],
      },
      {
        title: '3. Elegibilidade e Cadastro',
        body: [
          'Para utilizar o Approf, você deve ser maior de 18 anos, atuar como professora ou educadora da Educação Infantil, fornecer informações verdadeiras e manter suas credenciais em sigilo.',
          'O Grupo CAPACARD pode recusar, revisar ou cancelar cadastros em caso de informações falsas, uso indevido ou risco à segurança da plataforma.',
        ],
      },
      {
        title: '4. Planos, Teste Gratuito e Pagamentos',
        body: [
          'O Approf oferece 7 dias de teste gratuito, sem necessidade de cartão de crédito. Ao final do período, o acesso poderá depender da contratação de um plano pago ou liberação administrativa.',
          'Os planos podem ser mensais ou anuais. Os valores vigentes ficam disponíveis na página de preços do site e podem ser atualizados com aviso prévio quando aplicável.',
          'Pagamentos podem ser processados por plataforma terceirizada segura. O Grupo CAPACARD não armazena dados completos de cartão de crédito em seus servidores.',
        ],
      },
      {
        title: '5. Cancelamento e Reembolso',
        body: [
          'A assinatura pode ser cancelada a qualquer momento pelos canais disponibilizados pelo Approf. Após o cancelamento, o acesso permanece ativo até o final do período já pago.',
          'Pedidos de reembolso podem ser analisados quando solicitados em até 7 dias corridos após a primeira cobrança, conforme o Código de Defesa do Consumidor.',
        ],
      },
      {
        title: '6. Uso Aceitável da Plataforma',
        items: [
          'Não compartilhar, vender, alugar ou ceder sua conta a terceiros.',
          'Não registrar informações falsas sobre crianças, famílias ou escola.',
          'Não publicar ou compartilhar imagens que identifiquem crianças.',
          'Não usar a plataforma para assédio, discriminação, violência, spam ou fins contrários à legislação brasileira.',
          'Não tentar acessar dados, sistemas ou áreas para as quais você não tenha autorização.',
        ],
      },
      {
        title: '7. Dados de Crianças',
        body: [
          'O Approf não coleta dados de crianças diretamente. As informações de alunos são inseridas exclusivamente pela professora, que deve ter autorização institucional e/ou dos responsáveis quando aplicável.',
          'Essas informações devem ser usadas apenas para finalidade pedagógica, com sigilo profissional e proporcionalidade.',
        ],
      },
      {
        title: '8. Propriedade Intelectual',
        body: [
          'Código-fonte, design, logotipos, textos, funcionalidades e documentação da plataforma pertencem ao Grupo CAPACARD.',
          'Documentos gerados pela IA com base em anotações e dados inseridos pela professora pertencem à professora usuária, que pode utilizá-los para fins pedagógicos.',
        ],
      },
      {
        title: '9. Disponibilidade e Manutenção',
        body: [
          'O Grupo CAPACARD emprega esforços para manter a plataforma disponível, mas não garante funcionamento ininterrupto. Podem ocorrer indisponibilidades por manutenção, atualizações ou fatores técnicos externos.',
        ],
      },
      {
        title: '10. Limitação de Responsabilidade',
        body: [
          'O Approf não substitui o julgamento profissional da professora. A plataforma não se responsabiliza por decisões pedagógicas, administrativas ou clínicas tomadas exclusivamente com base em documentos gerados pela IA.',
        ],
      },
      {
        title: '11. Modificações',
        body: [
          'Estes Termos podem ser atualizados. Alterações significativas serão comunicadas por e-mail ou aviso na plataforma com antecedência razoável.',
        ],
      },
      {
        title: '12. Contato e Foro',
        body: [
          'Para dúvidas, entre em contato pelo e-mail contato@approf.com.br. Estes Termos são regidos pelas leis brasileiras, com foro da Comarca de São Paulo/SP.',
        ],
      },
    ],
  },
  {
    slug: 'privacidade',
    title: 'Política de Privacidade',
    subtitle: 'Como tratamos dados da professora e informações pedagógicas.',
    updatedAt: 'Maio de 2026',
    sections: [
      {
        title: '1. Controlador',
        body: [
          `O controlador dos dados pessoais coletados pela plataforma Approf é o ${company}`,
          'Para assuntos de privacidade e proteção de dados, entre em contato pelo e-mail contato@approf.com.br.',
        ],
      },
      {
        title: '2. Dados que Coletamos',
        items: [
          'Dados da professora: nome, CPF, e-mail, telefone, senha protegida, foto de perfil e informações de verificação quando enviadas.',
          'Dados pedagógicos: anotações, perfis de alunos, turmas, diagnósticos relevantes, fotos de produções pedagógicas e documentos gerados.',
          'Dados técnicos: IP, dispositivo, navegador, páginas acessadas, logs de segurança e erros técnicos.',
        ],
      },
      {
        title: '3. Como Utilizamos os Dados',
        items: [
          'Autenticação, segurança da conta e comunicações importantes.',
          'Organização da rotina pedagógica, turmas, alunos, chamada, calendário e documentos.',
          'Geração de textos pedagógicos por IA mediante solicitação da professora.',
          'Geração de imagens pedagógicas ilustrativas sem envio de fotos identificáveis de crianças para IA.',
          'Melhoria do produto com dados anonimizados e agregados, quando permitido.',
        ],
      },
      {
        title: '4. Compartilhamento com Terceiros',
        body: [
          'Não vendemos nem alugamos dados pessoais. Compartilhamos dados apenas com fornecedores necessários para prestação do serviço, como infraestrutura, autenticação, pagamentos, envio de e-mails e APIs de IA.',
          'Os fornecedores devem atuar sob medidas contratuais e técnicas adequadas de proteção de dados.',
        ],
      },
      {
        title: '5. Proteção Especial de Crianças',
        body: [
          'Nenhuma imagem que identifique crianças é compartilhada publicamente ou utilizada para treinamento de modelos de IA pelo Approf.',
          'Dados de alunos ficam vinculados à conta da professora responsável e protegidos por controle de acesso, armazenamento privado e Row Level Security.',
        ],
      },
      {
        title: '6. Segurança',
        items: [
          'Criptografia em trânsito por HTTPS/TLS.',
          'Proteção de senhas por hash seguro.',
          'Row Level Security para isolamento entre contas.',
          'Backups, auditoria e monitoramento de acessos e falhas.',
        ],
      },
      {
        title: '7. Retenção',
        body: [
          'Mantemos dados pelo período necessário para prestação do serviço e cumprimento de obrigações legais. Dados pedagógicos podem ficar disponíveis por até 90 dias após o encerramento da conta para exportação, antes da exclusão definitiva.',
        ],
      },
      {
        title: '8. Direitos da Titular',
        body: [
          'Nos termos da LGPD, você pode solicitar confirmação, acesso, correção, portabilidade, anonimização, bloqueio, eliminação, informações sobre compartilhamento, revogação de consentimento e oposição quando aplicável.',
          'Solicitações devem ser enviadas para contato@approf.com.br.',
        ],
      },
      {
        title: '9. Cookies e Transferência Internacional',
        body: [
          'Usamos cookies necessários para funcionamento da plataforma e, quando aplicável, cookies de analytics ou pagamento. Alguns fornecedores podem processar dados fora do Brasil com mecanismos adequados de proteção.',
        ],
      },
      {
        title: '10. Atualizações',
        body: [
          'Esta Política pode ser atualizada periodicamente. A versão mais recente permanecerá disponível nesta página.',
        ],
      },
    ],
  },
  {
    slug: 'cookies',
    title: 'Política de Cookies',
    subtitle: 'Como utilizamos cookies e tecnologias similares.',
    updatedAt: 'Maio de 2026',
    sections: [
      {
        title: '1. O que são Cookies',
        body: [
          'Cookies são pequenos arquivos armazenados no dispositivo para reconhecer sessões, manter login, guardar preferências e melhorar a segurança e a experiência de uso.',
        ],
      },
      {
        title: '2. Cookies Estritamente Necessários',
        body: [
          'Esses cookies são indispensáveis para autenticação, segurança e funcionamento básico da plataforma. Sem eles, serviços essenciais podem não funcionar.',
        ],
        items: [
          'Tokens de autenticação e renovação de sessão.',
          'Preferências essenciais de navegação e estado da tela.',
        ],
      },
      {
        title: '3. Cookies de Desempenho e Pagamento',
        body: [
          'Cookies de analytics podem ser usados para entender o uso da plataforma e identificar melhorias, quando houver consentimento. Provedores de pagamento podem usar cookies próprios para segurança e prevenção a fraude durante a contratação.',
        ],
      },
      {
        title: '4. Como Gerenciar',
        body: [
          'Você pode gerenciar cookies nas configurações do navegador. A desativação de cookies necessários pode afetar o acesso à plataforma.',
        ],
      },
      {
        title: '5. Contato',
        body: ['Para dúvidas sobre cookies, escreva para contato@approf.com.br.'],
      },
    ],
  },
  {
    slug: 'cancelamento-reembolso',
    title: 'Cancelamento e Reembolso',
    subtitle: 'Regras simples para teste gratuito, cancelamento e reembolso.',
    updatedAt: 'Maio de 2026',
    sections: [
      {
        title: '1. Teste Gratuito',
        body: [
          'O Approf oferece 7 dias de teste gratuito, sem necessidade de cartão de crédito. Durante esse período, a professora pode conhecer os recursos principais da plataforma sem cobrança.',
          'Ao final do teste, o acesso poderá depender de assinatura ativa ou liberação administrativa.',
        ],
      },
      {
        title: '2. Como Cancelar',
        body: [
          'A assinatura pode ser cancelada a qualquer momento pelos canais disponibilizados pelo Approf. Quando a opção estiver disponível no app, o cancelamento poderá ser realizado diretamente em plano e pagamento.',
          'Também é possível solicitar orientação pelo e-mail contato@approf.com.br.',
        ],
      },
      {
        title: '3. Depois do Cancelamento',
        items: [
          'O acesso permanece ativo até o final do período já pago.',
          'Não há novas cobranças após a efetivação do cancelamento.',
          'Dados e documentos podem ficar disponíveis por até 90 dias para exportação, antes da exclusão definitiva.',
        ],
      },
      {
        title: '4. Reembolso',
        body: [
          'Nos termos do art. 49 do Código de Defesa do Consumidor, a professora pode solicitar reembolso em até 7 dias corridos após a primeira contratação paga.',
          'Reembolsos por falha técnica relevante podem ser analisados caso a caso. Reembolsos aprovados serão processados pelo mesmo método de pagamento quando possível.',
        ],
      },
      {
        title: '5. Casos sem Direito a Reembolso',
        items: [
          'Cancelamentos solicitados após 7 dias da contratação paga.',
          'Cancelamento por não utilização da plataforma.',
          'Cancelamento por violação dos Termos de Uso ou da Política de Uso Aceitável.',
          'Período já utilizado de plano anual após o prazo legal de arrependimento.',
        ],
      },
      {
        title: '6. Contato',
        body: [
          'Para dúvidas sobre cancelamento ou reembolso, escreva para contato@approf.com.br.',
        ],
      },
    ],
  },
  {
    slug: 'uso-aceitavel',
    title: 'Política de Uso Aceitável',
    subtitle: 'O que pode e o que não pode na plataforma Approf.',
    updatedAt: 'Maio de 2026',
    sections: [
      {
        title: '1. Objetivo',
        body: [
          'Esta Política complementa os Termos de Uso e define regras para manter o Approf seguro, ético e pedagogicamente responsável.',
        ],
      },
      {
        title: '2. Usos Permitidos',
        items: [
          'Registrar anotações pedagógicas sobre alunos, turmas e atividades.',
          'Gerar documentos pedagógicos para uso profissional.',
          'Gerenciar turmas e perfis de alunos sob sua responsabilidade pedagógica.',
          'Participar da comunidade com respeito e finalidade pedagógica.',
          'Utilizar materiais de apoio e documentos gerados em sua prática profissional.',
        ],
      },
      {
        title: '3. Proteção de Crianças',
        body: [
          'É proibido compartilhar, publicar ou tornar pública qualquer imagem que permita identificar crianças. O descumprimento dessa regra pode resultar em suspensão imediata ou cancelamento definitivo da conta.',
        ],
        items: [
          'Não publicar imagens identificáveis de crianças no feed ou em áreas compartilhadas.',
          'Não registrar conteúdo que exponha crianças a violência, assédio ou situação vexatória.',
          'Não ceder acesso a terceiros para visualização de dados de alunos.',
          'Não registrar dados de crianças que não estejam sob sua responsabilidade pedagógica direta.',
        ],
      },
      {
        title: '4. Comunidade',
        items: [
          'Não praticar assédio, bullying, discriminação, spam ou publicidade indevida.',
          'Não publicar conteúdo falso, enganoso, ofensivo ou político-partidário.',
          'Não plagiar conteúdo de outras professoras sem atribuição.',
        ],
      },
      {
        title: '5. Inteligência Artificial',
        body: [
          'A professora deve revisar documentos gerados por IA antes de utilizá-los oficialmente. As anotações inseridas devem ser verdadeiras e baseadas em observações reais.',
        ],
      },
      {
        title: '6. Confidencialidade',
        body: [
          'Dados pessoais, dados de saúde, informações familiares e documentos pedagógicos de alunos devem ser mantidos em sigilo profissional.',
        ],
      },
      {
        title: '7. Consequências',
        items: [
          'Advertência formal.',
          'Suspensão temporária da conta.',
          'Cancelamento permanente sem direito a reembolso em casos graves.',
          'Comunicação às autoridades quando houver violação legal.',
        ],
      },
      {
        title: '8. Denúncias',
        body: [
          'Violações podem ser denunciadas pelos recursos da plataforma ou pelo e-mail contato@approf.com.br.',
        ],
      },
    ],
  },
  {
    slug: 'protecao-criancas',
    title: 'Aviso de Proteção de Dados de Crianças',
    subtitle: 'Como o Approf protege informações relacionadas a crianças.',
    updatedAt: 'Maio de 2026',
    sections: [
      {
        title: 'Nosso Compromisso',
        body: [
          'O Approf foi criado para professoras da Educação Infantil. Como a rotina pedagógica envolve informações de crianças de 0 a 5 anos, tratamos esse tema com prioridade máxima.',
        ],
      },
      {
        title: '1. O Approf Não Coleta Dados de Crianças Diretamente',
        body: [
          'A plataforma não tem cadastro feito por crianças, não solicita informações diretamente delas e não interage com crianças. Os dados são inseridos exclusivamente pela professora no exercício de sua responsabilidade pedagógica.',
        ],
      },
      {
        title: '2. Informações Inseridas pela Professora',
        items: [
          'Nome, data de nascimento e turma do aluno.',
          'Diagnósticos relevantes para o planejamento pedagógico.',
          'Anotações sobre desenvolvimento, comportamento e rotina.',
          'Fotos de produções pedagógicas, quando necessárias.',
        ],
      },
      {
        title: '3. Como Protegemos os Dados',
        items: [
          'Acesso restrito à professora responsável.',
          'Armazenamento privado de fotos e documentos.',
          'Controle de acesso por Row Level Security.',
          'URLs temporárias quando for necessário exibir arquivos privados.',
          'Proibição de compartilhamento público de imagens identificáveis de crianças.',
        ],
      },
      {
        title: '4. IA e Imagens',
        body: [
          'As imagens geradas por IA no Approf são ilustrativas e pedagógicas. Nenhuma foto real de criança deve ser enviada para geração de imagem por IA.',
        ],
      },
      {
        title: '5. Dados Sensíveis',
        body: [
          'Diagnósticos e informações de saúde são tratados como dados sensíveis e usados apenas para apoiar a documentação pedagógica da professora.',
        ],
      },
      {
        title: '6. Retenção e Exclusão',
        body: [
          'Ao encerrar a conta, dados de alunos podem ser mantidos por até 90 dias para exportação e depois excluídos de forma definitiva, respeitadas obrigações legais aplicáveis.',
        ],
      },
      {
        title: '7. Responsabilidade da Professora',
        items: [
          'Utilizar dados de alunos apenas para fins pedagógicos.',
          'Manter sigilo profissional.',
          'Ter autorização institucional e/ou dos responsáveis quando aplicável.',
          'Não compartilhar externamente dados identificáveis obtidos pela plataforma.',
        ],
      },
      {
        title: '8. Contato',
        body: [
          'Pais, mães ou responsáveis com dúvidas podem entrar em contato pelo e-mail contato@approf.com.br.',
        ],
      },
    ],
  },
]

export const legalPageMap = new Map(legalPages.map((page) => [page.slug, page]))
