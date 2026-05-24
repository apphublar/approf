import type { AttendanceRecord, Student } from '@/types'

export interface StudentAttendanceSummary {
  records: AttendanceRecord[]
  absences: AttendanceRecord[]
  presences: number
  absenceCount: number
  totalCalls: number
  rate: number
}

export function getStudentAttendanceSummary(
  student: Student,
  records: AttendanceRecord[],
): StudentAttendanceSummary {
  const enrolledAt = student.enrolledAt ? toDateKey(student.enrolledAt) : ''
  const validRecords = records
    .filter((record) => !enrolledAt || record.date >= enrolledAt)
    .sort((a, b) => b.date.localeCompare(a.date))

  const absences = validRecords.filter((record) => !record.presentStudentIds.includes(student.id))
  const totalCalls = validRecords.length
  const absenceCount = absences.length
  const presences = Math.max(0, totalCalls - absenceCount)
  const rate = totalCalls > 0 ? Math.round((presences / totalCalls) * 100) : 0

  return {
    records: validRecords,
    absences,
    presences,
    absenceCount,
    totalCalls,
    rate,
  }
}

export function toDateKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
