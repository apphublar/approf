'use client'

import { useState } from 'react'
import { Bolt } from 'lucide-react'

export function GiztokensAdjustForm({
  teachers,
  defaultTeacherId,
  action,
  monthLabel,
  returnTo,
}: {
  teachers: Array<{ id: string; name: string; email: string }>
  defaultTeacherId?: string
  action: (formData: FormData) => void | Promise<void>
  monthLabel: string
  returnTo: string
}) {
  const [mode, setMode] = useState<'add' | 'set_minimum'>('add')

  return (
    <form action={action} className="form-card-v2">
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
        <Bolt size={18} color="#1c6b46" />
        <h2 style={{ margin: 0 }}>Liberar GizTokens</h2>
        <span style={{ fontSize: 12, color: '#8a948c' }}>bonus do mes atual</span>
      </div>
      <input type="hidden" name="mode" value={mode} />
      <div className="form-grid-v2">
        <div className="form-field-v2 form-field-v2-grow">
          <label htmlFor="giz-teacher">Professora</label>
          <select id="giz-teacher" name="teacherId" required defaultValue={defaultTeacherId ?? ''}>
            {!defaultTeacherId ? <option value="" disabled>Selecione...</option> : null}
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name} ({teacher.email})
              </option>
            ))}
          </select>
        </div>
        <div className="form-field-v2">
          <label>Tipo</label>
          <div className="toggle-group-v2">
            <button type="button" className={mode === 'add' ? 'is-active' : ''} onClick={() => setMode('add')}>
              Adicionar
            </button>
            <button type="button" className={mode === 'set_minimum' ? 'is-active' : ''} onClick={() => setMode('set_minimum')}>
              Definir minimo
            </button>
          </div>
        </div>
        <div className="form-field-v2" style={{ width: 130 }}>
          <label htmlFor="giz-amount">Quantidade</label>
          <input id="giz-amount" name="amount" type="number" min={1} max={100000} step={1} defaultValue={5000} required />
        </div>
        <div className="form-field-v2 form-field-v2-grow">
          <label htmlFor="giz-reason">Observacao (auditoria)</label>
          <input id="giz-reason" name="reason" placeholder="ex.: suporte ao onboarding" />
        </div>
        <input type="hidden" name="returnTo" value={returnTo} />
        <button type="submit" className="btn-primary-v2">Aplicar</button>
      </div>
      <p className="form-help-v2">
        Ciclo mensal atual ({monthLabel}). “Adicionar” soma ao saldo. “Definir minimo” garante pelo menos X (nao reduz se ja estiver acima). Gera registro em Auditoria.
      </p>
    </form>
  )
}
