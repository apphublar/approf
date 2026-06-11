import type { Annotation, Student } from '@/types'

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function countStudentNotes(student: Student, annotations: Annotation[]) {
  const normalizedStudentName = normalizeText(student.name)
  const firstName = student.name.split(' ')[0] ?? ''
  const abbreviatedName = student.name.split(' ').length > 1
    ? `${firstName} ${student.name.split(' ')[1]?.[0] ?? ''}.`
    : firstName
  return annotations.filter((annotation) => {
    if (annotation.studentId === student.id) return true
    if (normalizeText(annotation.studentName ?? '') === normalizedStudentName) return true
    if (annotation.studentName === abbreviatedName) return true
    return false
  }).length
}

export function countStudentMilestones(student: Student) {
  return (student.timeline ?? []).length
}

export function countPedagogicalRecords(
  student: Student,
  annotations: Annotation[],
  generatedCount = 0,
) {
  return countStudentNotes(student, annotations) + countStudentMilestones(student) + generatedCount
}
