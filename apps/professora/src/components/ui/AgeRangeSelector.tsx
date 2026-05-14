interface AgeRangeSelectorProps {
  value: string
  onChange: (value: string) => void
}

const MIN_AGE = 0
const MAX_AGE = 5

export default function AgeRangeSelector({ value, onChange }: AgeRangeSelectorProps) {
  const [start, end] = parseAgeRange(value)

  function updateStart(nextValue: number) {
    const nextStart = Math.min(nextValue, end)
    onChange(formatAgeRange(nextStart, end))
  }

  function updateEnd(nextValue: number) {
    const nextEnd = Math.max(nextValue, start)
    onChange(formatAgeRange(start, nextEnd))
  }

  const startPercent = (start / MAX_AGE) * 100
  const endPercent = (end / MAX_AGE) * 100

  return (
    <div className="mt-2 mb-4 rounded-app-sm border border-border bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-[12px] font-bold text-muted">0 ano</span>
        <span className="rounded-full bg-gbg border border-gp px-3 py-1 text-[12px] font-bold text-gm">
          {formatAgeRange(start, end)}
        </span>
        <span className="text-[12px] font-bold text-muted">5 anos</span>
      </div>

      <div className="relative h-10">
        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#E7F4DE]" />
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-gm"
          style={{ left: `${startPercent}%`, right: `${100 - endPercent}%` }}
        />
        <input
          aria-label="Idade inicial"
          className="age-range-input"
          type="range"
          min={MIN_AGE}
          max={MAX_AGE}
          step={1}
          value={start}
          onChange={(event) => updateStart(Number(event.target.value))}
        />
        <input
          aria-label="Idade final"
          className="age-range-input"
          type="range"
          min={MIN_AGE}
          max={MAX_AGE}
          step={1}
          value={end}
          onChange={(event) => updateEnd(Number(event.target.value))}
        />
      </div>

      <div className="grid grid-cols-6 gap-1 text-center text-[10px] font-bold text-muted">
        {[0, 1, 2, 3, 4, 5].map((age) => (
          <button
            key={age}
            type="button"
            onClick={() => onChange(formatAgeRange(age, age))}
            className="rounded-full py-1 hover:bg-gbg"
          >
            {age}
          </button>
        ))}
      </div>
    </div>
  )
}

export function formatAgeRange(start: number, end: number) {
  if (start === end) return start === 1 ? '1 ano' : `${start} anos`
  return `${start} a ${end} anos`
}

export function parseAgeRange(value: string): [number, number] {
  const numbers = value.match(/\d+/g)?.map(Number) ?? []
  if (numbers.length >= 2) return [clampAge(numbers[0]), clampAge(numbers[1])]
  if (numbers.length === 1) {
    const age = clampAge(numbers[0])
    return [age, age]
  }

  const normalized = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (normalized.includes('bercario i') || normalized.includes('bercario ii')) return [0, 1]
  if (normalized.includes('maternal i')) return [2, 2]
  if (normalized.includes('maternal ii')) return [3, 3]
  if (normalized.includes('jardim')) return [4, 4]
  if (normalized.includes('pre-escola') || normalized.includes('pre escola')) return [5, 5]

  return [0, 5]
}

function clampAge(value: number) {
  return Math.min(MAX_AGE, Math.max(MIN_AGE, value))
}
