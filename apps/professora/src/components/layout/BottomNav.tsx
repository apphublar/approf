import type { ReactNode } from 'react'
import type { Tab } from '@/types'
import { useNavStore, useAppStore } from '@/store'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'home',
    label: 'Início',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'annotations',
    label: 'Anotações',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    id: 'classes',
    label: 'Turmas',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    id: 'materials',
    label: 'Material',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
        <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const { activeTab, setTab } = useNavStore()
  const { annotations } = useAppStore()

  return (
    <nav
      className="absolute bottom-0 left-0 right-0 bg-white border-t border-border flex z-[100]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {TABS.map((tab) => {
        const active = activeTab === tab.id
        const badge = tab.id === 'annotations' ? annotations.length : null
        return (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-[3px] py-[9px] pb-[11px] border-none bg-transparent cursor-pointer transition-colors ${
              active ? 'text-gm' : 'text-muted'
            }`}
            style={{ fontFamily: '"DM Sans", sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {/* active dot */}
            <span
              className="w-1 h-1 rounded-full bg-gl -mt-[1px]"
              style={{ opacity: active ? 1 : 0, transition: 'opacity 0.2s' }}
            />
            {/* annotation count badge (hidden on active tab) */}
            {badge !== null && !active && (
              <span className="sr-only">{badge} anotações</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
