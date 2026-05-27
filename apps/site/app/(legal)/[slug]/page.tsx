import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Navbar from '../../components/Navbar'
import { ApprofApple, ApprofLogoText } from '../../components/Logo'
import { legalPageMap, legalPages } from '../../legal-content'

type PageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return legalPages.map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const page = legalPageMap.get(slug)

  if (!page) {
    return {}
  }

  return {
    title: `${page.title} | Approf`,
    description: page.subtitle,
  }
}

export default async function LegalPage({ params }: PageProps) {
  const { slug } = await params
  const page = legalPageMap.get(slug)

  if (!page) {
    notFound()
  }

  return (
    <>
      <Navbar />
      <main className="legal-page">
        <section className="legal-hero">
          <div className="container">
            <Link href="/" className="legal-back">
              Voltar para o site
            </Link>
            <p className="legal-eyebrow">Approf</p>
            <h1>{page.title}</h1>
            <p>{page.subtitle}</p>
            <span>Ultima atualizacao: {page.updatedAt}</span>
          </div>
        </section>

        <section className="legal-content">
          <div className="container legal-content__inner">
            {page.sections.map((section) => (
              <article className="legal-section" key={section.title}>
                <h2>{section.title}</h2>
                {section.body?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.items && (
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__logo">
            <ApprofApple height={36} />
            <ApprofLogoText height={20} />
          </div>
          <nav className="footer__links" aria-label="Links institucionais">
            <Link href="/termos" className="footer__link">
              Termos
            </Link>
            <Link href="/privacidade" className="footer__link">
              Privacidade
            </Link>
            <Link href="/cookies" className="footer__link">
              Cookies
            </Link>
            <Link href="/cancelamento-reembolso" className="footer__link">
              Cancelamento
            </Link>
            <Link href="/uso-aceitavel" className="footer__link">
              Uso aceitavel
            </Link>
            <Link href="/protecao-criancas" className="footer__link">
              Protecao de criancas
            </Link>
          </nav>
          <p className="footer__copy">© 2026 Approf. Todos os direitos reservados.</p>
        </div>
      </footer>
    </>
  )
}
