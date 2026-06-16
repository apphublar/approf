import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function getStripeClient() {
  if (stripeClient) return stripeClient
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY não configurada.')
  }
  stripeClient = new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
  })
  return stripeClient
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET não configurada.')
  }
  return secret
}

export function resolveStripeSuccessUrl() {
  const appUrl = process.env.NEXT_PUBLIC_PROFESSORA_APP_URL?.replace(/\/$/, '') || 'https://app.approf.com.br'
  return `${appUrl}?checkout=success`
}

export function resolveStripeCancelUrl() {
  const appUrl = process.env.NEXT_PUBLIC_PROFESSORA_APP_URL?.replace(/\/$/, '') || 'https://app.approf.com.br'
  return `${appUrl}?checkout=canceled`
}
