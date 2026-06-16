'use client'

import { Check, CreditCard, Calendar, X, Gift, Sparkles } from 'lucide-react'

const PROFESSORA_APP_URL = process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? 'https://app.approf.com.br'
const PROFESSORA_APP_BASE_URL = PROFESSORA_APP_URL.replace(/\/$/, '')

const allFeatures = [
  'Anotações pedagógicas ilimitadas',
  'Turmas, alunos e lista de chamada',
  'Perfil e linha do tempo da criança',
  'Calendário pedagógico',
  'Relatórios, portfólios e pareceres com IA',
  'Planejamentos e projetos com IA',
  'Intervenções pedagógicas individualizadas',
  'Geração de imagens pedagógicas',
  'Chat com IA para dúvidas e ideias',
  'Materiais de apoio e compartilhamento',
  'Documentos salvos para editar e reutilizar',
  'Comunidade de professores',
]

const plans = [
  {
    id: 'monthly',
    title: 'Plano Mensal',
    badge: '7 dias grátis',
    secondaryBadge: null as string | null,
    featured: false,
    priceMain: '39,90',
    pricePeriod: '/mês',
    priceCompare: '49,90',
    billingNote: null as string | null,
    giztokens: '8.000',
  },
  {
    id: 'semiannual',
    title: 'Plano Semestral',
    badge: '2 meses grátis',
    secondaryBadge: null,
    featured: false,
    priceMain: '34,90',
    pricePeriod: 'equiv./mês',
    priceCompare: '49,90',
    billingNote: 'Valor mensal só para comparação. No cartão: cobrança única de R$ 209,40 a cada 6 meses.',
    giztokens: '9.000',
  },
  {
    id: 'annual',
    title: 'Plano Anual',
    badge: 'Mais popular',
    secondaryBadge: '4 meses grátis',
    featured: true,
    priceMain: '29,90',
    pricePeriod: 'equiv./mês',
    priceCompare: '49,90',
    billingNote: 'Valor mensal só para comparação. No cartão: cobrança única de R$ 358,80 por ano.',
    giztokens: '10.000',
  },
] as const

function CheckIcon() {
  return (
    <span className="pricing-feature-check">
      <Check size={11} strokeWidth={2.5} />
    </span>
  )
}

function buildSignupUrl(planId: string) {
  return `${PROFESSORA_APP_BASE_URL}?mode=signup&plan=${planId}&checkout=1`
}

export default function PricingSection() {
  return (
    <section id="precos" className="pricing">
      <div className="container">
        <div className="section-header">
          <h2>Simples assim</h2>
          <p>Sem fidelidade. Cancele quando quiser.</p>
        </div>

        <div className="pricing__grid">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`pricing-card${plan.featured ? ' pricing-card--featured' : ''}`}
            >
              <div className="pricing-card__badges">
                <div className="pricing-badge">
                  {plan.featured ? (
                    <><Sparkles size={13} strokeWidth={2} /> {plan.badge}</>
                  ) : plan.badge.includes('grátis') ? (
                    <><Gift size={13} strokeWidth={2} /> {plan.badge}</>
                  ) : (
                    plan.badge
                  )}
                </div>
                {plan.secondaryBadge && (
                  <div className="pricing-badge pricing-badge--secondary">
                    <Gift size={13} strokeWidth={2} /> {plan.secondaryBadge}
                  </div>
                )}
              </div>

              <p className="pricing-plan-title">{plan.title}</p>

              <div className="pricing-amount-row">
                <span className="pricing-currency">R$</span>
                <span className="pricing-amount">{plan.priceMain.split(',')[0]}</span>
                <span className="pricing-currency">,{plan.priceMain.split(',')[1]}</span>
                <span className="pricing-period">{plan.pricePeriod}</span>
              </div>

              <p className="pricing-compare-price">
                {plan.id === 'monthly' ? (
                  <>de <span>R$ {plan.priceCompare}/mês</span></>
                ) : (
                  <>comparado a <span>R$ {plan.priceCompare}/mês</span> no plano mensal</>
                )}
              </p>

              {plan.billingNote && (
                <p className="pricing-annual-note">{plan.billingNote}</p>
              )}

              <p className="pricing-giztokens">{plan.giztokens} GizTokens mensais</p>

              <p className="pricing-tagline">
                Tudo incluso para registrar, planejar e acompanhar sua rotina pedagógica.
              </p>

              <div className="pricing-divider" />

              <ul className="pricing-features-list">
                {allFeatures.map((feat) => (
                  <li key={feat} className="pricing-feature-item">
                    <CheckIcon />
                    {feat}
                  </li>
                ))}
              </ul>

              <a href={buildSignupUrl(plan.id)} className="pricing-cta-btn">
                Testar grátis por 7 dias
              </a>
            </div>
          ))}
        </div>

        <div className="pricing-payment-info">
          <div className="pricing-payment-item">
            <CreditCard size={14} strokeWidth={1.8} />
            <span>Cartão de crédito e Pix aceitos</span>
          </div>
          <div className="pricing-payment-item">
            <Calendar size={14} strokeWidth={1.8} />
            <span>Cobrança mensal, semestral ou anual, sem fidelidade</span>
          </div>
          <div className="pricing-payment-item">
            <X size={14} strokeWidth={2} />
            <span>Cancele quando quiser, sem multa</span>
          </div>
        </div>

        <p className="pricing-security">
          Pagamento processado com segurança. Seus dados estão protegidos.
        </p>
      </div>
    </section>
  )
}
