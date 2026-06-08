import type { Annotation, Student } from '@/types'

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function countStudentNotes(student: Student, annotations: Annotation[]) {
  const normalizedStudentName = normalizeText(student.name)
  return annotations.filter((annotation) => {
    if (annotation.studentId === student.id) return true
    if (normalizeText(annotation.studentName ?? '') === normalizedStudentName) return true
    return false
  }).length
}

function countStudentMilestones(student: Student) {
  return (student.timeline ?? []).filter(
    (event) => event.type === 'marco' || normalizeText(event.title).includes('marco'),
  ).length
}

export function countPedagogicalRecords(
  student: Student,
  annotations: Annotation[],
  generatedCount = 0,
) {
  return countStudentNotes(student, annotations) + countStudentMilestones(student) + generatedCount
}
