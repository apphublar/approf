import { useAppStore, useNavStore } from '@/store'
import { ChevronRight, School } from 'lucide-react'

export default function ClassesScreen() {
  const { classes, setActiveClass } = useAppStore()
  const { openSubscreen } = useNavStore()

  function openClass(id: string) {
    setActiveClass(id)
    openSubscreen('class-students')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-white px-[18px] pt-12 pb-[14px] border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="font-serif text-[22px] text-gd">Minhas Turmas</span>
          <button
            onClick={() => openSubscreen('new-class')}
            className="bg-gm text-white border-none rounded-full px-[14px] py-[7px] text-xs font-bold cursor-pointer"
          >
            + Turma
          </button>
        </div>
      </div>

      <div className="scroll-area px-[18px]">
        <div className="w-full bg-white rounded-app p-4 mt-[14px] mb-[14px] border border-border shadow-card">
          <p className="text-[14px] font-bold text-ink">Buscar criança existente</p>
          <p className="text-[12px] text-muted mt-1">Pesquisa local nas suas turmas. O vínculo entre professoras chega em breve.</p>
          <button
            onClick={() => openSubscreen('find-child')}
            className="w-full mt-3 py-3 rounded-app-sm bg-gm text-white text-[13px] font-bold"
          >
            Buscar nas minhas turmas
          </button>
        </div>

        <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-muted mt-[14px] mb-[10px]">
          Ano letivo 2026
        </p>

        {classes.map((cls) => (
          <button
            key={cls.id}
            onClick={() => openClass(cls.id)}
            className="w-full bg-white rounded-app px-[17px] py-[15px] mb-[11px] border border-border shadow-card flex items-center gap-[13px] active:scale-[.98] transition-transform"
          >
            <div
              className="w-12 h-12 rounded-[13px] flex items-center justify-center text-gm flex-shrink-0"
              style={{ background: cls.iconBg }}
            >
              <School size={22} />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-[15px] font-bold text-ink mb-[2px]">{cls.name}</h3>
              <p className="text-xs text-muted">{cls.shift} · {cls.school}</p>
            </div>
            <span className="bg-gbg text-gm text-xs font-bold px-[10px] py-1 rounded-full flex-shrink-0">
              {cls.students.length} alunos
            </span>
            <ChevronRight size={19} className="text-muted ml-1" />
          </button>
        ))}

        <button
          onClick={() => openSubscreen('new-class')}
          className="w-full py-[13px] px-[15px] rounded-app-sm border-[1.5px] border-dashed border-border text-center text-muted text-[13px] cursor-pointer mt-1"
        >
          + Adicionar nova turma
        </button>
      </div>
    </div>
  )
}

