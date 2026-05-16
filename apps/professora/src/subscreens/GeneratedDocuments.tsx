import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, FileText, Search } from 'lucide-react'
import { useAppStore, useNavStore } from '@/store'
import { listReports } from '@/services/reports'
import type { GeneratedDocument } from '@/types'

export default function GeneratedDocumentsSubscreen() {
  const { closeSubscreen, openSubscreen } = useNavStore()
  const { classes } = useAppStore()
  const [documents, setDocuments] = useState<GeneratedDocument[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    listReports({ limit: 50 })
      .then((items) => {
        if (active) {
          setDocuments(items.filter((item) => item.status !== 'archived'))
          setError('')
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Nao foi possivel carregar documentos.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const visibleDocuments = useMemo(() => {
    const normalizedQuery = normalizeText(query)
    if (!normalizedQuery) return documents
    return documents.filter((doc) =>
      normalizeText([
        formatReportType(doc.report_type),
        findStudentName(doc.student_id, classes),
        findClassName(doc.class_id, classes),
        doc.body ?? '',
      ].join(' ')).includes(normalizedQuery),
    )
  }, [documents, query, classes])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-cream">
      <div className="bg-white flex items-center gap-3 px-[14px] pt-12 pb-3 border-b border-border flex-shrink-0">
        <button onClick={closeSubscreen} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted bg-white">
          <ChevronLeft size={18} />
        </button>
        <span className="font-serif text-[18px] text-gd flex-1">Gerados</span>
      </div>

      <div className="scroll-area px-[18px] py-5">
        <div className="bg-gbg border border-gp rounded-app p-4 mb-4">
          <p className="text-[13px] font-bold text-gd mb-2">Documentos gerados com IA</p>
          <p className="text-[12px] text-muted leading-[1.6]">
            Relatorios, planejamentos e portfolios salvos ficam aqui para visualizar, editar, arquivar ou marcar versao final.
          </p>
        </div>

        <div className="bg-white rounded-app p-3 border border-border shadow-card mb-4">
          <div className="flex items-center gap-2 bg-cream border border-border rounded-app-sm px-3 py-2">
            <Search size={16} className="text-muted flex-shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar documento..."
              className="w-full bg-transparent border-none outline-none text-[13px] text-ink placeholder:text-muted"
            />
          </div>
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
          <div className="bg-white rounded-app p-5 border border-border shadow-card text-center">
            <FileText size={24} className="text-gm mx-auto mb-2" />
            <p className="text-[13px] font-bold text-ink">Nenhum documento gerado</p>
            <p className="text-[12px] text-muted mt-1 leading-[1.5]">
              Quando voce gerar com IA, o documento salvo aparece aqui.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-[9px] pb-8">
            {visibleDocuments.map((doc) => (
              <button
                key={doc.id}
                onClick={() => openSubscreen('document-detail', { reportId: doc.id })}
                className="w-full bg-white rounded-app p-4 border border-border shadow-card flex items-start gap-3 text-left active:scale-[.98] transition-transform"
              >
                <div className="w-10 h-10 rounded-[12px] bg-gbg text-gm flex items-center justify-center flex-shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-bold text-ink leading-tight">{formatReportType(doc.report_type)}</p>
                    {doc.is_final_version && (
                      <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-[#FFF3CD] text-[#856404] flex-shrink-0">
                        Final
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted mt-1">
                    {findStudentName(doc.student_id, classes) ?? 'Sem crianca'} - {formatDate(doc.created_at)}
                  </p>
                  <p className="text-[11px] text-muted mt-1 line-clamp-2">
                    {(doc.body ?? '').slice(0, 150) || formatStatus(doc.status)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function findStudentName(studentId: string | null, classes: ReturnType<typeof useAppStore.getState>['classes']) {
  if (!studentId) return null
  for (const classItem of classes) {
    const student = classItem.students.find((item) => item.id === studentId)
    if (student) return student.name
  }
  return null
}

function findClassName(classId: string | null, classes: ReturnType<typeof useAppStore.getState>['classes']) {
  if (!classId) return null
  return classes.find((item) => item.id === classId)?.name ?? null
}

function formatReportType(type: string) {
  const labels: Record<string, string> = {
    development_report: 'Relatorio de desenvolvimento',
    planning: 'Planejamento',
    portfolio_text: 'Portfolio pedagogico',
    specialist_report: 'Encaminhamento',
    general_report: 'Relatorio pedagogico',
  }
  return labels[type] ?? 'Documento'
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    generating: 'Gerando',
    ready: 'Pronto',
    failed: 'Falhou',
    archived: 'Arquivado',
  }
  return labels[status] ?? status
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}
