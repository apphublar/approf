import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ChevronLeft, ChevronRight, FileText, KeyRound, Settings2, Sparkles, Upload, X } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import {
  DEFAULT_DOCUMENT_STYLE_SETTINGS,
  fontFamilyLabel,
  loadDocumentStyleSettings,
  resolveDocumentExportContext,
  saveDocumentStyleSettings,
  type DocumentStyleSettings,
} from '@/utils/document-style'
import { isSupabaseAuthEnabled } from '@/services/supabase/config'
import { uploadSchoolLogo, updateTeacherProfile } from '@/services/supabase/account'
import { getCoordinatorAccessPasswordStatus, saveCoordinatorAccessPassword } from '@/services/coordinator-review'
import { generateCoordinatorAccessPassword, isValidCoordinatorAccessPassword } from '@/utils/coordinator-password'
import { listReports } from '@/services/reports'

export default function AiPedagogicaSubscreen() {
  const { closeSubscreen, openSubscreen } = useNavStore()
  const { userName, schoolName, setSchoolName, annotations, classes } = useAppStore()
  const [studentsWithDevelopmentReport, setStudentsWithDevelopmentReport] = useState<Set<string>>(() => new Set())
  const [reportSuggestionsLoaded, setReportSuggestionsLoaded] = useState(false)

  const studentsReadyForReport = useMemo(() => {
    if (!reportSuggestionsLoaded) return []
    const countByStudent = new Map<string, number>()
    for (const annotation of annotations) {
      if (!annotation.studentId) continue
      countByStudent.set(annotation.studentId, (countByStudent.get(annotation.studentId) ?? 0) + 1)
    }
    return classes.flatMap((classItem) =>
      classItem.students
        .filter((student) => !studentsWithDevelopmentReport.has(student.id) && (countByStudent.get(student.id) ?? 0) >= 3)
        .map((student) => ({
          studentId: student.id,
          studentName: student.name,
          className: classItem.name,
          annotationCount: countByStudent.get(student.id) ?? 0,
        })),
    )
  }, [annotations, classes, reportSuggestionsLoaded, studentsWithDevelopmentReport])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [coordinatorAccessOpen, setCoordinatorAccessOpen] = useState(false)
  const [coordinatorPassword, setCoordinatorPassword] = useState('')
  const [coordinatorPasswordConfigured, setCoordinatorPasswordConfigured] = useState(false)
  const [coordinatorPasswordUpdatedAt, setCoordinatorPasswordUpdatedAt] = useState<string | null>(null)
  const [coordinatorPasswordMessage, setCoordinatorPasswordMessage] = useState('')
  const [coordinatorPasswordError, setCoordinatorPasswordError] = useState('')
  const [savingCoordinatorPassword, setSavingCoordinatorPassword] = useState(false)
  const [styleSettings, setStyleSettings] = useState<DocumentStyleSettings>(() => {
    const loaded = loadDocumentStyleSettings()
    if (!loaded.schoolName && schoolName) {
      return { ...loaded, schoolName }
    }
    return loaded
  })
  const exportPreview = resolveDocumentExportContext(styleSettings, { teacherName: userName, schoolName })

  useEffect(() => {
    let active = true
    const classIds = classes.map((classItem) => classItem.id).filter(Boolean)
    if (classIds.length === 0) {
      setStudentsWithDevelopmentReport(new Set())
      setReportSuggestionsLoaded(true)
      return
    }

    setReportSuggestionsLoaded(false)
    Promise.all(classIds.map((classId) => listReports({ classId, compact: true, limit: 300 })))
      .then((groups) => {
        if (!active) return
        const studentIds = new Set<string>()
        groups.flat().forEach((report) => {
          if (report.report_type === 'development_report' && report.status !== 'archived' && report.student_id) {
            studentIds.add(report.student_id)
          }
        })
        setStudentsWithDevelopmentReport(studentIds)
        setReportSuggestionsLoaded(true)
      })
      .catch(() => {
        if (!active) return
        setStudentsWithDevelopmentReport(new Set())
        setReportSuggestionsLoaded(false)
      })

    return () => {
      active = false
    }
  }, [classes])

  useEffect(() => {
    if (!isSupabaseAuthEnabled()) return
    void getCoordinatorAccessPasswordStatus()
      .then((status) => {
        setCoordinatorPasswordConfigured(status.configured)
        setCoordinatorPasswordUpdatedAt(status.updatedAt)
      })
      .catch(() => {
        setCoordinatorPasswordConfigured(false)
        setCoordinatorPasswordUpdatedAt(null)
      })
  }, [])

  useEffect(() => {
    if (!coordinatorAccessOpen || !isSupabaseAuthEnabled()) return
    void getCoordinatorAccessPasswordStatus()
      .then((status) => {
        setCoordinatorPasswordConfigured(status.configured)
        setCoordinatorPasswordUpdatedAt(status.updatedAt)
      })
      .catch(() => {
        setCoordinatorPasswordConfigured(false)
        setCoordinatorPasswordUpdatedAt(null)
      })
  }, [coordinatorAccessOpen])

  function handleBack() {
    closeSubscreen()
  }

  function updateSettings(next: Partial<DocumentStyleSettings>) {
    const merged = { ...styleSettings, ...next }
    setStyleSettings(merged)
    saveDocumentStyleSettings(merged)
    if (typeof next.schoolName === 'string' && next.schoolName.trim()) {
      setSchoolName(next.schoolName.trim())
    }
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    updateSettings({ schoolLogoDataUrl: dataUrl })
    event.target.value = ''

    if (isSupabaseAuthEnabled()) {
      uploadSchoolLogo(file)
        .then((url) => updateTeacherProfile({ schoolLogoUrl: url }))
        .catch(() => { /* silent — logo saved locally */ })
    }
  }

  async function saveCoordinatorPassword() {
    if (!isValidCoordinatorAccessPassword(coordinatorPassword)) {
      setCoordinatorPasswordError('A senha deve ter 6 caracteres entre letras e números.')
      return
    }
    setSavingCoordinatorPassword(true)
    setCoordinatorPasswordError('')
    setCoordinatorPasswordMessage('')
    try {
      const result = await saveCoordinatorAccessPassword(coordinatorPassword)
      setCoordinatorPasswordConfigured(true)
      setCoordinatorPasswordUpdatedAt(result.updatedAt)
      setCoordinatorPasswordMessage('Senha salva. Use-a ao enviar acesso para a coordenadora.')
    } catch (error) {
      setCoordinatorPasswordError(error instanceof Error ? error.message : 'Não foi possível salvar a senha.')
    } finally {
      setSavingCoordinatorPassword(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={handleBack} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">
          Criador Pedagógico
        </span>
      </div>

      <div className="scroll-area px-[18px]">
        <>
            <div className="rounded-app p-5 mt-[14px] mb-[16px] text-white" style={{ background: 'linear-gradient(135deg,#1B4332,#4F8341)' }}>
              <p className="text-[12px] opacity-70 mb-1">Criador Pedagógico</p>
              <h2 className="font-serif text-[22px] mb-2">O que você precisa hoje?</h2>
              <p className="text-[13px] opacity-80 leading-[1.6]">
                Crie relatórios, planejamentos, diários, portfólios ou documentos livres a partir do título, das suas instruções e das anotações autorizadas.
              </p>
            </div>

            <button
              onClick={() => openSubscreen('report', { mode: 'guided' })}
              className="w-full bg-white rounded-app px-[15px] py-[15px] border border-border shadow-card flex items-center gap-[13px] text-left active:scale-[.98] transition-transform mb-4"
            >
              <div className="w-[44px] h-[44px] rounded-[11px] flex items-center justify-center flex-shrink-0 text-gm" style={{ background: '#D8F3DC' }}>
                <Sparkles size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-bold text-ink leading-tight">Criar documento</h3>
                <p className="text-[12px] text-muted leading-snug mt-1">
                  Informe o título, escolha se usa anotações e descreva exatamente o que deseja.
                </p>
              </div>
              <ChevronRight size={18} className="text-muted flex-shrink-0" />
            </button>

            <button
              onClick={() => setCoordinatorAccessOpen(true)}
              className="w-full bg-white rounded-app px-[15px] py-[15px] border border-border shadow-card flex items-center gap-[13px] text-left active:scale-[.98] transition-transform mb-4"
            >
              <div className="w-[44px] h-[44px] rounded-[11px] flex items-center justify-center flex-shrink-0 text-gm" style={{ background: '#FFF3CD' }}>
                <KeyRound size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-bold text-ink leading-tight">Acesso Coordenadora</h3>
                <p className="text-[12px] text-muted leading-snug mt-1">
                  {coordinatorPasswordConfigured ? 'Senha configurada para compartilhamentos' : 'Defina a senha usada pela coordenadora'}
                </p>
              </div>
              <ChevronRight size={18} className="text-muted flex-shrink-0" />
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full bg-white rounded-app px-[15px] py-[15px] border border-border shadow-card flex items-center gap-[13px] text-left active:scale-[.98] transition-transform mb-4"
            >
              <div className="w-[44px] h-[44px] rounded-[11px] flex items-center justify-center flex-shrink-0 text-gm" style={{ background: '#E3D5F5' }}>
                <Settings2 size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-bold text-ink leading-tight">Edição e Formatação</h3>
                <p className="text-[12px] text-muted leading-snug mt-1">
                  {fontFamilyLabel(styleSettings.fontFamily)} • {styleSettings.fontSizePt}pt • alinhamento configurado
                </p>
              </div>
              <ChevronRight size={18} className="text-muted flex-shrink-0" />
            </button>

            <button
              onClick={() => openSubscreen('generated-documents')}
              className="w-full bg-white rounded-app px-[15px] py-[15px] border border-border shadow-card flex items-center gap-[13px] text-left active:scale-[.98] transition-transform mb-4"
            >
              <div className="w-[44px] h-[44px] rounded-[11px] flex items-center justify-center flex-shrink-0 text-gm" style={{ background: '#D0E8FF' }}>
                <FileText size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-bold text-ink leading-tight">Ver gerados</h3>
                <p className="text-[12px] text-muted leading-snug mt-1">Histórico do mês e geral de tudo que foi criado.</p>
              </div>
              <ChevronRight size={18} className="text-muted flex-shrink-0" />
            </button>

            <div className="rounded-app p-4 border border-gp mb-8" style={{ background: '#F0FAF4' }}>
              <div className="flex items-center gap-2 text-gm font-bold text-[13px] mb-1">
                <Sparkles size={15} />
                {studentsReadyForReport.length > 0
                  ? studentsReadyForReport.length === 1
                    ? '1 relatório pendente'
                    : `${studentsReadyForReport.length} relatórios pendentes`
                  : 'Relatórios pedagógicos'}
              </div>
              <p className="text-[12px] text-soft leading-[1.6]">
                {studentsReadyForReport.length > 0
                  ? `${formatReadyNames(studentsReadyForReport)} já ${studentsReadyForReport.length === 1 ? 'tem' : 'têm'} anotações suficientes para gerar uma primeira versão de relatório.`
                  : 'Continue adicionando anotações. Quando uma criança tiver registros suficientes, ela aparecerá aqui como sugestão de relatório.'}
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

              <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Identificação nos documentos</p>
              <label className="block mt-2 text-[12px] text-muted">
                Nome da escola
                <input
                  value={styleSettings.schoolName}
                  onChange={(event) => updateSettings({ schoolName: event.target.value })}
                  placeholder="Ex: EMEI Professora Maria Silva"
                  className="w-full mt-1 rounded-app-sm border border-border px-3 py-2 text-[13px] text-ink"
                />
              </label>
              <label className="block mt-3 text-[12px] text-muted">
                Período (opcional)
                <input
                  value={styleSettings.schoolPeriod}
                  onChange={(event) => updateSettings({ schoolPeriod: event.target.value })}
                  placeholder="Ex: 2025 ou mar/2025 a dez/2025"
                  className="w-full mt-1 rounded-app-sm border border-border px-3 py-2 text-[13px] text-ink"
                />
              </label>
              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 text-[12px] text-muted">
                  <input
                    type="checkbox"
                    checked={styleSettings.showSchoolNameInDocuments}
                    onChange={(event) => updateSettings({ showSchoolNameInDocuments: event.target.checked })}
                  />
                  Exibir nome da escola nos relatórios e planejamentos
                </label>
                <label className="flex items-center gap-2 text-[12px] text-muted">
                  <input
                    type="checkbox"
                    checked={styleSettings.showSchoolPeriodInDocuments}
                    onChange={(event) => updateSettings({ showSchoolPeriodInDocuments: event.target.checked })}
                  />
                  Exibir período nos documentos
                </label>
                <label className="flex items-center gap-2 text-[12px] text-muted">
                  <input
                    type="checkbox"
                    checked={styleSettings.showTeacherNameInDocuments}
                    onChange={(event) => updateSettings({ showTeacherNameInDocuments: event.target.checked })}
                  />
                  Exibir nome da professora no rodapé
                </label>
              </div>

              <p className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted mt-5">Fonte padrão</p>
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
              <label className="relative w-full mt-2 rounded-app-sm border border-gp bg-gbg px-3 py-3 text-[12px] font-bold text-gd flex items-center justify-center gap-2 overflow-hidden">
                <Upload size={14} />
                <span aria-hidden="true">{styleSettings.schoolLogoDataUrl ? 'Trocar logo da escola' : 'Enviar logo da escola'}</span>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              </label>

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
                  <div className="absolute bottom-3 left-4 right-4 text-[10px] text-muted flex justify-between gap-2">
                    <span>{exportPreview.teacherName || '—'}</span>
                    <span>{exportPreview.schoolName || '—'}</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted mt-2">
                  {exportPreview.schoolPeriod
                    ? `Período: ${exportPreview.schoolPeriod}. `
                    : ''}
                  Ajuste acima o que deve aparecer nos relatórios e planejamentos exportados.
                </p>
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

      {coordinatorAccessOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
          <div className="w-full bg-white rounded-t-[22px] border-t border-border max-h-[88vh] overflow-auto stage-fade-in">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="font-serif text-[18px] text-gd">Acesso Coordenadora</p>
                <button onClick={() => setCoordinatorAccessOpen(false)} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted">
                  <X size={16} />
                </button>
              </div>

              <p className="text-[12px] text-soft leading-[1.6]">
                Defina uma senha de 6 caracteres. A coordenadora usará essa senha junto com o e-mail dela para acessar os documentos que você compartilhar.
              </p>
              <p className="text-[11px] text-muted leading-[1.5] mt-2">
                Atualize a senha sempre que quiser. Depois de mudar, reenvie o acesso para a coordenadora receber a nova senha.
              </p>

              <div className="mt-4 flex gap-2">
                <input
                  value={coordinatorPassword}
                  onChange={(event) => setCoordinatorPassword(event.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="Senha de 6 caracteres"
                  className="min-w-0 flex-1 rounded-app-sm border border-border px-3 py-3 text-[14px] tracking-[0.18em] font-bold text-ink uppercase"
                />
                <button
                  type="button"
                  onClick={() => setCoordinatorPassword(generateCoordinatorAccessPassword())}
                  className="rounded-app-sm border border-gp bg-gbg px-3 py-2 text-[11px] font-bold text-gd whitespace-nowrap"
                >
                  Gerar
                </button>
              </div>

              {coordinatorPasswordUpdatedAt && (
                <p className="text-[11px] text-muted mt-2">
                  Última atualização: {new Date(coordinatorPasswordUpdatedAt).toLocaleString('pt-BR')}
                </p>
              )}

              <button
                type="button"
                onClick={() => void saveCoordinatorPassword()}
                disabled={savingCoordinatorPassword || !coordinatorPassword.trim()}
                className="w-full mt-4 py-[12px] rounded-app-sm bg-gd text-white font-bold text-[13px] disabled:opacity-50"
              >
                {savingCoordinatorPassword ? 'Salvando...' : 'Salvar senha'}
              </button>

              {coordinatorPasswordMessage && (
                <p className="text-[12px] text-gm mt-3 leading-[1.5]">{coordinatorPasswordMessage}</p>
              )}
              {coordinatorPasswordError && (
                <p className="text-[12px] text-[#C1440E] mt-3 leading-[1.5]">{coordinatorPasswordError}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatReadyNames(students: Array<{ studentName: string }>, max = 3) {
  const names = students.slice(0, max).map((s) => s.studentName.split(' ')[0])
  const remaining = students.length - max
  let base = ''
  if (names.length === 1) base = names[0]
  else if (names.length === 2) base = `${names[0]} e ${names[1]}`
  else base = `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
  return remaining > 0 ? `${base} e mais ${remaining}` : base
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler imagem.'))
    reader.readAsDataURL(file)
  })
}
