export function formatBirthDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function birthDateInputToIso(value: string) {
  if (!value.trim()) return ''
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  const iso = `${year}-${month}-${day}`
  const date = new Date(`${iso}T00:00:00`)
  const isValid =
    date.getFullYear() === Number(year) &&
    date.getMonth() + 1 === Number(month) &&
    date.getDate() === Number(day)

  return isValid ? iso : null
}

export function isoToBirthDateInput(value?: string) {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return ''
  return `${day}/${month}/${year}`
}
