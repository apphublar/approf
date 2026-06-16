import { NextResponse } from 'next/server'
import {
  handleStripeCheckoutSessionCompleted,
  handleStripeSubscriptionDeleted,
  handleStripeSubscriptionEvent,
} from '@/app/lib/stripe-subscriptions'
import { getStripeClient, getStripeWebhookSecret } from '@/app/lib/stripe'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const stripe = getStripeClient()
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Assinatura Stripe ausente.' }, { status: 400 })
  }

  const payload = await request.text()

  let event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, getStripeWebhookSecret())
  } catch (error) {
    console.error('[stripe/webhook] assinatura inválida', error)
    return NextResponse.json({ error: 'Webhook inválido.' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleStripeCheckoutSessionCompleted(event.data.object)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleStripeSubscriptionEvent(event.data.object)
        break
      case 'customer.subscription.deleted':
        await handleStripeSubscriptionDeleted(event.data.object)
        break
      default:
        break
    }
  } catch (error) {
    console.error(`[stripe/webhook] erro ao processar ${event.type}`, error)
    return NextResponse.json({ error: 'Falha ao processar webhook.' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
