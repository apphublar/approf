export interface PedagogicalDate {
  id: string
  date: string
  title: string
  kind: 'pedagogical' | 'holiday'
}

const FIXED_DATES = [
  ['01-01', 'Confraternização Universal', 'holiday'],
  ['01-30', 'Dia da Saudade', 'pedagogical'],
  ['02-14', 'Dia da Amizade', 'pedagogical'],
  ['03-08', 'Dia Internacional da Mulher', 'pedagogical'],
  ['03-15', 'Dia da Escola', 'pedagogical'],
  ['03-21', 'Dia Internacional da Síndrome de Down', 'pedagogical'],
  ['03-22', 'Dia Mundial da Água', 'pedagogical'],
  ['04-02', 'Dia Mundial de Conscientização do Autismo', 'pedagogical'],
  ['04-18', 'Dia Nacional do Livro Infantil', 'pedagogical'],
  ['04-19', 'Dia dos Povos Indígenas', 'pedagogical'],
  ['04-21', 'Tiradentes', 'holiday'],
  ['04-22', 'Dia da Terra', 'pedagogical'],
  ['05-01', 'Dia do Trabalho', 'holiday'],
  ['05-18', 'Dia Nacional de Combate ao Abuso e Exploração Sexual de Crianças e Adolescentes', 'pedagogical'],
  ['05-22', 'Dia do Abraço', 'pedagogical'],
  ['06-05', 'Dia Mundial do Meio Ambiente', 'pedagogical'],
  ['06-24', 'São João', 'pedagogical'],
  ['07-26', 'Dia dos Avós', 'pedagogical'],
  ['08-11', 'Dia do Estudante', 'pedagogical'],
  ['08-22', 'Dia do Folclore', 'pedagogical'],
  ['09-07', 'Independência do Brasil', 'holiday'],
  ['09-21', 'Dia da Árvore', 'pedagogical'],
  ['09-25', 'Dia Nacional do Trânsito', 'pedagogical'],
  ['10-04', 'Dia dos Animais', 'pedagogical'],
  ['10-12', 'Dia das Crianças', 'holiday'],
  ['10-15', 'Dia dos Professores', 'pedagogical'],
  ['10-31', 'Dia do Saci', 'pedagogical'],
  ['11-15', 'Proclamação da República', 'holiday'],
  ['11-20', 'Dia da Consciência Negra', 'holiday'],
  ['12-10', 'Dia da Inclusão Social', 'pedagogical'],
  ['12-25', 'Natal', 'holiday'],
] as const

export function getPedagogicalDates(year: number): PedagogicalDate[] {
  const easter = getEasterDate(year)
  const carnival = addDays(easter, -47)
  const corpusChristi = addDays(easter, 60)
  const mothersDay = nthWeekdayOfMonth(year, 4, 0, 2)
  const fathersDay = nthWeekdayOfMonth(year, 7, 0, 2)

  return [
    ...FIXED_DATES.map(([monthDay, title, kind]) => ({
      id: `fixed-${monthDay}`,
      date: `${year}-${monthDay}`,
      title,
      kind,
    })),
    { id: 'carnaval', date: toIsoDate(carnival), title: 'Carnaval', kind: 'holiday' },
    { id: 'pascoa', date: toIsoDate(easter), title: 'Páscoa', kind: 'pedagogical' },
    { id: 'corpus-christi', date: toIsoDate(corpusChristi), title: 'Corpus Christi', kind: 'holiday' },
    { id: 'dia-das-maes', date: toIsoDate(mothersDay), title: 'Dia das Mães', kind: 'pedagogical' },
    { id: 'dia-dos-pais', date: toIsoDate(fathersDay), title: 'Dia dos Pais', kind: 'pedagogical' },
  ] satisfies PedagogicalDate[]
}

export function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, nth: number) {
  const date = new Date(year, monthIndex, 1)
  let count = 0
  while (date.getMonth() === monthIndex) {
    if (date.getDay() === weekday) {
      count += 1
      if (count === nth) return new Date(date)
    }
    date.setDate(date.getDate() + 1)
  }
  return new Date(year, monthIndex, 1)
}

function getEasterDate(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}
