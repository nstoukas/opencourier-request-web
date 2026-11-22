import { el } from './resources/el'
import { en } from './resources/en'
import { serverEl } from './resources/serverEl'
import { serverEn } from './resources/serverEn'

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

/** Extracts only parameter names from placeholders like {{name, format}} or {{name}}. */
function extractParamNames(text: string): string[] {
  return [...(text ?? '').matchAll(/\{\{\s*(\w+)/g)].map((m) => m[1] ?? '').sort()
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

describe('Server templates completeness and key/params parity guard (decision 124.11)', () => {
  const serverElMap = extractKeysAndValues(serverEl)
  const serverEnMap = extractKeysAndValues(serverEn)

  it('both server translation files have substantial non-empty string sets', () => {
    expect(serverElMap.size).toBeGreaterThan(150)
    expect(serverEnMap.size).toBeGreaterThan(150)
  })

  it('server key parity: every key in serverEn exists in serverEl', () => {
    const missingInGreek: string[] = []
    for (const key of serverEnMap.keys()) {
      if (!serverElMap.has(key)) {
        missingInGreek.push(key)
      }
    }
    expect(missingInGreek).toEqual([])
  })

  it('server key parity: every key in serverEl exists in serverEn', () => {
    const missingInEnglish: string[] = []
    for (const key of serverElMap.keys()) {
      if (!serverEnMap.has(key)) {
        missingInEnglish.push(key)
      }
    }
    expect(missingInEnglish).toEqual([])
  })

  it('no server translation value is empty or only whitespace', () => {
    const emptyGreek: string[] = []
    for (const [key, value] of serverElMap) {
      if (!value || value.trim().length === 0) {
        emptyGreek.push(key)
      }
    }
    expect(emptyGreek).toEqual([])

    const emptyEnglish: string[] = []
    for (const [key, value] of serverEnMap) {
      if (!value || value.trim().length === 0) {
        emptyEnglish.push(key)
      }
    }
    expect(emptyEnglish).toEqual([])
  })

  it('interpolation parameters match between serverEn and serverEl for error and notice templates', () => {
    // server.error and server.notice are the refusal and banner templates rendered in request-web
    const paramMismatches: Array<{ key: string; enParams: string[]; elParams: string[] }> = []

    for (const [key, enText] of serverEnMap) {
      if (!key.startsWith('server.error.') && !key.startsWith('server.notice.')) continue

      const elText = serverElMap.get(key)
      if (!elText) continue

      const enParams = extractParamNames(enText)
      const elParams = extractParamNames(elText)

      if (JSON.stringify(enParams) !== JSON.stringify(elParams)) {
        paramMismatches.push({ key, enParams, elParams })
      }
    }

    expect(paramMismatches).toEqual([])
  })

  it('each event and eventPart template uses only values permitted by the schema', () => {
    // In server.event and server.board, Greek uses {{amount, money}} (currency is read by formatMoney)
    // and removal reasons use {{labelEl}} in Greek vs {{label}} in English (backend spec 0054 AC-8).
    const unallowedPlaceholders: string[] = []

    for (const [key, enText] of serverEnMap) {
      const elText = serverElMap.get(key)
      if (!elText) continue

      const enParams = new Set(extractParamNames(enText))
      const elParams = new Set(extractParamNames(elText))

      // Check that Greek doesn't invent unexpected parameters
      for (const param of elParams) {
        if (!enParams.has(param) && param !== 'labelEl') {
          unallowedPlaceholders.push(`${key}: unexpected Greek param {{${param}}}`)
        }
      }
    }

    expect(unallowedPlaceholders).toEqual([])
  })
})
