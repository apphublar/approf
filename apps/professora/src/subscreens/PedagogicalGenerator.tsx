import { useRef, useState } from 'react'
import { ChevronLeft, FileText, FileUp, Sparkles, X } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'

interface PedagogicalGeneratorProps {
  data?: unknown
}

interface Attachment {
  id: string
  name: string
  size: number
}

const BNCC_FIELDS = [
  'O eu, o outro e o nos',
  'Corpo, gestos e movimentos',
  'Tracos, sons, cores e formas',
  'Escuta, fala, pensamento e imaginacao',
  'Espacos, tempos, quantidades, relacoes e transformacoes',
]

const AGE_GROUPS = ['0 a 1 ano', '1 a 2 anos', '2 a 3 anos', '3 a 4 anos', '4 a 5 anos']

const QUICK_DIRECTIONS = [
  'Tom acolhedor e pratico',
  'Atividades simples para sala',
  'Adaptar para criancas pequenas',
  'Incluir objetivos BNCC',
]

export default function PedagogicalGeneratorSubscreen({ data }: PedagogicalGeneratorProps) {
  const { closeSubscreen } = useNavStore()
  const { classes } = useAppStore()
  const docKind = typeof data === 'object' && data && 'docKind' in data
    ? String((data as { docKind?: string }).docKind)
    : 'Documento pedagogico'

  const [ageGroup, setAgeGroup] = useState('4 a 5 anos')
  const [selectedClass, setSelectedClass] = useState(classes[0]?.name ?? '')
  const [theme, setTheme] = useState('')
  const [objective, setObjective] = useState('')
  const [bnccFields, setBnccFields] = useState<string[]>([BNCC_FIELDS[0]])
  const [extraContext, setExtraContext] = useState('')
  const [useAnnotations, setUseAnnotations] = useState(true)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const canGenerate = theme.trim().length >= 2 && objective.trim().length >= 5

  function addDirection(text: string) {
    setExtraContext((current) => current ? `${current}\n${text}.` : `${text}.`)
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const selected = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      size: file.size,
    }))
    setAttachments((current) => {
      const ids = new Set(current.map((item) => item.id))
      return [...current, ...selected.filter((item) => !ids.has(item.id))]
    })
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((item) => item.id !== id))
  }

  function toggleBnccField(field: string) {
    setBnccFields((current) => {
      if (current.includes(field)) {
        const next = current.filter((item) => item !== field)
        return next.length ? next : current
      }

      return [...current, field]
    })
  }

  function generate() {
    if (!canGenerate) return
    setGenerating(true)
    setTimeout(() => {
      setGenerating(false)
      setGenerated(true)
    }, 1600)
  }

  const preview = createPreview({
    docKind,
    ageGroup,
    selectedClass,
    theme,
    objective,
    bnccFields,
    extraContext,
    useAnnotations,
    attachments,
  })

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <span className="font-serif text-[18px] text-gd block">{docKind}</span>
          <span className="text-[11px] text-muted">Geracao visual para educacao infantil 0 a 5 anos.</span>
        </div>
      </div>

      <div className="scroll-area px-[18px]">
        {!generated ? (
          <div className="py-5">
            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-[14px] bg-gbg border border-gp flex items-center justify-center">
                  <Sparkles size={22} color="#4F8341" strokeWidth={1.7} />
                </div>
                <div className="flex-1">
                  <h2 className="font-serif text-[20px] text-gd">Antes de gerar</h2>
                  <p className="text-[12px] text-muted leading-snug">Informe o contexto principal. Orientacoes extras e anexos sao opcionais.</p>
                </div>
              </div>
            </div>

            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Turma</label>
            <select
              className="w-full bg-white rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none"
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
            >
              {classes.map((item) => (
                <option key={item.id} value={item.name}>{item.name}</option>
              ))}
            </select>

            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Faixa etaria</label>
            <div className="flex gap-2 overflow-x-auto scrollbar-none mt-2 mb-4 pb-1">
              {AGE_GROUPS.map((item) => (
                <button
                  key={item}
                  onClick={() => setAgeGroup(item)}
                  className={`px-3 py-2 rounded-full text-xs font-bold border whitespace-nowrap ${
                    ageGroup === item ? 'bg-gm border-gm text-white' : 'bg-white border-border text-muted'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Tema</label>
            <input
              className="w-full bg-white rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none"
              placeholder="Ex: animais do jardim, cores, acolhimento, movimento..."
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
            />

            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Objetivo pedagogico</label>
            <textarea
              className="w-full min-h-[104px] resize-none bg-white rounded-app-sm border border-border px-3 py-3 mt-2 mb-4 text-[14px] outline-none leading-[1.6]"
              placeholder="Ex: estimular linguagem oral, exploracao sensorial, autonomia, socializacao..."
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
            />

            <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Campos BNCC</label>
            <div className="flex flex-col gap-2 mt-2 mb-4">
              {BNCC_FIELDS.map((item) => (
                <button
                  key={item}
                  onClick={() => toggleBnccField(item)}
                  className={`w-full rounded-app-sm border px-3 py-3 text-left text-[13px] font-bold ${
                    bnccFields.includes(item)
                      ? 'bg-gbg border-gp text-gd'
                      : 'bg-white border-border text-muted'
                  }`}
                >
                  {bnccFields.includes(item) ? '[x] ' : '+ '}
                  {item}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mb-3">
                Base do planejamento
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setUseAnnotations(true)}
                  className={`rounded-app-sm border px-3 py-3 text-left ${
                    useAnnotations ? 'bg-gbg border-gp text-gd' : 'bg-cream border-border text-muted'
                  }`}
                >
                  <span className="block text-[13px] font-bold">Usar anotacoes</span>
                  <span className="block text-[11px] mt-1">Ideias ja registradas</span>
                </button>
                <button
                  onClick={() => setUseAnnotations(false)}
                  className={`rounded-app-sm border px-3 py-3 text-left ${
                    !useAnnotations ? 'bg-gbg border-gp text-gd' : 'bg-cream border-border text-muted'
                  }`}
                >
                  <span className="block text-[13px] font-bold">Comecar do zero</span>
                  <span className="block text-[11px] mt-1">Somente este contexto</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <label className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">
                Orientacao extra
              </label>
              <textarea
                className="w-full min-h-[104px] resize-none bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] text-ink outline-none leading-[1.6]"
                placeholder="Ex: usar materiais simples, incluir brincadeira de roda, adaptar para turma agitada..."
                value={extraContext}
                onChange={(event) => setExtraContext(event.target.value)}
              />
              <div className="flex gap-2 overflow-x-auto scrollbar-none mt-3 pb-1">
                {QUICK_DIRECTIONS.map((item) => (
                  <button key={item} onClick={() => addDirection(item)} className="px-3 py-2 rounded-full text-xs font-bold border border-border bg-white text-muted whitespace-nowrap">
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-gbg flex items-center justify-center text-gm flex-shrink-0">
                  <FileUp size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-ink">Anexos de apoio</p>
                  <p className="text-[11px] text-muted leading-[1.5] mt-1">Voce pode anexar mais de um arquivo, ou gerar sem anexar nada.</p>
                  {attachments.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      {attachments.map((item) => (
                        <div key={item.id} className="bg-cream rounded-app-sm px-3 py-2 flex items-center gap-2">
                          <FileText size={16} className="text-gm flex-shrink-0" />
                          <p className="text-[12px] font-bold text-ink truncate flex-1">{item.name}</p>
                          <button onClick={() => removeAttachment(item.id)} className="w-7 h-7 rounded-full bg-white text-muted flex items-center justify-center">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(event) => handleFiles(event.target.files)}
              />
              <button onClick={() => fileInputRef.current?.click()} className="w-full mt-3 py-[11px] rounded-app-sm border-[1.5px] border-dashed border-border text-muted text-sm font-bold bg-white">
                + Anexar arquivo
              </button>
            </div>

            <button
              onClick={generate}
              disabled={!canGenerate || generating}
              className="w-full py-4 rounded-app bg-gd text-white font-bold text-[15px] border-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {generating ? <><div className="spinner !w-5 !h-5" /> Gerando com IA...</> : <><Sparkles size={18} /> Gerar com IA</>}
            </button>
          </div>
        ) : (
          <div className="py-4">
            <div className="bg-white rounded-app p-5 border border-border shadow-card mb-4">
              <pre className="whitespace-pre-wrap font-sans text-[12px] text-ink leading-[1.7]">{preview}</pre>
            </div>
            <button className="w-full py-[13px] rounded-app-sm bg-gm text-white font-bold text-sm border-none mb-2 cursor-pointer">
              Exportar / salvar documento
            </button>
            <button onClick={() => setGenerated(false)} className="w-full py-[11px] border-none bg-transparent text-muted text-sm cursor-pointer">
              Gerar novamente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function createPreview(input: {
  docKind: string
  ageGroup: string
  selectedClass: string
  theme: string
  objective: string
  bnccFields: string[]
  extraContext: string
  useAnnotations: boolean
  attachments: Attachment[]
}) {
  const base = `DOCUMENTO GERADO COM IA
Tipo: ${input.docKind}
Turma: ${input.selectedClass || 'Nao informada'}
Faixa etaria: ${input.ageGroup}
Tema: ${input.theme || '-'}
Campos BNCC: ${input.bnccFields.join(', ')}
Base: ${input.useAnnotations ? 'anotacoes e ideias registradas pela professora' : 'documento iniciado do zero'}

OBJETIVO

${input.objective || '-'}

ORIENTACAO DA PROFESSORA

${input.extraContext.trim() || 'Nenhuma orientacao extra informada.'}`

  if (input.docKind === 'Planejamento anual') {
    return `${base}

PLANEJAMENTO ANUAL

Intencionalidade:
Definir diretrizes gerais para o ano letivo, articulando BNCC, campos de experiencia, direitos de aprendizagem e Projeto Politico Pedagogico da escola.

Eixos do ano:
- convivencia, brincadeira e participacao;
- exploracao do corpo, dos espacos e dos materiais;
- comunicacao, escuta, fala, imaginação e expressao;
- autonomia, cuidado, vinculos e pertencimento;
- acompanhamento continuo do desenvolvimento infantil.

Organizacao por periodos:
- acolhimento e adaptacao;
- projetos e sequencias tematicas;
- experiencias com literatura, musica, movimento e artes;
- registros pedagogicos e comunicacao com familias;
- retomadas e avaliacao processual sem carater classificatorio.

Indicadores de acompanhamento:
Observar trajetorias individuais e coletivas, sem comparacao entre criancas, registrando avancos, interesses, desafios e necessidades de apoio.${formatAttachments(input.attachments)}`
  }

  if (input.docKind === 'Planejamento semestral') {
    return `${base}

PLANEJAMENTO SEMESTRAL

Objetivo geral:
Organizar objetivos de aprendizagem, campos de experiencia e propostas centrais para o semestre, mantendo flexibilidade para os interesses da turma.

Campos de experiencia selecionados:
${input.bnccFields.map((field) => `- ${field}`).join('\n')}

Projetos e sequencias:
- tema central: ${input.theme || 'a definir'};
- experiencias de investigacao, brincadeira e expressao;
- propostas de linguagem, movimento, arte, musica e convivencia;
- momentos de cuidado, autonomia e socializacao.

Acompanhamento:
- registros diarios e semanais;
- portfolio e evidencias de producoes;
- relatorios de desenvolvimento quando necessario;
- comunicacao cuidadosa com as familias.

Avaliação processual:
Acompanhar o desenvolvimento por meio de observacao e registros, sem classificacao, promocao ou comparacao entre criancas.${formatAttachments(input.attachments)}`
  }

  if (input.docKind === 'Planejamento mensal' || input.docKind === 'Planejamento quinzenal') {
    const period = input.docKind === 'Planejamento mensal' ? 'mes' : 'quinzena'
    return `${base}

${input.docKind.toUpperCase()}

Foco do ${period}:
${input.objective || 'Organizar propostas conectadas aos interesses da turma e aos campos de experiencia selecionados.'}

Unidades tematicas ou projeto:
- tema: ${input.theme || 'a definir'};
- perguntas disparadoras;
- materiais e espacos;
- experiencias em pequenos e grandes grupos;
- registros esperados da professora.

Sequencia de experiencias:
1. sensibilizacao e levantamento de interesses;
2. exploracao com corpo, sentidos e materiais;
3. brincadeiras, historias, musicas e rodas;
4. producoes, fotografias privadas ou registros;
5. retomada, escuta das criancas e planejamento dos proximos passos.

Recursos:
- livros, musicas, imagens e objetos reais;
- materiais nao estruturados e seguros;
- registros da rotina e anotacoes ja feitas pela professora.

Acompanhamento:
Observar participacao, interacoes, linguagem, autonomia, movimento e bem-estar da turma.${formatAttachments(input.attachments)}`
  }

  if (input.docKind === 'Planejamento semanal') {
    return `${base}

SEMANARIO PEDAGOGICO

Organizacao da semana:

Dia 1 - Acolhimento e investigacao inicial
- roda breve de conversa;
- apresentacao de objeto, imagem, musica ou historia;
- escuta das hipoteses e interesses das criancas.

Dia 2 - Exploracao sensorial
- materiais simples, seguros e adequados a faixa etaria;
- livre exploracao com acompanhamento atento;
- registro de falas, gestos e descobertas.

Dia 3 - Movimento e brincadeira
- brincadeira orientada em pequenos grupos;
- proposta corporal, musical ou simbolica;
- observacao de interacoes e autonomia.

Dia 4 - Expressao e registro
- desenho, pintura, colagem, foto privada ou relato oral;
- valorizacao do processo, nao do resultado final;
- registro pedagogico para relatorios futuros.

Dia 5 - Retomada e fechamento
- conversa sobre o que foi vivido;
- musica, historia ou combinados da rotina;
- anotacao dos proximos interesses percebidos.

OBSERVACAO

As propostas devem respeitar o tempo da crianca pequena, sem comparacoes e sem exigencia de desempenho escolar formal.${formatAttachments(input.attachments)}`
  }

  if (input.docKind === 'Plano de aula diario') {
    return `${base}

PLANO DE AULA DIARIO

Objetivo especifico:
${input.objective || 'Definir uma experiencia significativa e adequada a faixa etaria.'}

Tempo estimado:
Organizar conforme a rotina da turma, respeitando sono, alimentacao, higiene, brincadeira livre e tempos de transicao.

Materiais:
- materiais simples, seguros e acessiveis;
- recursos sensoriais, livros, musicas ou objetos relacionados ao tema;
- camera apenas para registro privado autorizado.

Desenvolvimento:
1. acolhimento e apresentacao do convite;
2. exploracao livre com observacao atenta;
3. mediacao da professora com perguntas simples;
4. registro das falas, gestos, producoes ou interacoes;
5. fechamento breve com retomada do que foi vivido.

Estrategias metodologicas:
- brincar, conviver, participar, explorar, expressar e conhecer-se;
- escuta ativa;
- respeito aos diferentes ritmos;
- adaptacoes para necessidades individuais.

Avaliacao:
Registro descritivo do envolvimento, das descobertas e das interacoes, sem nota, classificacao ou comparacao.${formatAttachments(input.attachments)}`
  }

  if (input.docKind === 'Projeto pedagogico especifico') {
    return `${base}

PROJETO PEDAGOGICO ESPECIFICO

Justificativa:
O projeto nasce do tema "${input.theme || 'informado'}" e busca transformar interesses da turma em experiencias investigativas, brincantes e documentadas.

Objetivos:
- ampliar repertorios de linguagem, movimento, arte e convivencia;
- favorecer pesquisa, curiosidade e expressao;
- integrar campos de experiencia da BNCC;
- produzir registros pedagogicos para acompanhamento e comunicacao com familias.

Etapas:
1. escuta inicial e levantamento de hipoteses;
2. exploracoes, rodas, historias, musicas e brincadeiras;
3. atividades com materiais diversos;
4. producoes e registros;
5. socializacao do percurso vivido.

Resultados esperados:
Documentar descobertas, interacoes, avancos e interesses sem transformar o projeto em produto final obrigatorio.

Avaliacao:
Observacao continua, diario de bordo, portfolio, fotos privadas autorizadas e relatorios pedagogicos quando necessario.${formatAttachments(input.attachments)}`
  }

  if (input.docKind === 'Atividade Tematica') {
    return `${base}

ATIVIDADE TEMATICA

Nome: Descobrindo ${input.theme || 'o tema'}

Materiais:
- objetos do cotidiano;
- folhas grandes ou cartolina;
- giz de cera, tinta ou materiais sensoriais;
- musica ou historia relacionada.

Como conduzir:
1. Apresente o tema em roda, com linguagem simples.
2. Convide as criancas a explorar materiais com o corpo e os sentidos.
3. Registre falas espontaneas e pequenas descobertas.
4. Finalize valorizando o percurso de cada crianca.

Intencionalidade: favorecer exploracao, linguagem oral, convivencia e autonomia.${formatAttachments(input.attachments)}`
  }

  if (input.docKind === 'Roda de Conversa') {
    return `${base}

RODA DE CONVERSA

Abertura:
- acolher as criancas pelo nome;
- apresentar um objeto, imagem ou musica relacionada ao tema.

Perguntas disparadoras:
- O que voces perceberam?
- Quem ja viu algo parecido?
- Como esse objeto/situacao faz a gente se sentir?

Conducao:
- respeitar falas curtas;
- acolher silencio e gestos;
- evitar corrigir a crianca de forma expositiva;
- registrar frases espontaneas para relatorios futuros.

Fechamento:
- retomar uma descoberta coletiva;
- cantar uma musica breve ou combinar a proxima exploracao.${formatAttachments(input.attachments)}`
  }

  return `${base}

TEXTO PEDAGOGICO

Este documento organiza o contexto informado pela professora em linguagem acolhedora, adequada a educacao infantil de 0 a 5 anos, considerando a rotina, os vinculos, as brincadeiras e o desenvolvimento integral da crianca.${formatAttachments(input.attachments)}`
}

function formatAttachments(attachments: Attachment[]) {
  if (!attachments.length) return ''
  return `\n\nANEXOS CONSIDERADOS\n\n${attachments.map((item) => `- ${item.name}`).join('\n')}`
}
