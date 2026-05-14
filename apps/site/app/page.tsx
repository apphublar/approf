import {
  PenLine,
  Users,
  Sparkles,
  BookOpen,
  MessageCircle,
  Trophy,
  ArrowDown,
  LayoutGrid,
} from 'lucide-react'
import Navbar from './components/Navbar'
import PricingSection from './components/PricingSection'
import { ApprofApple, ApprofLogoText } from './components/Logo'

const WHATSAPP_URL =
  'https://wa.me/5511948268902?text=Ola%2C%20quero%20comecar%20meu%20teste%20gratis%20do%20Approf.'

/* ---- Seta longa e sutil entre os passos ---- */
function StepArrow() {
  return (
    <div className="step__connector" aria-hidden="true">
      <svg
        width="80"
        height="20"
        viewBox="0 0 80 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 10H70"
          stroke="#D4EBC8"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M64 4L74 10L64 16"
          stroke="#D4EBC8"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

/* ============================================================
   FEATURES DATA
   ============================================================ */

const features = [
  {
    icon: <PenLine size={22} strokeWidth={1.8} />,
    title: 'Anote na hora que acontece',
    desc: 'Texto livre, sem formulário obrigatório. Você digita o que viu, o app separa por aluno e categoria.',
  },
  {
    icon: <Users size={22} strokeWidth={1.8} />,
    title: 'Cada aluno no seu lugar',
    desc: 'Crie suas turmas, adicione seus alunos e veja o histórico completo de cada um em um só lugar.',
  },
  {
    icon: <Sparkles size={22} strokeWidth={1.8} />,
    title: 'Relatórios prontos em segundos',
    desc: 'Suas anotações viram relatório pedagógico com um toque. A IA cuida da escrita, você cuida da turma.',
  },
  {
    icon: <BookOpen size={22} strokeWidth={1.8} />,
    title: 'Material pronto para usar hoje',
    desc: 'Planos de aula, listas de chamada e modelos editáveis. Baixe, ajuste e use na sua sala.',
  },
  {
    icon: <MessageCircle size={22} strokeWidth={1.8} />,
    title: 'Uma comunidade só sua',
    desc: 'Troque ideias com outras professoras da Educação Infantil. Sem julgamento, sem jargão técnico.',
  },
  {
    icon: <Trophy size={22} strokeWidth={1.8} />,
    title: 'O app que reconhece seu trabalho',
    desc: 'Cada registro conta. O Approf celebra cada pequena conquista da sua jornada como professora.',
  },
]

/* ============================================================
   PAGE
   ============================================================ */

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        {/* ==============================
            HERO
            ============================== */}
        <section className="hero">
          <span
            className="hero__chalk-mark hero__chalk-mark--tl"
            aria-hidden="true"
          >
            ✦
          </span>
          <span
            className="hero__chalk-mark hero__chalk-mark--br"
            aria-hidden="true"
          >
            ✦
          </span>

          {/* Eyebrow */}
          <p className="hero__eyebrow">O app da prof</p>

          {/* Headline */}
          <h1 className="hero__headline">
            Organize sua rotina, simplifique sua vida
          </h1>

          {/* Subtítulo */}
          <p className="hero__sub">
            Anotações organizadas que se transformam em relatórios completos
            com um clique. Sem esforço, sem perda de tempo.
          </p>

          {/* CTAs */}
          <div className="hero__actions">
            <a href={WHATSAPP_URL} className="btn-primary" target="_blank" rel="noopener noreferrer">
              Comecar pelo WhatsApp
            </a>
            <a href="#como-funciona" className="btn-secondary">
              Ver como funciona
              <ArrowDown size={16} strokeWidth={2} />
            </a>
          </div>

          <p className="hero__caption">
            Para professoras da Educação Infantil · 0 a 5 anos
          </p>
        </section>

        {/* ==============================
            O PROBLEMA REAL
            ============================== */}
        <section className="problem">
          <div className="container">
            <p className="problem__text">
              Relatório atrasado, anotação perdida, material que você nem
              lembra onde salvou. Acontece com toda professora.{' '}
              <strong>O Approf foi feito para acabar com isso.</strong>
            </p>
          </div>
        </section>

        {/* ==============================
            COMO FUNCIONA — 3 PASSOS
            ============================== */}
        <section id="como-funciona" className="how-it-works">
          <div className="container">
            <div className="section-header">
              <h2>Três passos. Sem complicação.</h2>
              <p>
                Você faz o que sempre fez — anotar.
                O Approf cuida do resto.
              </p>
            </div>

            <div className="steps">
              {/* Passo 1 */}
              <div className="step">
                <div className="step__num">1</div>
                <div className="step__icon">
                  <PenLine size={28} strokeWidth={1.8} />
                </div>
                <h3 className="step__title">Anote do seu jeito</h3>
                <p className="step__desc">
                  Texto livre, sem formulário, sem campo obrigatório. Escreva
                  como você pensa — sobre um aluno, uma aula, um projeto.
                  O Approf entende.
                </p>
              </div>

              <StepArrow />

              {/* Passo 2 */}
              <div className="step">
                <div className="step__num">2</div>
                <div className="step__icon">
                  <LayoutGrid size={28} strokeWidth={1.8} />
                </div>
                <h3 className="step__title">Tudo no lugar certo</h3>
                <p className="step__desc">
                  Por aluno, por turma, por categoria — organizado
                  automaticamente. Sem você mover um dedo.
                </p>
              </div>

              <StepArrow />

              {/* Passo 3 */}
              <div className="step">
                <div className="step__num">3</div>
                <div className="step__icon">
                  <Sparkles size={28} strokeWidth={1.8} />
                </div>
                <h3 className="step__title">Documento pronto com IA</h3>
                <p className="step__desc">
                  Quando precisar do relatório, a IA lê tudo que você
                  anotou e entrega o documento estruturado — pronto para
                  assinar e entregar.
                </p>
              </div>
            </div>

            <p className="steps-hint">
              E o melhor: funciona direto no celular, sem precisar baixar
              nada.
            </p>
          </div>
        </section>

        {/* ==============================
            FUNCIONALIDADES
            ============================== */}
        <section className="features">
          <div className="container">
            <div className="section-header">
              <h2>Feito para o seu dia a dia</h2>
              <p>
                Sem formulários complicados. Sem aprendizado longo.
                Você anota, o Approf organiza.
              </p>
            </div>

            <div className="features__grid">
              {features.map((f) => (
                <div key={f.title} className="feature-card">
                  <div className="feature-card__icon">{f.icon}</div>
                  <h3 className="feature-card__title">{f.title}</h3>
                  <p className="feature-card__desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==============================
            PARA QUEM É
            ============================== */}
        <section className="for-who">
          <div className="container">
            <p className="for-who__text">
              Feito para professoras da Educação Infantil.
            </p>
          </div>
        </section>

        {/* ==============================
            PREÇOS — componente client
            ============================== */}
        <PricingSection />

        {/* ==============================
            CTA FINAL — LOUSA
            ============================== */}
        <section className="cta-final">
          <div className="container cta-final__inner">
            <h2 className="cta-final__headline">
              Você merece um app feito pra você.
            </h2>
            <a href={WHATSAPP_URL} className="btn-primary" target="_blank" rel="noopener noreferrer">
              Comecar pelo WhatsApp
            </a>
            <p className="cta-final__caption">
              Sem cartão de crédito · Cancela quando quiser
            </p>
          </div>
        </section>
      </main>

      {/* ==============================
          FOOTER
          ============================== */}
      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__logo">
            <ApprofApple height={36} />
            <ApprofLogoText height={20} />
          </div>

          <p className="footer__tagline">
            Approf Educação Infantil é o primeiro app da família Approf.
            Em breve: Fundamental I e II.
          </p>

          <div className="footer__divider" />

          <nav className="footer__links" aria-label="Links do rodapé">
            <a href="/privacidade" className="footer__link">
              Privacidade
            </a>
            <a
              href="mailto:contato@approf.com.br"
              className="footer__link"
            >
              Contato
            </a>
            <a
              href="https://instagram.com/approf"
              className="footer__link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram
            </a>
          </nav>

          <p className="footer__copy">
            © 2026 Approf. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      <a
        href={WHATSAPP_URL}
        className="whatsapp-float"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar com o Approf pelo WhatsApp"
      >
        <MessageCircle size={22} strokeWidth={2} />
        WhatsApp
      </a>
    </>
  )
}
