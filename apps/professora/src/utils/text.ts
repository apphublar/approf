const LOWERCASE_PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

export function toTitleCaseName(value: string) {
  return value
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .filter(Boolean)
    .map((part, index) => {
      if (index > 0 && LOWERCASE_PARTICLES.has(part)) return part
      return part.charAt(0).toLocaleUpperCase('pt-BR') + part.slice(1)
    })
    .join(' ')
}
