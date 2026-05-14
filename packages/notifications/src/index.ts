import type { NotificationChannel } from '@approf/types'

export type NotificationType =
  | 'welcome'
  | 'trial_expiring'
  | 'access_released'
  | 'report_ready'
  | 'payment_attention'

export interface NotificationEventInput {
  userId: string
  channel: NotificationChannel
  type: NotificationType
  payload: Record<string, unknown>
}

export function createNotificationEvent(input: NotificationEventInput) {
  return {
    user_id: input.userId,
    channel: input.channel,
    type: input.type,
    status: 'queued',
    payload: input.payload,
  }
}
