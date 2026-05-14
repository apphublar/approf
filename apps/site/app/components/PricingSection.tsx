'use client'

import { useState } from 'react'
import { Check, CreditCard, Calendar, X, Gift } from 'lucide-react'

const WHATSAPP_URL =
  'https://wa.me/5511948268902?text=Ola%2C%20quero%20comecar%20meu%20teste%20gratis%20do%20Approf.'

const allFeatures = [
  'Anotacoes ilimitadas',
  'Turmas e perfil de alunos',
  'Calendario pedagogico',
  'Comunidade de professoras',
  'Biblioteca de material de apoio',
  'Documentos pessoais seguros',
  'Relatorios com IA incluidos',
  'Conquistas e gamificacao',
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

  return (
    <section id="precos" className="pricing">
      <div className="container">
        <div className="section-header">
          <h2>Simples assim</h2>
          <p>Sem fidelidade. Cancele quando quiser.</p>
        </div>

        <div className="pricing-toggle" role="group" aria-label="Periodo de cobranca">
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
              <Gift size={13} strokeWidth={2} /> 2 meses gratis
            </span>
          </button>
        </div>

        <div className="pricing__single">
          <div className="pricing-card">
            <div className="pricing-badge">
              {isAnnual ? (
                <><Gift size={13} strokeWidth={2} /> 2 meses gratis</>
              ) : (
                '15 dias gratis'
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
              <span className="pricing-period">/mes</span>
            </div>

            {isAnnual && (
              <p className="pricing-annual-note">
                R$ 369,00 cobrado uma vez por ano
              </p>
            )}

            <p className="pricing-tagline">
              {isAnnual
                ? 'Voce paga 10 meses e usa o ano todo.'
                : 'Tudo incluso. Sem planos diferentes.'}
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

            <a href={WHATSAPP_URL} className="pricing-cta-btn" target="_blank" rel="noopener noreferrer">
              Comecar pelo WhatsApp
            </a>
          </div>
        </div>

        <div className="pricing-payment-info">
          <div className="pricing-payment-item">
            <CreditCard size={14} strokeWidth={1.8} />
            <span>Cartao de credito e Pix aceitos</span>
          </div>
          <div className="pricing-payment-item">
            <Calendar size={14} strokeWidth={1.8} />
            <span>Cobranca mensal ou anual, sem fidelidade</span>
          </div>
          <div className="pricing-payment-item">
            <X size={14} strokeWidth={2} />
            <span>Cancele quando quiser, sem multa</span>
          </div>
        </div>

        <p className="pricing-security">
          Pagamento processado com seguranca. Seus dados estao protegidos.
        </p>
      </div>
    </section>
  )
}
