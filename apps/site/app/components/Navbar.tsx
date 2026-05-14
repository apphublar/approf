'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ApprofApple, ApprofLogoText } from './Logo'

const WHATSAPP_URL =
  'https://wa.me/5511948268902?text=Ola%2C%20quero%20conhecer%20o%20Approf.'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
      <div className="container navbar__inner">
        <Link href="/" className="navbar__logo">
          <ApprofApple height={36} />
          <ApprofLogoText height={20} className="navbar__logo-text" />
        </Link>

        <div className="navbar__nav">
          <a href="#como-funciona" className="navbar__link">
            Como funciona
          </a>
          <a href="#precos" className="navbar__link">
            Precos
          </a>
        </div>

        <div className="navbar__actions">
          <a href={WHATSAPP_URL} className="navbar__cta" target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </div>
      </div>
    </nav>
  )
}
