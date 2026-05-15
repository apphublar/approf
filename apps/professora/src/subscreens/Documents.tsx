import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, FileText, Search } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { listReports } from '@/services/reports'
import type { GeneratedDocument, ReportStatus } from '@/types'

interface DocumentsSubscreenProps {
  data?: unknown
}

type ReportFilter = 'all' | 'development_report' | 'planning' | 'portfolio_text' | 'general_report' | 'specialist_report' | 'other'

const FILTERS: Array<{ id: ReportFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'development_report', label: 'Rel. desenvolvimento' },
  { id: 'planning', label: 'Planejamento' },
  { id: 'portfolio_text', label: 'Portf\u00f3lio' },
]

export default function DocumentsSubscreen({ data }: DocumentsSubscreenProps) {
  const { closeSubscreen, openSubscreen } = useNavStore()
  const { classes } = useAppStore()
  const [documents, setDocuments] = useState<GeneratedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ReportFilter>(
    typeof data === 'object' && data && 'reportType' in data && typeof (data as { reportType?: string }).reportType === 'string'
      ? (((data as { reportType?: string }).reportType as ReportFilter) || 'all')
      : 'all',
  )
  const focusReportId = typeof data === 'object' && data && 'focusReportId' in data
    ? String((data as { focusReportId?: string }).focusReportId ?? '')
    : ''
  const initialStudentId = typeof data === 'object' && data && 'studentId' in data
    ? String((data as { studentId?: string }).studentId ?? '')
    : ''

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    listReports({ limit: 120 })
      .then((items) => {
        if (!active) return
        setDocuments(items)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'N\u00e3o foi poss\u00edvel carregar documentos.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const studentNames = useMemo(() => {
    const map = new Map<string, string>()
    classes.forEach((classItem) => {
      classItem.students.forEach((student) => map.set(student.id, student.name))
    })
    return map
  }, [classes])

  const classNames = useMemo(() => new Map(classes.map((item) => [item.id, item.name])), [classes])

  const versionsByStudent = useMemo(() => {
    const map = new Map<string, number>()
    documents.forEach((item) => {
      if (item.report_type !== 'development_report' || !item.student_id) return
      map.set(item.student_id, (map.get(item.student_id) ?? 0) + 1)
    })
    return map
  }, [documents])

  const visibleDocuments = useMemo(() => {
    const normalizedQuery = normalizeText(query)
    return documents.filter((doc) => {
      if (filter !== 'all' && doc.report_type !== filter) return false
      if (initialStudentId && doc.student_id !== initialStudentId) return false
      if (!normalizedQuery) return true
      const studentName = doc.student_id ? studentNames.get(doc.student_id) : ''
      const className = doc.class_id ? classNames.get(doc.class_id) : ''
      const target = `${doc.report_type} ${studentName ?? ''} ${className ?? ''} ${doc.prompt_version ?? ''}`
      return normalizeText(target).includes(normalizedQuery)
    })
  }, [documents, filter, query, studentNames, classNames])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">Meus documentos</span>
      </div>

      <div className="scroll-area px-[18px]">
        <div className="py-5">
          <div className="bg-white rounded-app p-3 border border-border shadow-card mb-4">
            <div className="flex items-center gap-2 bg-cream border border-border rounded-app-sm px-3 py-2">
              <Search size={16} className="text-muted flex-shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por tipo, crian\u00e7a, turma..."
                className="w-full bg-transparent border-none outline-none text-[13px] text-ink placeholder:text-muted"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2 mb-4">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={`px-3 py-2 rounded-full text-xs font-bold border whitespace-nowrap ${
                  filter === item.id ? 'bg-gm border-gm text-white' : 'bg-white border-border text-muted'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="bg-white rounded-app p-4 border border-border shadow-card text-[12px] text-muted">
              Carregando documentos...
            </div>
          ) : error ? (
            <div className="bg-white rounded-app p-4 border border-red-200 shadow-card text-[12px] text-red-700">
              {error}
            </div>
          ) : visibleDocuments.length === 0 ? (
            <div className="bg-white rounded-app p-4 border border-border shadow-card text-[12px] text-muted">
              Nenhum documento encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="flex flex-col gap-[11px]">
              {visibleDocuments.map((doc) => {
                const studentName = doc.student_id ? studentNames.get(doc.student_id) : null
                const className = doc.class_id ? classNames.get(doc.class_id) : null
                const isFocused = focusReportId && doc.id === focusReportId
                const versionCount = doc.student_id ? versionsByStudent.get(doc.student_id) ?? 0 : 0

                return (
                  <button
                    key={doc.id}
                    onClick={() => openSubscreen('document-detail', { reportId: doc.id })}
                    className={`bg-white rounded-app px-[15px] py-[15px] border shadow-card flex items-center gap-[13px] text-left ${
                      isFocused ? 'border-gp' : 'border-border'
                    }`}
                  >
                    <div className="w-[44px] h-[44px] rounded-[11px] flex items-center justify-center bg-gbg text-gm flex-shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-ink truncate">{formatReportType(doc.report_type)}</p>
                      <p className="text-[11px] text-muted truncate">
                        {studentName ?? 'Sem crian\u00e7a'} {'\u2022'} {className ?? 'Sem turma'}
                      </p>
                      <p className="text-[10px] text-muted mt-1">
                        {formatDateTime(doc.updated_at)} {'\u2022'} {formatStatus(doc.status)}
                        {doc.is_final_version ? ' \u2022 Vers\u00e3o final' : ''}
                        {doc.report_type === 'development_report' && versionCount > 1 ? ` \u2022 ${versionCount} vers\u00f5es` : ''}
                      </p>
                    </div>
                    <span className="text-muted text-[18px] flex-shrink-0">{'\u203a'}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatReportType(type: string) {
  switch (type) {
    case 'development_report': return 'Relat\u00f3rio de desenvolvimento'
    case 'planning': return 'Planejamento'
    case 'portfolio_text': return 'Portf\u00f3lio pedag\u00f3gico'
    case 'specialist_report': return 'Relat\u00f3rio para especialista'
    case 'general_report': return 'Relat\u00f3rio pedag\u00f3gico'
    default: return type
  }
}

function formatStatus(status: ReportStatus) {
  switch (status) {
    case 'draft': return 'Rascunho'
    case 'generating': return 'Gerando'
    case 'ready': return 'Pronto'
    case 'failed': return 'Falhou'
    case 'archived': return 'Arquivado'
    default: return status
  }
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}
