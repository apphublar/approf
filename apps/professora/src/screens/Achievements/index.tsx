import { Award, BookOpenText, Bot, Flame, Lock, NotebookPen, School, Star, UserRoundSearch } from 'lucide-react'

const BADGES = [
  { id: 'primeira', label: 'Primeira Anotação', icon: NotebookPen, desc: 'Você fez sua primeira anotação.', unlocked: true, color: '#D8F3DC', fg: '#4F8341' },
  { id: '10ann', label: '10 Anotações', icon: BookOpenText, desc: 'Anotou 10 vezes com consistência.', unlocked: true, color: '#D8F3DC', fg: '#4F8341' },
  { id: 'turma', label: 'Primeira Turma', icon: School, desc: 'Cadastrou sua primeira turma.', unlocked: true, color: '#FFF3CD', fg: '#856404' },
  { id: '50ann', label: '50 Anotações', icon: Star, desc: 'Você chegou a 50 registros.', unlocked: false, color: '#eee', fg: '#aaa' },
  { id: '1aluno', label: 'Perfil Completo', icon: UserRoundSearch, desc: 'Completou o perfil de um aluno.', unlocked: false, color: '#eee', fg: '#aaa' },
  { id: 'ia', label: 'Relatório com IA', icon: Bot, desc: 'Gerou seu primeiro relatório com IA.', unlocked: false, color: '#eee', fg: '#aaa' },
  { id: '100ann', label: '100 Anotações', icon: Award, desc: '100 anotações registradas.', unlocked: false, color: '#eee', fg: '#aaa' },
  { id: '30dias', label: '30 dias ativo', icon: Flame, desc: 'Usou o Approf por 30 dias.', unlocked: false, color: '#eee', fg: '#aaa' },
]

export default function AchievementsScreen() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-white px-[18px] pt-12 pb-[14px] border-b border-border flex-shrink-0">
        <span className="font-serif text-[22px] text-gd">Conquistas</span>
      </div>

      <div className="scroll-area px-[18px]">
        <div className="bg-gd rounded-app p-4 mt-[14px] mb-[18px] text-center chalk-bg">
          <span className="font-chalk text-white text-xl block">3 conquistadas</span>
          <span className="font-chalk text-white/55 text-sm">{BADGES.length - 3} ainda por desbloquear</span>
        </div>

        <div className="grid grid-cols-2 gap-[11px]">
          {BADGES.map((b) => (
            <div
              key={b.id}
              className={`bg-white rounded-app p-4 border border-border flex flex-col items-center text-center gap-2 ${!b.unlocked ? 'opacity-45' : ''}`}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: b.color }}
              >
                {b.unlocked ? <b.icon size={26} color={b.fg} /> : <Lock size={24} color="#888" />}
              </div>
              <div>
                <p className="text-[12px] font-bold text-ink leading-tight">{b.label}</p>
                <p className="text-[10px] text-muted mt-[2px] leading-snug">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
