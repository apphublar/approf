export type AppRole = 'super_admin' | 'admin' | 'teacher'

export type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'overdue'
  | 'blocked'
  | 'canceled'

export type PaymentProvider = 'manual' | 'stripe' | 'mercado_pago' | 'other'

export type AnnotationCategory =
  | 'evolucao'
  | 'plano'
  | 'portfolio'
  | 'projeto'
  | 'formacao'
  | 'carta'
  | 'atipico'

export type NotificationChannel = 'email' | 'telegram' | 'system'

export interface Profile {
  id: string
  role: AppRole
  fullName: string
  email: string
  phone?: string | null
}

export interface Subscription {
  id: string
  userId: string
  status: SubscriptionStatus
  plan: string
  provider: PaymentProvider
  trialExpiresAt?: string | null
  currentPeriodEnd?: string | null
}

export interface PrivacyStoragePath {
  bucket: 'child-photos' | 'report-exports' | 'material-files'
  path: string
}
