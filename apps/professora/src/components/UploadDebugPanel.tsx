import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import type { VisualUploadDebugStep } from '@/services/uploads'

export function UploadDebugPanel({
  title = 'Debug temporario de upload',
  steps,
}: {
  title?: string
  steps: VisualUploadDebugStep[]
}) {
  return (
    <div className="rounded-app border border-amber-300 bg-amber-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">{title}</p>
      <div className="mt-3 space-y-2">
        {steps.length === 0 ? (
          <p className="text-[11px] text-amber-700">Aguardando selecao do arquivo...</p>
        ) : (
          steps.map((step) => (
            <div key={step.id} className="flex items-start gap-2 rounded-app-sm bg-white/70 px-2 py-2">
              {step.status === 'ok' && <CheckCircle2 size={14} className="mt-[2px] shrink-0 text-green-600" />}
              {step.status === 'error' && <XCircle size={14} className="mt-[2px] shrink-0 text-red-600" />}
              {step.status === 'running' && <Loader2 size={14} className="mt-[2px] shrink-0 animate-spin text-amber-700" />}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-ink">{step.label}</p>
                {step.detail && (
                  <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-[1.45] text-muted">
                    {step.detail}
                  </pre>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
