import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Search, ShieldCheck } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import type { ChildSearchPreview } from '@/types'
import { getAppDataMode } from '@/services/app-data'
import { listReports } from '@/services/reports'
import { searchExternalChildPreviews, submitContinuityRequest } from '@/services/continuity'
import { countPedagogicalRecords } from '@/utils/pedagogical-records'

type PreviewResult = ChildSearchPreview & { ownerId?: string; isExternal?: boolean }

export default function FindChildSubscreen() {
  const { closeSubscreen } = useNavStore()
  const { classes, annotations, userName } = useAppStore()
  const [childCode, setChildCode] = useState('')
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [externalPreviews, setExternalPreviews] = useState<PreviewResult[]>([])
  const [searchingExternal, setSearchingExternal] = useState(false)
  const [requestedId, setRequestedId] = useState<string | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [generatedByStudentId, setGeneratedByStudentId] = useState<Record<string, number>>({})

  useEffect(() => {
    const allClassIds = classes.map((item) => item.id).filter(Boolean)
    if (!allClassIds.length) {
      setGeneratedByStudentId({})
      return
    }

    let active = true
    Promise.all(
      allClassIds.map((classId) => listReports({ classId, compact: true, limit: 300 })),
    )
      .then((results) => {
        if (!active) return
        const counter: Record<string, number> = {}
        results.flat().forEach((report) => {
          if (!report.student_id || report.status === 'failed') return
          counter[report.student_id] = (counter[report.student_id] ?? 0) + 1
        })
        setGeneratedByStudentId(counter)
      })
      .catch(() => {
        if (!active) return
        setGeneratedByStudentId({})
      })

    return () => {
      active = false
    }
  }, [classes])

  useEffect(() => {
    const canSearchExternal = getAppDataMode() === 'supabase'
      && ((childCode.trim().length >= 6) || (name.trim().length >= 2))
    if (!canSearchExternal) {
      setExternalPreviews([])
      return
    }

    let active = true
    const timeout = window.setTimeout(() => {
      setSearchingExternal(true)
      setError('')
      searchExternalChildPreviews({
        childCode: childCode.trim() || undefined,
        name: name.trim() || undefined,
        birthDate: birthDate || undefined,
      })
        .then((previews) => {
          if (!active) return
          setExternalPreviews(previews)
        })
        .catch((searchError) => {
          if (!active) return
          setExternalPreviews([])
          setError(searchError instanceof Error ? searchError.message : 'Não foi possível buscar outras professoras.')
        })
        .finally(() => {
          if (active) setSearchingExternal(false)
        })
    }, 450)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [birthDate, childCode, name])

  const localPreviews: PreviewResult[] = useMemo(
    () =>
      classes.flatMap((cls) =>
        cls.students.map((student) => ({
          id: student.id,
          childCode: student.childCode ?? 'CRI-PENDENTE',
          name: student.name,
          birthDate: student.birthDate ?? '',
          school: cls.school,
          previousClass: cls.name,
          lastTeacher: userName,
          recordsCount: countPedagogicalRecords(
            student,
            annotations,
            generatedByStudentId[student.id] ?? 0,
          ),
          timelineSummary: (student.timeline ?? []).slice(0, 3).map((event) => event.title),
          isExternal: false,
        })),
      ),
    [annotations, classes, generatedByStudentId, userName],
  )

  const results = [...localPreviews, ...externalPreviews].filter((child) => {
    const byCode = childCode.trim() && child.childCode.toLowerCase().includes(childCode.trim().toLowerCase())
    const byIdentity =
      name.trim().length >= 2 &&
      child.name.toLowerCase().includes(name.trim().toLowerCase()) &&
      (!birthDate || child.birthDate === birthDate)

    return byCode || byIdentity
  })

  async function requestLink(child: PreviewResult) {
    if (!child.isExternal || submittingId) return
    setSubmittingId(child.id)
    setError('')
    setMessage('')
    try {
      if (getAppDataMode() !== 'supabase') {
        setRequestedId(child.id)
        setMessage('Solicitação registrada no modo demonstração.')
        return
      }
      await submitContinuityRequest({
        requestType: 'link',
        studentId: child.id,
        reason: 'Solicitação de vínculo pedagógico pela busca de continuidade.',
      })
      setRequestedId(child.id)
      setMessage('Solicitação enviada. O admin ou a professora atual irá revisar o pedido.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível solicitar o vínculo.')
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <span className="font-serif text-[18px] text-gd block">Buscar criança existente</span>
          <span className="text-[11px] text-muted">Continuidade pedagógica com prévia segura.</span>
        </div>
      </div>

      <div className="scroll-area px-[18px] py-[16px]">
        <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
          <label className="text-[11px] font-bold text-muted uppercase tracking-[0.08em]">Código da criança</label>
          <input
            className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mt-2 text-[14px] outline-none"
            placeholder="Ex: CRI-LUC-4F8K"
            value={childCode}
            onChange={(event) => setChildCode(event.target.value)}
          />
        </div>

        <div className="bg-white rounded-app p-4 border border-border shadow-card mb-4">
          <p className="text-[11px] font-bold text-muted uppercase tracking-[0.08em] mb-3">Sem código</p>
          <input
            className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 mb-3 text-[14px] outline-none"
            placeholder="Nome da criança"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className="w-full bg-cream rounded-app-sm border border-border px-3 py-3 text-[14px] outline-none"
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </div>

        <div className="rounded-app p-4 border border-gp mb-4" style={{ background: '#F0FAF4' }}>
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="text-gm mt-[2px] flex-shrink-0" />
            <p className="text-[12px] text-soft leading-[1.6]">
              A prévia não exibe fotos, documentos ou relatórios completos. Ela serve apenas para reconhecer se é a mesma criança.
            </p>
          </div>
        </div>

        {searchingExternal && (
          <p className="text-[12px] text-muted mb-3">Buscando correspondências em outras professoras...</p>
        )}
        {message && <p className="text-[12px] text-gm mb-3">{message}</p>}
        {error && <p className="text-[12px] text-[#C1440E] mb-3">{error}</p>}

        <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mb-[10px]">
          Possíveis correspondências
        </p>

        {results.length === 0 ? (
          <div className="bg-white rounded-app p-5 border border-border text-center">
            <Search size={22} className="text-muted mx-auto mb-2" />
            <p className="text-[13px] font-bold text-ink">Nenhuma prévia localizada</p>
            <p className="text-[12px] text-muted mt-1">Informe o código ou nome com data de nascimento.</p>
          </div>
        ) : (
          results.map((child) => (
            <article key={`${child.isExternal ? 'external' : 'local'}-${child.id}`} className="bg-white rounded-app p-4 border border-border shadow-card mb-3">
              <div className="flex justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-bold text-ink">{child.name}</h3>
                  <p className="text-[11px] text-muted mt-1">{formatDate(child.birthDate)} - {child.previousClass}</p>
                </div>
                <span className="text-[10px] font-bold text-gm bg-gbg rounded-full px-2 py-1 h-fit">{child.childCode}</span>
              </div>
              <p className="text-[12px] text-soft mt-3">{child.school} - {child.recordsCount} registros pedagógicos</p>
              <p className="text-[11px] text-muted mt-1">Professora: {child.lastTeacher}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {child.timelineSummary.map((item) => (
                  <span key={item} className="text-[10px] text-muted bg-cream rounded-full px-2 py-1 border border-border">{item}</span>
                ))}
              </div>
              {child.isExternal ? (
                <button
                  onClick={() => void requestLink(child)}
                  disabled={requestedId === child.id || submittingId === child.id}
                  className="w-full mt-3 py-[11px] rounded-app-sm bg-gm text-white text-sm font-bold disabled:opacity-50"
                >
                  {requestedId === child.id
                    ? 'Solicitação registrada'
                    : submittingId === child.id
                      ? 'Enviando...'
                      : 'Solicitar vínculo'}
                </button>
              ) : (
                <p className="text-[11px] text-muted mt-3">Esta criança já está em uma das suas turmas.</p>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  )
}

function formatDate(value: string) {
  if (!value) return 'Nascimento não informado'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}
