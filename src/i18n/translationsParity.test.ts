import { el } from './resources/el'
import { en } from './resources/en'

/**
 * Recursively extracts all dot-notated key paths and string values from a nested translation dictionary.
 */
function extractKeysAndValues(
  obj: Record<string, any>,
  prefix = '',
): Map<string, string> {
  const result = new Map<string, string>()

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      result.set(fullPath, value)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = extractKeysAndValues(value, fullPath)
      for (const [nestedKey, nestedVal] of nested) {
        result.set(nestedKey, nestedVal)
      }
    }
  }

  return result
}

/** Extracts all interpolation variable names {{var}} from a string. */
function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g)
  if (!matches) return []
  return matches.map((m) => m.replace(/[{}]/g, '').trim()).sort()
}

describe('Translations completeness and key parity guard (spec 0054, AC-8, decision 47.11)', () => {
  const elMap = extractKeysAndValues(el)
  const enMap = extractKeysAndValues(en)

  it('both translation files have substantial non-empty string sets', () => {
    expect(elMap.size).toBeGreaterThan(400)
    expect(enMap.size).toBeGreaterThan(400)
  })

  it('key parity: every key in English exists in Greek', () => {
    const missingInGreek: string[] = []
    for (const key of enMap.keys()) {
      if (!elMap.has(key)) {
        missingInGreek.push(key)
      }
    }
    expect(missingInGreek).toEqual([])
  })

  it('key parity: every key in Greek exists in English', () => {
    const missingInEnglish: string[] = []
    for (const key of elMap.keys()) {
      if (!enMap.has(key)) {
        missingInEnglish.push(key)
      }
    }
    expect(missingInEnglish).toEqual([])
  })

  it('no translation value is empty or only whitespace', () => {
    const emptyGreek: string[] = []
    for (const [key, value] of elMap) {
      if (!value || value.trim().length === 0) {
        emptyGreek.push(key)
      }
    }
    expect(emptyGreek).toEqual([])

    const emptyEnglish: string[] = []
    for (const [key, value] of enMap) {
      if (!value || value.trim().length === 0) {
        emptyEnglish.push(key)
      }
    }
    expect(emptyEnglish).toEqual([])
  })

  it('interpolation variables match between English and Greek for each key', () => {
    const variableMismatches: Array<{ key: string; enVars: string[]; elVars: string[] }> = []

    for (const [key, enText] of enMap) {
      const elText = elMap.get(key)
      if (!elText) continue

      const enVars = extractVariables(enText)
      const elVars = extractVariables(elText)

      if (JSON.stringify(enVars) !== JSON.stringify(elVars)) {
        variableMismatches.push({ key, enVars, elVars })
      }
    }

    expect(variableMismatches).toEqual([])
  })
})
