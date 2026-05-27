import {
  PenLine,
  Users,
  Sparkles,
  MessageCircle,
  ClipboardCheck,
  Image,
  ArrowDown,
  CalendarDays,
  FileText,
  ListChecks,
  BookOpenCheck,
} from 'lucide-react'
import Navbar from './components/Navbar'
import PricingSection from './components/PricingSection'
import { ApprofApple, ApprofLogoText } from './components/Logo'

const PROFESSORA_APP_URL = process.env.NEXT_PUBLIC_PROFESSORA_APP_URL ?? 'https://app.approf.com.br'
const APP_SIGNUP_URL = `${PROFESSORA_APP_URL.replace(/\/$/, '')}?mode=signup`

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
    desc: 'Crie turmas, adicione alunos, acompanhe a lista de chamada e veja o histórico completo de cada criança.',
  },
  {
    icon: <Sparkles size={22} strokeWidth={1.8} />,
    title: 'Documentos pedagógicos com IA',
    desc: 'Gere relatórios, pareceres, portfólios, planejamentos e projetos a partir dos registros da rotina.',
  },
  {
    icon: <ClipboardCheck size={22} strokeWidth={1.8} />,
    title: 'Intervenções individualizadas',
    desc: 'Transforme observações em propostas de intervenção pedagógica para acompanhar melhor cada criança.',
  },
  {
    icon: <MessageCircle size={22} strokeWidth={1.8} />,
    title: 'Chat com IA para dúvidas e ideias',
    desc: 'Converse com a IA para tirar dúvidas, pensar estratégias, adaptar atividades e organizar ideias.',
  },
  {
    icon: <Image size={22} strokeWidth={1.8} />,
    title: 'Imagem e material de apoio',
    desc: 'Crie imagens pedagógicas, acesse materiais de apoio e compartilhe recursos com outras professoras.',
  },
]

const highlights = [
  {
    icon: <ListChecks size={20} strokeWidth={1.9} />,
    title: 'Rotina organizada',
    desc: 'Turmas, alunos, chamada, calendário e registros em uma única visão.',
  },
  {
    icon: <FileText size={20} strokeWidth={1.9} />,
    title: 'Documentação pronta',
    desc: 'Relatórios, portfólios, pareceres, planejamentos e projetos com apoio da IA.',
  },
  {
    icon: <BookOpenCheck size={20} strokeWidth={1.9} />,
    title: 'Apoio pedagógico',
    desc: 'Intervenções, materiais compartilhados, imagens pedagógicas e chat para ideias.',
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
            O app completo para a rotina da professora
          </h1>

          {/* Subtítulo */}
          <p className="hero__sub">
            Organize turmas, acompanhe crianças, registre observações e gere
            documentos pedagógicos com IA, tudo em um só lugar.
          </p>

          {/* CTAs */}
          <div className="hero__actions">
            <a href={APP_SIGNUP_URL} className="btn-primary">
              Testar grátis por 7 dias
            </a>
            <a href="#como-funciona" className="btn-secondary">
              Ver como funciona
              <ArrowDown size={16} strokeWidth={2} />
            </a>
          </div>

          <p className="hero__caption">
            Educação Infantil · 0 a 5 anos · direto no celular
          </p>
        </section>

        {/* ==============================
            O PROBLEMA REAL
            ============================== */}
        <section className="problem">
          <div className="container">
            <p className="problem__text">
              Relatório atrasado, chamada em outro lugar, anotação perdida,
              intervenção sem acompanhamento e material espalhado.{' '}
              <strong>O Approf reúne a rotina pedagógica em um fluxo simples.</strong>
            </p>
          </div>
        </section>

        <section className="highlights" aria-label="Principais benefícios">
          <div className="container highlights__grid">
            {highlights.map((item) => (
              <div className="highlight-card" key={item.title}>
                <div className="highlight-card__icon">{item.icon}</div>
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ==============================
            COMO FUNCIONA — 3 PASSOS
            ============================== */}
        <section id="como-funciona" className="how-it-works">
          <div className="container">
            <div className="section-header">
              <h2>Como o Approf funciona na rotina</h2>
              <p>
                Do cadastro da turma aos documentos com IA, tudo fica conectado
                em um só lugar.
              </p>
            </div>

            <div className="steps">
              {/* Passo 1 */}
              <div className="step">
                <div className="step__num">1</div>
                <div className="step__icon">
                  <Users size={28} strokeWidth={1.8} />
                </div>
                <h3 className="step__title">Organize sua turma</h3>
                <p className="step__desc">
                  Cadastre turmas e alunos, acompanhe a lista de chamada,
                  mantenha o perfil de cada criança e visualize tudo com
                  rapidez.
                </p>
              </div>

              <StepArrow />

              {/* Passo 2 */}
              <div className="step">
                <div className="step__num">2</div>
                <div className="step__icon">
                  <ClipboardCheck size={28} strokeWidth={1.8} />
                </div>
                <h3 className="step__title">Registre e acompanhe</h3>
                <p className="step__desc">
                  Faça anotações pedagógicas, use o calendário, acompanhe a
                  linha do tempo da criança e planeje intervenções quando
                  precisar.
                </p>
              </div>

              <StepArrow />

              {/* Passo 3 */}
              <div className="step">
                <div className="step__num">3</div>
                <div className="step__icon">
                  <Sparkles size={28} strokeWidth={1.8} />
                </div>
                <h3 className="step__title">Use a IA como apoio</h3>
                <p className="step__desc">
                  Gere relatórios, portfólios, planejamentos, imagens
                  pedagógicas e converse com o chat para tirar dúvidas e criar
                  ideias.
                </p>
              </div>
            </div>

            <p className="steps-hint">
              Funciona direto no celular e acompanha a professora do registro
              rápido ao documento final.
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
                As principais ferramentas da rotina pedagógica ficam juntas,
                conectadas aos registros da turma.
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
            <div className="for-who__content">
              <p className="for-who__eyebrow">Para quem é</p>
              <h2>
                Feito para professoras da
                <span>Educação Infantil</span>
              </h2>
              <p>
                O Approf apoia quem acompanha crianças de 0 a 5 anos e precisa
                transformar a rotina da sala em registros, documentos,
                planejamentos e intervenções com mais clareza.
              </p>
            </div>
            <div className="for-who__list" aria-label="Recursos principais">
              <span><CalendarDays size={16} /> Rotina e calendário</span>
              <span><Users size={16} /> Turmas e alunos</span>
              <span><Sparkles size={16} /> IA pedagógica</span>
            </div>
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
            <a href={APP_SIGNUP_URL} className="btn-primary">
              Testar grátis por 7 dias
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
            <a href="/termos" className="footer__link">
              Termos
            </a>
            <a href="/privacidade" className="footer__link">
              Privacidade
            </a>
            <a href="/cookies" className="footer__link">
              Cookies
            </a>
            <a href="/cancelamento-reembolso" className="footer__link">
              Cancelamento
            </a>
            <a href="/uso-aceitavel" className="footer__link">
              Uso aceitável
            </a>
            <a href="/protecao-criancas" className="footer__link">
              Proteção de crianças
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

    </>
  )
}
