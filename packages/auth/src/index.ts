import type { AppRole, SubscriptionStatus } from '@approf/types'

export function canAccessAdmin(role: AppRole | null | undefined) {
  return role === 'super_admin' || role === 'admin'
}

export function canAccessTeacherApp(status: SubscriptionStatus | null | undefined) {
  return status === 'trial' || status === 'active'
}

export function getPrivateChildPhotoPath(ownerId: string, studentId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
  return `${ownerId}/${studentId}/${safeName}`
}
