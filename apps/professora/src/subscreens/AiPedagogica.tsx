import { useMemo, useState } from 'react'
import { ChevronLeft, FileText, Search, Sparkles } from 'lucide-react'
import { useNavStore } from '@/store'

const AI_SECTIONS = [
  {
    title: 'Relatorios pedagogicos',
    actions: [
      { title: 'Relatorio de desenvolvimento', desc: 'Acompanhamento das aprendizagens sem carater classificatorio.', icon: 'chart', flow: 'report' },
      { title: 'Diario de bordo', desc: 'Registro narrativo da rotina do grupo ou da crianca.', icon: 'text', flow: 'report' },
      { title: 'Portfolio pedagogico', desc: 'Evidencias, producoes, fotos e relatos da jornada.', icon: 'portfolio', flow: 'report' },
    ],
  },
  {
    title: 'Planejamentos',
    actions: [
      { title: 'Planejamento', desc: 'Escolha anual, semestral, mensal, quinzenal, semanal ou diario.', icon: 'plan', flow: 'planning' },
    ],
  },
  {
    title: 'Especialistas e encaminhamentos',
    actions: [
      { title: 'Encaminhamento para especialista', desc: 'Documento conciso justificando avaliacao externa.', icon: 'care', flow: 'report' },
    ],
  },
  {
    title: 'Documentacao complementar',
    actions: [
      { title: 'Projeto pedagogico especifico', desc: 'Projeto tematico com objetivos, atividades e avaliacao.', icon: 'portfolio', flow: 'generator' },
      { title: 'Ficha de anamnese', desc: 'Historico, habitos, rotina e contexto familiar.', icon: 'text', flow: 'report' },
      { title: 'Registro de reuniao de pais', desc: 'Pauta, combinados e encaminhamentos com a familia.', icon: 'text', flow: 'report' },
    ],
  },
] as const

const PLANNING_PERIODS = [
  { title: 'Planejamento anual', desc: 'Diretrizes gerais alinhadas a BNCC e ao PPP.' },
  { title: 'Planejamento semestral', desc: 'Objetivos e campos de experiencia por semestre.' },
  { title: 'Planejamento mensal', desc: 'Unidades tematicas, projetos e sequencias do mes.' },
  { title: 'Planejamento quinzenal', desc: 'Organizacao especifica para duas semanas.' },
  { title: 'Planejamento semanal', desc: 'Semanario com rotina, cuidado e brincadeira.' },
  { title: 'Plano de aula diario', desc: 'Atividades do dia, objetivos, materiais e avaliacao.' },
] as const

type AiAction = (typeof AI_SECTIONS)[number]['actions'][number]
type SectionTitle = (typeof AI_SECTIONS)[number]['title'] | 'Todos'

export default function AiPedagogicaSubscreen() {
  const { closeSubscreen, openSubscreen } = useNavStore()
  const [activeSection, setActiveSection] = useState<SectionTitle>('Todos')
  const [query, setQuery] = useState('')
  const [choosingPlanningPeriod, setChoosingPlanningPeriod] = useState(false)

  const visibleSections = useMemo(() => {
    const normalizedQuery = normalizeText(query)

    return AI_SECTIONS
      .filter((section) => activeSection === 'Todos' || section.title === activeSection)
      .map((section) => ({
        ...section,
        actions: section.actions.filter((action) => {
          if (!normalizedQuery) return true
          return normalizeText(`${action.title} ${action.desc} ${section.title}`).includes(normalizedQuery)
        }),
      }))
      .filter((section) => section.actions.length > 0)
  }, [activeSection, query])

  const totalDocuments = AI_SECTIONS.reduce((sum, section) => sum + section.actions.length, 0) + PLANNING_PERIODS.length - 1

  function handleBack() {
    if (choosingPlanningPeriod) {
      setChoosingPlanningPeriod(false)
      return
    }

    closeSubscreen()
  }

  function handleAction(action: AiAction) {
    if (action.flow === 'planning') {
      setChoosingPlanningPeriod(true)
      return
    }

    if (action.flow === 'report') {
      openSubscreen('report', { reportKind: action.title })
      return
    }

    openSubscreen('pedagogical-generator', { docKind: action.title })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={handleBack} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">
          {choosingPlanningPeriod ? 'Planejamento' : 'IA Pedagogica'}
        </span>
      </div>

      <div className="scroll-area px-[18px]">
        {choosingPlanningPeriod ? (
          <div className="py-5">
            <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-[14px] bg-gbg border border-gp flex items-center justify-center text-gm">
                  <FileText size={21} />
                </div>
                <div className="flex-1">
                  <h2 className="font-serif text-[20px] text-gd">Escolha o periodo</h2>
                  <p className="text-[12px] text-muted leading-snug mt-1">
                    O planejamento agora fica unificado. Selecione o recorte para gerar o documento.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-[11px]">
              {PLANNING_PERIODS.map((period) => (
                <button
                  key={period.title}
                  onClick={() => openSubscreen('pedagogical-generator', { docKind: period.title })}
                  className="bg-white rounded-app px-[15px] py-[15px] border border-border shadow-card flex items-center gap-[13px] text-left active:scale-[.98] transition-transform"
                >
                  <div className="w-[48px] h-[48px] rounded-[13px] flex items-center justify-center flex-shrink-0 bg-gbg text-gm">
                    <FileText size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-bold text-ink leading-tight">{period.title}</h3>
                    <p className="text-[11px] text-muted leading-snug mt-1">{period.desc}</p>
                  </div>
                  <span className="text-muted text-[18px] flex-shrink-0">›</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-app p-5 mt-[14px] mb-[16px] text-white" style={{ background: 'linear-gradient(135deg,#1B4332,#4F8341)' }}>
              <p className="text-[12px] opacity-70 mb-1">Assistente pedagogica</p>
              <h2 className="font-serif text-[22px] mb-2">O que voce precisa hoje?</h2>
              <p className="text-[13px] opacity-80 leading-[1.6]">
                {totalDocuments} modelos para relatorios, planejamentos, especialistas e documentacao da educacao infantil.
              </p>
            </div>

            <div className="bg-white rounded-app p-3 border border-border shadow-card mb-4">
              <div className="flex items-center gap-2 bg-cream border border-border rounded-app-sm px-3 py-2">
                <Search size={16} className="text-muted flex-shrink-0" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar relatorio, planejamento..."
                  className="w-full bg-transparent border-none outline-none text-[13px] text-ink placeholder:text-muted"
                />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 mb-4">
              {(['Todos', ...AI_SECTIONS.map((section) => section.title)] as SectionTitle[]).map((sectionTitle) => (
                <button
                  key={sectionTitle}
                  onClick={() => setActiveSection(sectionTitle)}
                  className={`px-3 py-2 rounded-full text-xs font-bold border whitespace-nowrap ${
                    activeSection === sectionTitle
                      ? 'bg-gm border-gm text-white'
                      : 'bg-white border-border text-muted'
                  }`}
                >
                  {sectionTitle}
                </button>
              ))}
            </div>

            {visibleSections.length > 0 ? visibleSections.map((section) => (
              <section key={section.title} className="mb-6">
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-[10px]">
                  {section.title}
                </p>

                <div className="flex flex-col gap-[11px]">
                  {section.actions.map((item) => (
                    <button
                      key={item.title}
                      onClick={() => handleAction(item)}
                      className="bg-white rounded-app px-[15px] py-[15px] border border-border shadow-card flex items-center gap-[13px] text-left active:scale-[.98] transition-transform"
                    >
                      <div className="w-[48px] h-[48px] rounded-[13px] flex items-center justify-center flex-shrink-0 bg-gbg text-gm">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[14px] font-bold text-ink leading-tight">{item.title}</h3>
                        <p className="text-[11px] text-muted leading-snug mt-1">{item.desc}</p>
                      </div>
                      <span className="text-muted text-[18px] flex-shrink-0">›</span>
                    </button>
                  ))}
                </div>
              </section>
            )) : (
              <div className="bg-white rounded-app p-5 border border-border shadow-card text-center mb-6">
                <Sparkles size={22} className="text-gm mx-auto mb-2" />
                <p className="text-[13px] font-bold text-ink">Nenhum modelo encontrado</p>
                <p className="text-[12px] text-muted mt-1 leading-[1.5]">
                  Tente buscar por relatorio, planejamento, especialista ou documentacao.
                </p>
              </div>
            )}

            <div className="rounded-app p-4 border border-gp mb-8" style={{ background: '#F0FAF4' }}>
              <div className="flex items-center gap-2 text-gm font-bold text-[13px] mb-1">
                <Sparkles size={15} />
                Relatorios pendentes
              </div>
              <p className="text-[12px] text-soft leading-[1.6]">
                Lucas, Sofia e Valentina ja tem anotacoes suficientes para gerar uma primeira versao de relatorio.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}
