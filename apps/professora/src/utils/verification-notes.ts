export type VerificationNotesPayload = {
  v: 1
  schoolName: string
  period: string
  observation?: string
}

export type VerificationNotesInput = {
  schoolName: string
  period: string
  observation?: string
}

export function buildVerificationNotes(payload: VerificationNotesInput) {
  return JSON.stringify({
    v: 1,
    schoolName: payload.schoolName.trim(),
    period: payload.period.trim(),
    observation: payload.observation?.trim() || undefined,
  })
}

export function parseVerificationNotes(notes: string | null | undefined): VerificationNotesPayload | null {
  if (!notes?.trim()) return null
  try {
    const parsed = JSON.parse(notes) as Partial<VerificationNotesPayload>
    if (parsed.v === 1 && typeof parsed.schoolName === 'string' && typeof parsed.period === 'string') {
      return {
        v: 1,
        schoolName: parsed.schoolName,
        period: parsed.period,
        observation: typeof parsed.observation === 'string' ? parsed.observation : undefined,
      }
    }
  } catch {
    // notas antigas em texto livre
  }
  return null
}

export function formatVerificationNotesSummary(notes: string | null | undefined) {
  const parsed = parseVerificationNotes(notes)
  if (!parsed) return notes?.trim() || null
  const parts = [
    `Escola: ${parsed.schoolName}`,
    `Período: ${parsed.period}`,
  ]
  if (parsed.observation) parts.push(`Observação: ${parsed.observation}`)
  return parts.join(' • ')
}

function resolveSchoolNameFromList(schools: Array<{ name?: string | null }>) {
  const normalized = schools
    .map((school) => school.name?.trim())
    .filter((name): name is string => Boolean(name))
  return (
    normalized.find((name) => !/n[aã]o informad/i.test(name))
    ?? normalized[0]
    ?? null
  )
}

/** Dados exibíveis quando a validação já foi aprovada (inclui envios antigos sem JSON). */
export function resolveApprovedVerificationDetails(
  notes: string | null | undefined,
  schools: Array<{ name?: string | null }>,
): VerificationNotesPayload | null {
  const parsed = parseVerificationNotes(notes)
  if (parsed) return parsed

  const schoolName = resolveSchoolNameFromList(schools)
  const legacyObservation = notes?.trim() || undefined

  if (schoolName || legacyObservation) {
    return {
      v: 1,
      schoolName: schoolName ?? 'Escola não informada',
      period: 'Não informado no envio anterior',
      observation: legacyObservation,
    }
  }

  return null
}
