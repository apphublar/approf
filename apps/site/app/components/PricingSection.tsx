'use client'

import { useState } from 'react'
import { Check, CreditCard, Calendar, X, Gift } from 'lucide-react'

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
  'Comunidade de professoras',
]

function CheckIcon() {
  return (
    <span className="pricing-feature-check">
      <Check size={11} strokeWidth={2.5} />
    </span>
  )
}

export default function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false)
  const selectedPlan = isAnnual ? 'annual' : 'monthly'
  const signupUrl = `${PROFESSORA_APP_BASE_URL}?mode=signup&plan=${selectedPlan}`

  return (
    <section id="precos" className="pricing">
      <div className="container">
        <div className="section-header">
          <h2>Simples assim</h2>
          <p>Sem fidelidade. Cancele quando quiser.</p>
        </div>

        <div className="pricing-toggle" role="group" aria-label="Período de cobrança">
          <button
            className={`pricing-toggle-btn${!isAnnual ? ' pricing-toggle-btn--active' : ''}`}
            onClick={() => setIsAnnual(false)}
            aria-pressed={!isAnnual}
          >
            Mensal
          </button>
          <button
            className={`pricing-toggle-btn${isAnnual ? ' pricing-toggle-btn--active' : ''}`}
            onClick={() => setIsAnnual(true)}
            aria-pressed={isAnnual}
          >
            Anual
            <span className="pricing-toggle-badge">
              <Gift size={13} strokeWidth={2} /> 2 meses grátis
            </span>
          </button>
        </div>

        <div className="pricing__single">
          <div className="pricing-card">
            <div className="pricing-badge">
              {isAnnual ? (
                <><Gift size={13} strokeWidth={2} /> 2 meses grátis</>
              ) : (
                '7 dias grátis'
              )}
            </div>

            <div
              key={isAnnual ? 'annual' : 'monthly'}
              className="pricing-amount-row pricing-amount-animate"
            >
              <span className="pricing-currency">R$</span>
              <span className="pricing-amount">
                {isAnnual ? '30' : '36'}
              </span>
              <span className="pricing-currency">
                {isAnnual ? ',75' : ',90'}
              </span>
              <span className="pricing-period">/mês</span>
            </div>

            {isAnnual && (
              <p className="pricing-annual-note">
                R$ 369,00 cobrado uma vez por ano
              </p>
            )}

            <p className="pricing-tagline">
              {isAnnual
                ? 'Você paga 10 meses e usa o ano todo.'
                : 'Tudo incluso para registrar, planejar e acompanhar sua rotina pedagógica.'}
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

            <a href={signupUrl} className="pricing-cta-btn">
              Testar grátis por 7 dias
            </a>
          </div>
        </div>

        <div className="pricing-payment-info">
          <div className="pricing-payment-item">
            <CreditCard size={14} strokeWidth={1.8} />
            <span>Cartão de crédito e Pix aceitos</span>
          </div>
          <div className="pricing-payment-item">
            <Calendar size={14} strokeWidth={1.8} />
            <span>Cobrança mensal ou anual, sem fidelidade</span>
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
