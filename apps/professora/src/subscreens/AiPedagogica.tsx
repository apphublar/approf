import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ChevronLeft, ChevronRight, FileText, Search, Settings2, Sparkles, Upload, X } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import {
  DEFAULT_DOCUMENT_STYLE_SETTINGS,
  fontFamilyLabel,
  loadDocumentStyleSettings,
  saveDocumentStyleSettings,
  type DocumentStyleSettings,
} from '@/utils/document-style'

const AI_SECTIONS = [
  {
    title: 'Planejamentos',
    actions: [
      { title: 'Planejamento (Diário ou Semanal)', desc: 'Organize o que será feito na rotina pedagógica.', icon: 'plan', flow: 'planning' },
      { title: 'Projeto Pedagógico', desc: 'Projeto temático com objetivos, etapas, atividades e avaliação.', icon: 'portfolio', flow: 'generator' },
      { title: 'Planejamento de Reunião dos Pais', desc: 'Pauta, combinados e encaminhamentos para encontro com as famílias.', icon: 'text', flow: 'report' },
    ],
  },
  {
    title: 'Relatórios',
    actions: [
      { title: 'Relatório de Desenvolvimento', desc: 'Documente aprendizagens, avanços e próximos passos.', icon: 'chart', flow: 'report' },
      { title: 'Portfólio', desc: 'Evidências, produções, fotos e relatos da jornada.', icon: 'portfolio', flow: 'report' },
      { title: 'Diário de Bordo', desc: 'Registro pedagógico da rotina e experiências vividas.', icon: 'text', flow: 'report' },
    ],
  },
] as const

type AiAction = (typeof AI_SECTIONS)[number]['actions'][number]
type SectionTitle = (typeof AI_SECTIONS)[number]['title']

export default function AiPedagogicaSubscreen() {
  const { closeSubscreen, openSubscreen } = useNavStore()
  const { userName, schoolName } = useAppStore()
  const [query, setQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [styleSettings, setStyleSettings] = useState<DocumentStyleSettings>(() => loadDocumentStyleSettings())
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const visibleSections = useMemo(() => {
    const normalizedQuery = normalizeText(query)

    return AI_SECTIONS
      .map((section) => ({
        ...section,
        actions: section.actions.filter((action) => {
          if (!normalizedQuery) return true
          return normalizeText(`${action.title} ${action.desc} ${section.title}`).includes(normalizedQuery)
        }),
      }))
      .filter((section) => section.actions.length > 0)
  }, [query])

  const totalDocuments = AI_SECTIONS.reduce((sum, section) => sum + section.actions.length, 0)

  function handleBack() {
    closeSubscreen()
  }

  function handleAction(action: AiAction) {
    if (action.flow === 'planning') {
      openSubscreen('pedagogical-generator', { docKind: action.title })
      return
    }

    if (action.flow === 'report') {
      openSubscreen('report', {
        reportKind: action.title,
        assistantMode: action.title === 'Planejamento de Reunião dos Pais' ? 'parents-meeting' : undefined,
      })
      return
    }

    openSubscreen('pedagogical-generator', { docKind: action.title })
  }

  function updateSettings(next: Partial<DocumentStyleSettings>) {
    const merged = { ...styleSettings, ...next }
    setStyleSettings(merged)
    saveDocumentStyleSettings(merged)
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    updateSettings({ schoolLogoDataUrl: dataUrl })
    event.target.value = ''
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={handleBack} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">
          Planejamentos e Relatórios
        </span>
      </div>

      <div className="scroll-area px-[18px]">
        <>
            <div className="rounded-app p-5 mt-[14px] mb-[16px] text-white" style={{ background: 'linear-gradient(135deg,#1B4332,#4F8341)' }}>
              <p className="text-[12px] opacity-70 mb-1">Assistente pedagógica</p>
              <h2 className="font-serif text-[22px] mb-2">O que você precisa hoje?</h2>
              <p className="text-[13px] opacity-80 leading-[1.6]">
                {totalDocuments} modelos para planejar a rotina e documentar o que aconteceu.
              </p>
            </div>

            <button
              onClick={() => openSubscreen('generated-documents')}
              className="w-full bg-white rounded-app px-[15px] py-[13px] border border-border shadow-card flex items-center gap-[12px] text-left active:scale-[.98] transition-transform mb-4"
            >
              <div className="w-[42px] h-[42px] rounded-[12px] flex items-center justify-center flex-shrink-0 bg-gbg text-gm">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-ink leading-tight">Ver gerados</p>
                <p className="text-[11px] text-muted leading-snug mt-1">Histórico do mês e geral de tudo que foi criado.</p>
              </div>
              <ChevronRight size={18} className="text-muted flex-shrink-0" />
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full bg-white rounded-app px-[15px] py-[13px] border border-border shadow-card flex items-center gap-[12px] text-left active:scale-[.98] transition-transform mb-4"
            >
              <div className="w-[42px] h-[42px] rounded-[12px] flex items-center justify-center flex-shrink-0 bg-gbg text-gm">
                <Settings2 size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-ink leading-tight">Edição e Formatação</p>
                <p className="text-[11px] text-muted leading-snug mt-1">
                  {fontFamilyLabel(styleSettings.fontFamily)} • {styleSettings.fontSizePt}pt • alinhamento configurado
                </p>
              </div>
              <ChevronRight size={18} className="text-muted flex-shrink-0" />
            </button>

            <div className="bg-white rounded-app p-3 border border-border shadow-card mb-4">
              <div className="flex items-center gap-2 bg-cream border border-border rounded-app-sm px-3 py-2">
                <Search size={16} className="text-muted flex-shrink-0" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar relatório, planejamento..."
                  className="w-full bg-transparent border-none outline-none text-[13px] text-ink placeholder:text-muted"
                />
              </div>
            </div>

            {visibleSections.length > 0 ? visibleSections.map((section) => (
              <section key={section.title} className="mb-6">
                <div className="flex items-center justify-between gap-3 mb-[10px]">
                  <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted">
                    {section.title}
                  </p>
                  <button
                    onClick={() => openSubscreen('generated-documents', { reportTypes: getSectionReportTypes(section.title) })}
                    className="text-[11px] font-bold text-gm"
                  >
                    Histórico
                  </button>
                </div>

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
                      <ChevronRight size={18} className="text-muted flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            )) : (
              <div className="bg-white rounded-app p-5 border border-border shadow-card text-center mb-6">
                <Sparkles size={22} className="text-gm mx-auto mb-2" />
                <p className="text-[13px] font-bold text-ink">Nenhum modelo encontrado</p>
                <p className="text-[12px] text-muted mt-1 leading-[1.5]">
                  Tente buscar por planejamento, relatório, portfólio ou diário.
                </p>
              </div>
            )}

            <div className="rounded-app p-4 border border-gp mb-8" style={{ background: '#F0FAF4' }}>
              <div className="flex items-center gap-2 text-gm font-bold text-[13px] mb-1">
                <Sparkles size={15} />
                Relatórios pendentes
              </div>
              <p className="text-[12px] text-soft leading-[1.6]">
                Lucas, Sofia e Valentina já têm anotações suficientes para gerar uma primeira versão de relatório.
              </p>
            </div>
        </>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
          <div className="w-full bg-white rounded-t-[22px] border-t border-border max-h-[88vh] overflow-auto stage-fade-in">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="font-serif text-[18px] text-gd">Edição e Formatação</p>
                <button onClick={() => setSettingsOpen(false)} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted">
                  <X size={16} />
                </button>
              </div>

              <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Fonte padrão</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(['arial', 'times-new-roman'] as const).map((family) => (
                  <button
                    key={family}
                    onClick={() => updateSettings({ fontFamily: family })}
                    className={`rounded-app-sm border px-3 py-2 text-[12px] font-bold ${
                      styleSettings.fontFamily === family
                        ? 'bg-gd text-white border-gd'
                        : 'bg-white text-muted border-border'
                    }`}
                  >
                    {fontFamilyLabel(family)}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <label className="text-[12px] text-muted">
                  Tamanho da fonte
                  <input
                    type="number"
                    min={10}
                    max={16}
                    value={styleSettings.fontSizePt}
                    onChange={(event) => updateSettings({ fontSizePt: Number(event.target.value) || 12 })}
                    className="w-full mt-1 rounded-app-sm border border-border px-3 py-2 text-[13px] text-ink"
                  />
                </label>
                <label className="text-[12px] text-muted">
                  Recuo de parágrafo (cm)
                  <input
                    type="number"
                    step={0.25}
                    min={0}
                    max={2.5}
                    value={styleSettings.paragraphIndentCm}
                    onChange={(event) => updateSettings({ paragraphIndentCm: Number(event.target.value) || 0 })}
                    className="w-full mt-1 rounded-app-sm border border-border px-3 py-2 text-[13px] text-ink"
                  />
                </label>
              </div>

              <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mt-4">Espaçamento entre linhas</p>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[1, 1.15, 1.5, 2].map((spacing) => (
                  <button
                    key={spacing}
                    onClick={() => updateSettings({ lineSpacing: spacing })}
                    className={`rounded-app-sm border px-2 py-2 text-[12px] font-bold ${
                      styleSettings.lineSpacing === spacing
                        ? 'bg-gd text-white border-gd'
                        : 'bg-white text-muted border-border'
                    }`}
                  >
                    {String(spacing).replace('.', ',')}
                  </button>
                ))}
              </div>

              <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mt-4">Alinhamento padrão do corpo</p>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {([
                  { id: 'left', icon: AlignLeft },
                  { id: 'justify', icon: AlignJustify },
                  { id: 'center', icon: AlignCenter },
                  { id: 'right', icon: AlignRight },
                ] as const).map((alignOption) => (
                  <button
                    key={alignOption.id}
                    onClick={() => updateSettings({ textAlign: alignOption.id })}
                    className={`rounded-app-sm border px-2 py-2 flex items-center justify-center ${
                      styleSettings.textAlign === alignOption.id
                        ? 'bg-gd text-white border-gd'
                        : 'bg-white text-muted border-border'
                    }`}
                    aria-label={`Alinhar ${alignOption.id}`}
                  >
                    <alignOption.icon size={16} />
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 mt-4 text-[12px] text-muted">
                <input
                  type="checkbox"
                  checked={styleSettings.boldTitles}
                  onChange={(event) => updateSettings({ boldTitles: event.target.checked })}
                />
                Títulos em negrito
              </label>

              <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mt-5">Papel timbrado</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full mt-2 rounded-app-sm border border-gp bg-gbg px-3 py-3 text-[12px] font-bold text-gd flex items-center justify-center gap-2"
              >
                <Upload size={14} />
                {styleSettings.schoolLogoDataUrl ? 'Trocar logo da escola' : 'Enviar logo da escola'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />

              {styleSettings.schoolLogoDataUrl && (
                <div className="mt-3 rounded-app-sm border border-border bg-cream p-3">
                  <img src={styleSettings.schoolLogoDataUrl} alt="Logo da escola" className="h-16 object-contain mx-auto" />
                  <button
                    onClick={() => updateSettings({ schoolLogoDataUrl: null, letterheadStyle: DEFAULT_DOCUMENT_STYLE_SETTINGS.letterheadStyle })}
                    className="w-full mt-2 text-[11px] font-bold text-[#C1440E]"
                  >
                    Remover logo
                  </button>
                </div>
              )}

              {styleSettings.schoolLogoDataUrl && (
                <>
                  <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mt-4">Estilo do timbre</p>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[
                      { key: 'minimal', label: 'Minimal' },
                      { key: 'centered', label: 'Centralizado' },
                      { key: 'watermark', label: 'Marca d’água' },
                    ].map((option) => (
                      <button
                        key={option.key}
                        onClick={() => updateSettings({ letterheadStyle: option.key as DocumentStyleSettings['letterheadStyle'] })}
                        className={`rounded-app-sm border px-2 py-2 text-[11px] font-bold ${
                          styleSettings.letterheadStyle === option.key
                            ? 'bg-gd text-white border-gd'
                            : 'bg-white text-muted border-border'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-5 rounded-app-sm border border-border bg-cream p-3">
                <p className="text-[11px] font-bold text-ink mb-2">Prévia do papel</p>
                <div className="rounded-[10px] bg-white border border-border h-[220px] px-4 py-3 relative overflow-hidden">
                  {styleSettings.schoolLogoDataUrl && styleSettings.letterheadStyle === 'watermark' && (
                    <img
                      src={styleSettings.schoolLogoDataUrl}
                      alt=""
                      className="absolute inset-0 m-auto w-[70%] opacity-10 object-contain"
                    />
                  )}
                  {styleSettings.schoolLogoDataUrl && styleSettings.letterheadStyle !== 'watermark' && (
                    <div className={styleSettings.letterheadStyle === 'centered' ? 'flex justify-center' : 'flex justify-start'}>
                      <img src={styleSettings.schoolLogoDataUrl} alt="Logo da escola" className="h-10 object-contain" />
                    </div>
                  )}
                  <div className="mt-3 space-y-2">
                    <div className="h-2 bg-[#E9E9E9] rounded w-[88%]" />
                    <div className="h-2 bg-[#ECECEC] rounded w-[80%]" />
                    <div className="h-2 bg-[#F0F0F0] rounded w-[84%]" />
                    <div className="h-2 bg-[#ECECEC] rounded w-[72%]" />
                  </div>
                  <div className="absolute bottom-3 left-4 right-4 text-[10px] text-muted flex justify-between">
                    <span>{userName || 'Nome da professora'}</span>
                    <span>{schoolName || 'Nome da escola'}</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted mt-2">Rodapé automático com professora e escola em todas as páginas exportadas.</p>
              </div>

              <button
                onClick={() => setSettingsOpen(false)}
                className="w-full mt-5 py-[12px] rounded-app-sm bg-gd text-white font-bold text-[13px]"
              >
                Salvar configurações
              </button>
            </div>
          </div>
        </div>
      )}
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

function getSectionReportTypes(sectionTitle: SectionTitle) {
  if (sectionTitle === 'Planejamentos') return ['weekly_planning', 'daily_lesson_plan', 'pedagogical_project', 'parents_meeting_record']
  if (sectionTitle === 'Relatórios') return ['development_report', 'class_diary', 'portfolio_text', 'portfolio_image']
  return undefined
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler imagem.'))
    reader.readAsDataURL(file)
  })
}
