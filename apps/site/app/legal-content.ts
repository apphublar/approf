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
  'Grupo CAPACARD, CNPJ 40.568.145/0001-08, Avenida Paulista, 1636, Conj 4 Pavmto 15, Bela Vista, Sao Paulo/SP, CEP 01310-200.'

export const legalPages: LegalPageContent[] = [
  {
    slug: 'termos',
    title: 'Termos de Uso',
    subtitle: 'Contrato entre o Approf e a professora usuaria.',
    updatedAt: 'Maio de 2026',
    sections: [
      {
        title: '1. Aceitacao dos termos',
        body: [
          `Ao se cadastrar e utilizar a plataforma Approf, voce declara ter lido, compreendido e concordado com estes Termos de Uso. Caso nao concorde com qualquer disposicao, nao utilize a plataforma.`,
          `Estes Termos constituem um contrato juridicamente vinculante entre voce e o ${company}`,
        ],
      },
      {
        title: '2. Descricao do servico',
        body: [
          'O Approf e uma plataforma digital desenvolvida para professoras da Educacao Infantil, com recursos para organizar a rotina pedagogica, registrar observacoes, acompanhar alunos e gerar documentos com apoio de inteligencia artificial.',
          'Os documentos gerados pela IA sao instrumentos de apoio a pratica pedagogica. A responsabilidade pedagogica, etica e legal pelo conteudo final utilizado e sempre da professora usuaria.',
        ],
        items: [
          'Registro e organizacao de anotacoes pedagogicas diarias.',
          'Gestao de turmas, alunos, chamada, calendario e perfis individuais.',
          'Geracao assistida por IA de relatorios, pareceres, portfolios, planejamentos, projetos e encaminhamentos.',
          'Geracao de imagens pedagogicas ilustrativas, sem envio de fotos de criancas para IA.',
          'Intervencoes pedagogicas, materiais de apoio e comunidade de professoras.',
        ],
      },
      {
        title: '3. Elegibilidade e cadastro',
        body: [
          'Para utilizar o Approf, voce deve ser maior de 18 anos, atuar como professora ou educadora da Educacao Infantil, fornecer informacoes verdadeiras e manter suas credenciais em sigilo.',
          'O Grupo CAPACARD pode recusar, revisar ou cancelar cadastros em caso de informacoes falsas, uso indevido ou risco a seguranca da plataforma.',
        ],
      },
      {
        title: '4. Planos, teste gratuito e pagamentos',
        body: [
          'O Approf oferece 7 dias de teste gratuito, sem necessidade de cartao de credito. Ao final do periodo, o acesso podera depender da contratacao de um plano pago ou liberacao administrativa.',
          'Os planos podem ser mensais ou anuais. Os valores vigentes ficam disponiveis na pagina de precos do site e podem ser atualizados com aviso previo quando aplicavel.',
          'Pagamentos podem ser processados por plataforma terceirizada segura. O Grupo CAPACARD nao armazena dados completos de cartao de credito em seus servidores.',
        ],
      },
      {
        title: '5. Cancelamento e reembolso',
        body: [
          'A assinatura pode ser cancelada a qualquer momento pelos canais disponibilizados pelo Approf. Apos o cancelamento, o acesso permanece ativo ate o final do periodo ja pago.',
          'Pedidos de reembolso podem ser analisados quando solicitados em ate 7 dias corridos apos a primeira cobranca, conforme o Codigo de Defesa do Consumidor.',
        ],
      },
      {
        title: '6. Uso aceitavel da plataforma',
        items: [
          'Nao compartilhar, vender, alugar ou ceder sua conta a terceiros.',
          'Nao registrar informacoes falsas sobre criancas, familias ou escola.',
          'Nao publicar ou compartilhar imagens que identifiquem criancas.',
          'Nao usar a plataforma para assedio, discriminacao, violencia, spam ou fins contrarios a legislacao brasileira.',
          'Nao tentar acessar dados, sistemas ou areas para as quais voce nao tenha autorizacao.',
        ],
      },
      {
        title: '7. Dados de criancas',
        body: [
          'O Approf nao coleta dados de criancas diretamente. As informacoes de alunos sao inseridas exclusivamente pela professora, que deve ter autorizacao institucional e/ou dos responsaveis quando aplicavel.',
          'Essas informacoes devem ser usadas apenas para finalidade pedagogica, com sigilo profissional e proporcionalidade.',
        ],
      },
      {
        title: '8. Propriedade intelectual',
        body: [
          'Codigo-fonte, design, logotipos, textos, funcionalidades e documentacao da plataforma pertencem ao Grupo CAPACARD.',
          'Documentos gerados pela IA com base em anotacoes e dados inseridos pela professora pertencem a professora usuaria, que pode utiliza-los para fins pedagogicos.',
        ],
      },
      {
        title: '9. Disponibilidade e manutencao',
        body: [
          'O Grupo CAPACARD emprega esforcos para manter a plataforma disponivel, mas nao garante funcionamento ininterrupto. Podem ocorrer indisponibilidades por manutencao, atualizacoes ou fatores tecnicos externos.',
        ],
      },
      {
        title: '10. Limitacao de responsabilidade',
        body: [
          'O Approf nao substitui o julgamento profissional da professora. A plataforma nao se responsabiliza por decisoes pedagogicas, administrativas ou clinicas tomadas exclusivamente com base em documentos gerados pela IA.',
        ],
      },
      {
        title: '11. Modificacoes',
        body: [
          'Estes Termos podem ser atualizados. Alteracoes significativas serao comunicadas por e-mail ou aviso na plataforma com antecedencia razoavel.',
        ],
      },
      {
        title: '12. Contato e foro',
        body: [
          'Para duvidas, entre em contato pelo e-mail contato@approf.com.br. Estes Termos sao regidos pelas leis brasileiras, com foro da Comarca de Sao Paulo/SP.',
        ],
      },
    ],
  },
  {
    slug: 'privacidade',
    title: 'Politica de Privacidade',
    subtitle: 'Como tratamos dados da professora e informacoes pedagogicas.',
    updatedAt: 'Maio de 2026',
    sections: [
      {
        title: '1. Controlador',
        body: [
          `O controlador dos dados pessoais coletados pela plataforma Approf e o ${company}`,
          'Para assuntos de privacidade e protecao de dados, entre em contato pelo e-mail contato@approf.com.br.',
        ],
      },
      {
        title: '2. Dados que coletamos',
        items: [
          'Dados da professora: nome, CPF, e-mail, telefone, senha protegida, foto de perfil e informacoes de verificacao quando enviadas.',
          'Dados pedagogicos: anotacoes, perfis de alunos, turmas, diagnosticos relevantes, fotos de producoes pedagogicas e documentos gerados.',
          'Dados tecnicos: IP, dispositivo, navegador, paginas acessadas, logs de seguranca e erros tecnicos.',
        ],
      },
      {
        title: '3. Como utilizamos os dados',
        items: [
          'Autenticacao, seguranca da conta e comunicacoes importantes.',
          'Organizacao da rotina pedagogica, turmas, alunos, chamada, calendario e documentos.',
          'Geracao de textos pedagogicos por IA mediante solicitacao da professora.',
          'Geracao de imagens pedagogicas ilustrativas sem envio de fotos identificaveis de criancas para IA.',
          'Melhoria do produto com dados anonimizados e agregados, quando permitido.',
        ],
      },
      {
        title: '4. Compartilhamento com terceiros',
        body: [
          'Nao vendemos nem alugamos dados pessoais. Compartilhamos dados apenas com fornecedores necessarios para prestacao do servico, como infraestrutura, autenticacao, pagamentos, envio de e-mails e APIs de IA.',
          'Os fornecedores devem atuar sob medidas contratuais e tecnicas adequadas de protecao de dados.',
        ],
      },
      {
        title: '5. Protecao especial de criancas',
        body: [
          'Nenhuma imagem que identifique criancas e compartilhada publicamente ou utilizada para treinamento de modelos de IA pelo Approf.',
          'Dados de alunos ficam vinculados a conta da professora responsavel e protegidos por controle de acesso, armazenamento privado e Row Level Security.',
        ],
      },
      {
        title: '6. Seguranca',
        items: [
          'Criptografia em transito por HTTPS/TLS.',
          'Protecao de senhas por hash seguro.',
          'Row Level Security para isolamento entre contas.',
          'Backups, auditoria e monitoramento de acessos e falhas.',
        ],
      },
      {
        title: '7. Retencao',
        body: [
          'Mantemos dados pelo periodo necessario para prestacao do servico e cumprimento de obrigacoes legais. Dados pedagogicos podem ficar disponiveis por ate 90 dias apos encerramento da conta para exportacao, antes da exclusao definitiva.',
        ],
      },
      {
        title: '8. Direitos da titular',
        body: [
          'Nos termos da LGPD, voce pode solicitar confirmacao, acesso, correcao, portabilidade, anonimimizacao, bloqueio, eliminacao, informacoes sobre compartilhamento, revogacao de consentimento e oposicao quando aplicavel.',
          'Solicitacoes devem ser enviadas para contato@approf.com.br.',
        ],
      },
      {
        title: '9. Cookies e transferencia internacional',
        body: [
          'Usamos cookies necessarios para funcionamento da plataforma e, quando aplicavel, cookies de analytics ou pagamento. Alguns fornecedores podem processar dados fora do Brasil com mecanismos adequados de protecao.',
        ],
      },
      {
        title: '10. Atualizacoes',
        body: [
          'Esta Politica pode ser atualizada periodicamente. A versao mais recente permanecera disponivel nesta pagina.',
        ],
      },
    ],
  },
  {
    slug: 'cookies',
    title: 'Politica de Cookies',
    subtitle: 'Como utilizamos cookies e tecnologias similares.',
    updatedAt: 'Maio de 2026',
    sections: [
      {
        title: '1. O que sao cookies',
        body: [
          'Cookies sao pequenos arquivos armazenados no dispositivo para reconhecer sessoes, manter login, guardar preferencias e melhorar a seguranca e a experiencia de uso.',
        ],
      },
      {
        title: '2. Cookies estritamente necessarios',
        body: [
          'Esses cookies sao indispensaveis para autenticacao, seguranca e funcionamento basico da plataforma. Sem eles, servicos essenciais podem nao funcionar.',
        ],
        items: [
          'Tokens de autenticacao e renovacao de sessao.',
          'Preferencias essenciais de navegacao e estado da tela.',
        ],
      },
      {
        title: '3. Cookies de desempenho e pagamento',
        body: [
          'Cookies de analytics podem ser usados para entender o uso da plataforma e identificar melhorias, quando houver consentimento. Provedores de pagamento podem usar cookies proprios para seguranca e prevencao a fraude durante a contratacao.',
        ],
      },
      {
        title: '4. Como gerenciar',
        body: [
          'Voce pode gerenciar cookies nas configuracoes do navegador. A desativacao de cookies necessarios pode afetar o acesso a plataforma.',
        ],
      },
      {
        title: '5. Contato',
        body: ['Para duvidas sobre cookies, escreva para contato@approf.com.br.'],
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
        title: '1. Teste gratuito',
        body: [
          'O Approf oferece 7 dias de teste gratuito, sem necessidade de cartao de credito. Durante esse periodo, a professora pode conhecer os recursos principais da plataforma sem cobranca.',
          'Ao final do teste, o acesso podera depender de assinatura ativa ou liberacao administrativa.',
        ],
      },
      {
        title: '2. Como cancelar',
        body: [
          'A assinatura pode ser cancelada a qualquer momento pelos canais disponibilizados pelo Approf. Quando a opcao estiver disponivel no app, o cancelamento podera ser realizado diretamente em plano e pagamento.',
          'Tambem e possivel solicitar orientacao pelo e-mail contato@approf.com.br.',
        ],
      },
      {
        title: '3. Depois do cancelamento',
        items: [
          'O acesso permanece ativo ate o final do periodo ja pago.',
          'Nao ha novas cobrancas apos a efetivacao do cancelamento.',
          'Dados e documentos podem ficar disponiveis por ate 90 dias para exportacao, antes da exclusao definitiva.',
        ],
      },
      {
        title: '4. Reembolso',
        body: [
          'Nos termos do art. 49 do Codigo de Defesa do Consumidor, a professora pode solicitar reembolso em ate 7 dias corridos apos a primeira contratacao paga.',
          'Reembolsos por falha tecnica relevante podem ser analisados caso a caso. Reembolsos aprovados serao processados pelo mesmo metodo de pagamento quando possivel.',
        ],
      },
      {
        title: '5. Casos sem reembolso',
        items: [
          'Cancelamentos solicitados apos 7 dias da contratacao paga.',
          'Cancelamento por nao utilizacao da plataforma.',
          'Cancelamento por violacao dos Termos de Uso ou da Politica de Uso Aceitavel.',
          'Periodo ja utilizado de plano anual apos o prazo legal de arrependimento.',
        ],
      },
      {
        title: '6. Contato',
        body: [
          'Para duvidas sobre cancelamento ou reembolso, escreva para contato@approf.com.br.',
        ],
      },
    ],
  },
  {
    slug: 'uso-aceitavel',
    title: 'Politica de Uso Aceitavel',
    subtitle: 'O que pode e o que nao pode na plataforma Approf.',
    updatedAt: 'Maio de 2026',
    sections: [
      {
        title: '1. Objetivo',
        body: [
          'Esta Politica complementa os Termos de Uso e define regras para manter o Approf seguro, etico e pedagogicamente responsavel.',
        ],
      },
      {
        title: '2. Usos permitidos',
        items: [
          'Registrar anotacoes pedagogicas sobre alunos, turmas e atividades.',
          'Gerar documentos pedagogicos para uso profissional.',
          'Gerenciar turmas e perfis de alunos sob sua responsabilidade pedagogica.',
          'Participar da comunidade com respeito e finalidade pedagogica.',
          'Utilizar materiais de apoio e documentos gerados em sua pratica profissional.',
        ],
      },
      {
        title: '3. Protecao de criancas',
        body: [
          'E proibido compartilhar, publicar ou tornar publica qualquer imagem que permita identificar criancas. O descumprimento dessa regra pode resultar em suspensao imediata ou cancelamento definitivo da conta.',
        ],
        items: [
          'Nao publicar imagens identificaveis de criancas no feed ou em areas compartilhadas.',
          'Nao registrar conteudo que exponha criancas a violencia, assedio ou situacao vexatoria.',
          'Nao ceder acesso a terceiros para visualizacao de dados de alunos.',
          'Nao registrar dados de criancas que nao estejam sob sua responsabilidade pedagogica direta.',
        ],
      },
      {
        title: '4. Comunidade',
        items: [
          'Nao praticar assedio, bullying, discriminacao, spam ou publicidade indevida.',
          'Nao publicar conteudo falso, enganoso, ofensivo ou politico-partidario.',
          'Nao plagiar conteudo de outras professoras sem atribuicao.',
        ],
      },
      {
        title: '5. Inteligencia artificial',
        body: [
          'A professora deve revisar documentos gerados por IA antes de utiliza-los oficialmente. As anotacoes inseridas devem ser verdadeiras e baseadas em observacoes reais.',
        ],
      },
      {
        title: '6. Confidencialidade',
        body: [
          'Dados pessoais, dados de saude, informacoes familiares e documentos pedagogicos de alunos devem ser mantidos em sigilo profissional.',
        ],
      },
      {
        title: '7. Consequencias',
        items: [
          'Advertencia formal.',
          'Suspensao temporaria da conta.',
          'Cancelamento permanente sem direito a reembolso em casos graves.',
          'Comunicacao as autoridades quando houver violacao legal.',
        ],
      },
      {
        title: '8. Denuncias',
        body: [
          'Violacoes podem ser denunciadas pelos recursos da plataforma ou pelo e-mail contato@approf.com.br.',
        ],
      },
    ],
  },
  {
    slug: 'protecao-criancas',
    title: 'Aviso de Protecao de Dados de Criancas',
    subtitle: 'Como o Approf protege informacoes relacionadas a criancas.',
    updatedAt: 'Maio de 2026',
    sections: [
      {
        title: 'Nosso compromisso',
        body: [
          'O Approf foi criado para professoras da Educacao Infantil. Como a rotina pedagogica envolve informacoes de criancas de 0 a 5 anos, tratamos esse tema com prioridade maxima.',
        ],
      },
      {
        title: '1. O Approf nao coleta dados de criancas diretamente',
        body: [
          'A plataforma nao tem cadastro feito por criancas, nao solicita informacoes diretamente delas e nao interage com criancas. Os dados sao inseridos exclusivamente pela professora no exercicio de sua responsabilidade pedagogica.',
        ],
      },
      {
        title: '2. Informacoes inseridas pela professora',
        items: [
          'Nome, data de nascimento e turma do aluno.',
          'Diagnosticos relevantes para o planejamento pedagogico.',
          'Anotacoes sobre desenvolvimento, comportamento e rotina.',
          'Fotos de producoes pedagogicas, quando necessarias.',
        ],
      },
      {
        title: '3. Como protegemos os dados',
        items: [
          'Acesso restrito a professora responsavel.',
          'Armazenamento privado de fotos e documentos.',
          'Controle de acesso por Row Level Security.',
          'URLs temporarias quando for necessario exibir arquivos privados.',
          'Proibicao de compartilhamento publico de imagens identificaveis de criancas.',
        ],
      },
      {
        title: '4. IA e imagens',
        body: [
          'As imagens geradas por IA no Approf sao ilustrativas e pedagogicas. Nenhuma foto real de crianca deve ser enviada para geracao de imagem por IA.',
        ],
      },
      {
        title: '5. Dados sensiveis',
        body: [
          'Diagnosticos e informacoes de saude sao tratados como dados sensiveis e usados apenas para apoiar a documentacao pedagogica da professora.',
        ],
      },
      {
        title: '6. Retencao e exclusao',
        body: [
          'Ao encerrar a conta, dados de alunos podem ser mantidos por ate 90 dias para exportacao e depois excluidos de forma definitiva, respeitadas obrigacoes legais aplicaveis.',
        ],
      },
      {
        title: '7. Responsabilidade da professora',
        items: [
          'Utilizar dados de alunos apenas para fins pedagogicos.',
          'Manter sigilo profissional.',
          'Ter autorizacao institucional e/ou dos responsaveis quando aplicavel.',
          'Nao compartilhar externamente dados identificaveis obtidos pela plataforma.',
        ],
      },
      {
        title: '8. Contato',
        body: [
          'Pais, maes ou responsaveis com duvidas podem entrar em contato pelo e-mail contato@approf.com.br.',
        ],
      },
    ],
  },
]

export const legalPageMap = new Map(legalPages.map((page) => [page.slug, page]))
