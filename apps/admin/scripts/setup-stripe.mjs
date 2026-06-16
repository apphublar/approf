#!/usr/bin/env node
/**
 * Cria ou reutiliza produto + preços Stripe do Approf.
 *
 * Uso:
 *   1. Coloque STRIPE_SECRET_KEY em apps/admin/.env.local
 *   2. pnpm stripe:setup
 *
 * O script grava STRIPE_PRICE_* no .env.local para copiar na Vercel.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'

const __dirname = dirname(fileURLToPath(import.meta.url))
const adminRoot = resolve(__dirname, '..')
const envLocalPath = resolve(adminRoot, '.env.local')

const PRODUCT_METADATA_KEY = 'approf_product'
const PRODUCT_METADATA_VALUE = 'subscription'
const PLAN_METADATA_KEY = 'approf_plan_id'

const PLANS = [
  {
    id: 'monthly',
    envKey: 'STRIPE_PRICE_MONTHLY',
    name: 'Approf Mensal',
    amount: 3990,
    interval: 'month',
    intervalCount: 1,
    giztokensMonthly: 8000,
    description: 'R$ 39,90/mês · 8.000 GizTokens mensais · 7 dias grátis',
  },
  {
    id: 'semiannual',
    envKey: 'STRIPE_PRICE_SEMIANNUAL',
    name: 'Approf Semestral',
    amount: 20940,
    interval: 'month',
    intervalCount: 6,
    giztokensMonthly: 9000,
    description: 'R$ 209,40 a cada 6 meses · 9.000 GizTokens mensais · 7 dias grátis',
  },
  {
    id: 'annual',
    envKey: 'STRIPE_PRICE_ANNUAL',
    name: 'Approf Anual',
    amount: 35880,
    interval: 'year',
    intervalCount: 1,
    giztokensMonthly: 10000,
    description: 'R$ 358,80/ano · 10.000 GizTokens mensais · 7 dias grátis',
  },
]

const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]

function parseEnvFile(path) {
  if (!existsSync(path)) return {}
  const env = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

function upsertEnvLocal(path, entries) {
  const lines = existsSync(path) ? readFileSync(path, 'utf8').split('\n') : []
  const keys = new Set(Object.keys(entries))

  const nextLines = lines.map((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return line
    const index = trimmed.indexOf('=')
    if (index === -1) return line
    const key = trimmed.slice(0, index).trim()
    if (!keys.has(key)) return line
    const value = entries[key]
    keys.delete(key)
    return `${key}=${value}`
  })

  if (keys.size > 0) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== '') nextLines.push('')
    nextLines.push('# Stripe — gerado por pnpm stripe:setup')
    for (const key of keys) {
      nextLines.push(`${key}=${entries[key]}`)
    }
  }

  writeFileSync(path, `${nextLines.join('\n').replace(/\n+$/, '')}\n`, 'utf8')
}

function formatMoney(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function findSubscriptionProduct(stripe) {
  let startingAfter
  for (;;) {
    const page = await stripe.products.list({
      active: true,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    const match = page.data.find(
      (product) => product.metadata?.[PRODUCT_METADATA_KEY] === PRODUCT_METADATA_VALUE,
    )
    if (match) return match
    if (!page.has_more || page.data.length === 0) break
    startingAfter = page.data[page.data.length - 1]?.id
  }
  return null
}

async function findPlanPrice(stripe, productId, planId, expected) {
  let startingAfter
  for (;;) {
    const page = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    const match = page.data.find((price) => {
      if (price.metadata?.[PLAN_METADATA_KEY] !== planId) return false
      if (price.currency !== 'brl') return false
      if (price.unit_amount !== expected.amount) return false
      if (price.recurring?.interval !== expected.interval) return false
      if ((price.recurring?.interval_count ?? 1) !== expected.intervalCount) return false
      return true
    })
    if (match) return match
    if (!page.has_more || page.data.length === 0) break
    startingAfter = page.data[page.data.length - 1]?.id
  }
  return null
}

async function ensureWebhookEndpoint(stripe, webhookUrl) {
  const existing = await stripe.webhookEndpoints.list({ limit: 100 })
  const match = existing.data.find((item) => item.url === webhookUrl)
  if (match) {
    const missingEvents = WEBHOOK_EVENTS.filter((event) => !match.enabled_events.includes(event))
    if (missingEvents.length > 0) {
      await stripe.webhookEndpoints.update(match.id, {
        enabled_events: Array.from(new Set([...match.enabled_events, ...WEBHOOK_EVENTS])),
      })
      console.log(`Webhook atualizado: ${webhookUrl}`)
    } else {
      console.log(`Webhook já configurado: ${webhookUrl}`)
    }
    return match.secret ?? null
  }

  const created = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: WEBHOOK_EVENTS,
    description: 'Approf — assinaturas e checkout',
  })
  console.log(`Webhook criado: ${webhookUrl}`)
  return created.secret ?? null
}

async function main() {
  const fileEnv = parseEnvFile(envLocalPath)
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() || fileEnv.STRIPE_SECRET_KEY?.trim()

  if (!secretKey) {
    console.error('\n❌ STRIPE_SECRET_KEY não encontrada.')
    console.error('   Crie apps/admin/.env.local com:')
    console.error('   STRIPE_SECRET_KEY=sk_test_...\n')
    process.exit(1)
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' })
  const account = await stripe.accounts.retrieve()
  const mode = secretKey.startsWith('sk_live_') ? 'live' : 'test'

  console.log(`\nStripe conectado (${mode}) — ${account.settings?.dashboard?.display_name || account.email || account.id}`)

  let product = await findSubscriptionProduct(stripe)
  if (!product) {
    product = await stripe.products.create({
      name: 'Approf — Assinatura Pedagógica',
      description: 'Acesso completo ao Approf para professoras da Educação Infantil.',
      metadata: {
        [PRODUCT_METADATA_KEY]: PRODUCT_METADATA_VALUE,
        approf_app: 'professora',
      },
    })
    console.log(`Produto criado: ${product.id}`)
  } else {
    console.log(`Produto reutilizado: ${product.id}`)
  }

  const envUpdates = {}

  for (const plan of PLANS) {
    let price = await findPlanPrice(stripe, product.id, plan.id, plan)
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        currency: 'brl',
        unit_amount: plan.amount,
        recurring: {
          interval: plan.interval,
          interval_count: plan.intervalCount,
        },
        nickname: plan.name,
        metadata: {
          [PLAN_METADATA_KEY]: plan.id,
          giztokens_monthly: String(plan.giztokensMonthly),
          trial_days: '7',
        },
      })
      console.log(`Preço criado (${plan.id}): ${price.id} — ${formatMoney(plan.amount)}`)
    } else {
      console.log(`Preço reutilizado (${plan.id}): ${price.id} — ${formatMoney(plan.amount)}`)
    }
    envUpdates[plan.envKey] = price.id
  }

  upsertEnvLocal(envLocalPath, envUpdates)
  console.log(`\n✅ apps/admin/.env.local atualizado com STRIPE_PRICE_*`)

  const webhookBase =
    process.env.STRIPE_WEBHOOK_URL?.trim() ||
    fileEnv.STRIPE_WEBHOOK_URL?.trim() ||
    fileEnv.NEXT_PUBLIC_ADMIN_URL?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_URL?.trim()

  if (webhookBase) {
    const webhookUrl = `${webhookBase.replace(/\/$/, '')}/api/stripe/webhook`
    const webhookSecret = await ensureWebhookEndpoint(stripe, webhookUrl)
    if (webhookSecret) {
      upsertEnvLocal(envLocalPath, { STRIPE_WEBHOOK_SECRET: webhookSecret })
      console.log('✅ STRIPE_WEBHOOK_SECRET salvo no .env.local')
    } else {
      console.log('\nℹ️  Webhook criado. Copie o signing secret no Dashboard Stripe → Webhooks.')
    }
  } else {
    console.log('\nℹ️  Para criar webhook automaticamente, adicione no .env.local:')
    console.log('   STRIPE_WEBHOOK_URL=https://SEU-ADMIN.vercel.app')
  }

  console.log('\n── Copie para a Vercel (projeto approf-admin) ──')
  console.log(`STRIPE_SECRET_KEY=${secretKey}`)
  for (const plan of PLANS) {
    console.log(`${plan.envKey}=${envUpdates[plan.envKey]}`)
  }
  if (fileEnv.STRIPE_WEBHOOK_SECRET || parseEnvFile(envLocalPath).STRIPE_WEBHOOK_SECRET) {
    console.log(`STRIPE_WEBHOOK_SECRET=${parseEnvFile(envLocalPath).STRIPE_WEBHOOK_SECRET}`)
  }
  console.log('\nTrial: 7 dias grátis no checkout; cobrança automática após o trial.\n')
}

main().catch((error) => {
  console.error('\n❌ Falha no setup Stripe:', error instanceof Error ? error.message : error)
  process.exit(1)
})
