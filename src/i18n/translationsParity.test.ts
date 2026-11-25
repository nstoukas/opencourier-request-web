// Spec 0054 (row 47), AC-8: key parity and completeness guard.
// Row 163: checks every copied server sentence and event code against the backend word for word.
import fs from 'fs'
import os from 'os'
import path from 'path'
import vm from 'vm'
import ts from 'typescript'
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

// Every leaf of a translation object as `a.b.c` -> text.
function leaves(node: unknown, prefix = ''): Map<string, unknown> {
  const found = new Map<string, unknown>()
  if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      const name = prefix ? `${prefix}.${key}` : key
      if (typeof value === 'object' && value !== null) {
        leaves(value, name).forEach((text, leaf) => {
          found.set(leaf, text)
        })
      } else {
        found.set(name, value)
      }
    }
  }
  return found
}

// Runs the transpiled file in a bare context (no require): this executes the co-op's own backend file
// and is not a security boundary. It is fine while the backend's files are plain data; if the evaluated
// file calls require (a value import), the test fails with a clear message naming the file, not a bare
// ReferenceError. Preserves exact multi-line formatting, escaped quotes and {{template}} placeholders.
function loadTypeScriptFile<T = Record<string, unknown>>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backend file not found: ${filePath}`)
  }
  const code = fs.readFileSync(filePath, 'utf-8')
  // Transpile TypeScript source down to CommonJS JavaScript
  const js = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText
  const exportsObj: Record<string, unknown> = {}
  const moduleObj = { exports: exportsObj }
  const customRequire = (id: string) => {
    throw new Error(
      `Evaluating ${filePath} attempted to call require('${id}'). ` +
        'This loader runs the co-op plain data files and does not support value imports.'
    )
  }
  const context = vm.createContext({
    exports: exportsObj,
    module: moduleObj,
    require: customRequire,
  })
  try {
    vm.runInContext(js, context)
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes('attempted to call require')
    ) {
      throw err
    }
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to evaluate ${filePath}: ${message}`)
  }
  return moduleObj.exports as T
}

interface BackendPathsOptions {
  defaultDir?: string
  env?: Record<string, string | undefined>
}

// Resolves backend file locations with support for overrides (e.g. scratch copies in tests).
function getBackendPaths(options?: BackendPathsOptions) {
  const env = options?.env ?? process.env
  const defaultDir =
    options?.defaultDir ?? path.resolve(__dirname, '../../../opencourier-backend')

  const hasOverride = Boolean(
    env.OPENCOURIER_BACKEND_DIR ||
      env.BACKEND_EN_PATH ||
      env.BACKEND_EL_PATH ||
      env.BACKEND_MESSAGES_PATH
  )

  const allFilesOverridden = Boolean(
    env.BACKEND_EN_PATH && env.BACKEND_EL_PATH && env.BACKEND_MESSAGES_PATH
  )

  const backendDir = env.OPENCOURIER_BACKEND_DIR || defaultDir
  const backendEnPath =
    env.BACKEND_EN_PATH || path.join(backendDir, 'src/localization/en.ts')
  const backendElPath =
    env.BACKEND_EL_PATH || path.join(backendDir, 'src/localization/el.ts')
  const backendMessagesPath =
    env.BACKEND_MESSAGES_PATH ||
    path.join(backendDir, 'src/shared-types/event-messages.ts')

  const dirExists = fs.existsSync(backendDir)
  const requireBackend = env.REQUIRE_BACKEND === '1'

  // Skip only when the backend folder itself is absent and no override is set.
  // When REQUIRE_BACKEND=1, never skip (it turns the absence into a failure).
  const shouldSkip = !hasOverride && !dirExists && !requireBackend

  return {
    backendDir,
    backendEnPath,
    backendElPath,
    backendMessagesPath,
    hasOverride,
    allFilesOverridden,
    dirExists,
    requireBackend,
    shouldSkip,
  }
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

describe('Backend path resolution and skip guard', () => {
  it('skips when default backend dir is absent and no override is set', () => {
    const paths = getBackendPaths({
      defaultDir: path.resolve(__dirname, '../../../nonexistent-backend-for-test'),
      env: {},
    })
    expect(paths.shouldSkip).toBe(true)
    expect(paths.dirExists).toBe(false)
  })

  it('turns skip into failure when REQUIRE_BACKEND=1 even if backend dir is absent', () => {
    const paths = getBackendPaths({
      defaultDir: path.resolve(__dirname, '../../../nonexistent-backend-for-test'),
      env: { REQUIRE_BACKEND: '1' },
    })
    expect(paths.shouldSkip).toBe(false)
    expect(paths.requireBackend).toBe(true)
    expect(paths.dirExists).toBe(false)
  })

  it('does not skip when an override path is set, even if the directory does not exist', () => {
    const paths = getBackendPaths({
      env: { OPENCOURIER_BACKEND_DIR: '/nonexistent/override/dir' },
    })
    expect(paths.shouldSkip).toBe(false)
    expect(paths.hasOverride).toBe(true)
    expect(paths.dirExists).toBe(false)
  })

  it('detects missing required file in present directory', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-scratch-backend-'))
    try {
      const paths = getBackendPaths({
        env: { OPENCOURIER_BACKEND_DIR: tempDir },
      })
      expect(paths.shouldSkip).toBe(false)
      expect(paths.dirExists).toBe(true)
      expect(fs.existsSync(paths.backendEnPath)).toBe(false)
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('does not fail existence check when all three per file overrides exist even if default dir is absent', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-scratch-overrides-'))
    try {
      const enPath = path.join(tempDir, 'en.ts')
      const elPath = path.join(tempDir, 'el.ts')
      const msgPath = path.join(tempDir, 'event-messages.ts')
      fs.writeFileSync(enPath, 'export const en = {};')
      fs.writeFileSync(elPath, 'export const el = {};')
      fs.writeFileSync(
        msgPath,
        'export const EVENT_MESSAGE_CODES = {}; export const EVENT_PART_CODES = {};'
      )

      const paths = getBackendPaths({
        defaultDir: path.resolve(__dirname, '../../../nonexistent-backend-for-test'),
        env: {
          BACKEND_EN_PATH: enPath,
          BACKEND_EL_PATH: elPath,
          BACKEND_MESSAGES_PATH: msgPath,
        },
      })
      expect(paths.shouldSkip).toBe(false)
      expect(paths.allFilesOverridden).toBe(true)
      expect(paths.dirExists).toBe(false)
      expect(fs.existsSync(paths.backendEnPath)).toBe(true)
      expect(fs.existsSync(paths.backendElPath)).toBe(true)
      expect(fs.existsSync(paths.backendMessagesPath)).toBe(true)

      const checkExistence = (bp: ReturnType<typeof getBackendPaths>) => {
        if (bp.requireBackend && !bp.dirExists && !bp.allFilesOverridden) {
          throw new Error(
            `REQUIRE_BACKEND=1 is set, but backend directory was not found under ${bp.backendDir}`
          )
        }
        if (!bp.dirExists && !bp.allFilesOverridden) {
          throw new Error(`Backend directory was not found under ${bp.backendDir}`)
        }
        for (const [name, filePath] of [
          ['en.ts', bp.backendEnPath],
          ['el.ts', bp.backendElPath],
          ['event-messages.ts', bp.backendMessagesPath],
        ] as const) {
          if (!fs.existsSync(filePath)) {
            throw new Error(`Backend localization file missing: ${name} (checked ${filePath})`)
          }
        }
      }
      expect(() => checkExistence(paths)).not.toThrow()
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})

describe('Row 163: Every copied server sentence is checked against the backend', () => {
  const backendPaths = getBackendPaths()

  if (backendPaths.shouldSkip) {
    console.warn(
      '\n=================================================================================\n' +
        `WARNING: Backend localization files not found under ${backendPaths.backendDir}.\n` +
        'Skipping server sentence copy consistency checks because backend repo is absent.\n' +
        '=================================================================================\n'
    )
  }

  const itRow163 = backendPaths.shouldSkip ? it.skip : it

  itRow163('ensures backend directory and localization files exist', () => {
    if (backendPaths.requireBackend && !backendPaths.dirExists && !backendPaths.allFilesOverridden) {
      throw new Error(
        `REQUIRE_BACKEND=1 is set, but backend directory was not found under ${backendPaths.backendDir}`
      )
    }
    if (!backendPaths.dirExists && !backendPaths.allFilesOverridden) {
      throw new Error(
        `Backend directory was not found under ${backendPaths.backendDir}`
      )
    }
    for (const [name, filePath] of [
      ['en.ts', backendPaths.backendEnPath],
      ['el.ts', backendPaths.backendElPath],
      ['event-messages.ts', backendPaths.backendMessagesPath],
    ] as const) {
      if (!fs.existsSync(filePath)) {
        throw new Error(
          `Backend localization file missing: ${name} (checked ${filePath})`
        )
      }
    }
  })

  it('fails with a clear message naming the file if an evaluated file calls require', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-request-web-require-'))
    const scratchRequireFile = path.join(tempDir, 'scratch-require.ts')
    fs.writeFileSync(
      scratchRequireFile,
      'const crypto = require("crypto"); export const data = { crypto };'
    )
    try {
      expect(() => loadTypeScriptFile(scratchRequireFile)).toThrow(
        `Evaluating ${scratchRequireFile} attempted to call require('crypto')`
      )
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  itRow163('ensures backend and app define the exact same set of server groups', () => {
    const backendEnModule = loadTypeScriptFile<{ en: { server: Record<string, unknown> } }>(
      backendPaths.backendEnPath
    )
    const backendElModule = loadTypeScriptFile<{ el: { server: Record<string, unknown> } }>(
      backendPaths.backendElPath
    )

    const expectedEnGroups = Object.keys(backendEnModule.en.server).sort()
    const expectedElGroups = Object.keys(backendElModule.el.server).sort()

    expect(Object.keys(serverEn.server).sort()).toEqual(expectedEnGroups)
    expect(Object.keys(serverEl.server).sort()).toEqual(expectedElGroups)
  })

  itRow163('compares every copied English server sentence with the backend word for word', () => {
    const backendEnModule = loadTypeScriptFile<{ en: { server: Record<string, unknown> } }>(
      backendPaths.backendEnPath
    )
    const backendServer = backendEnModule.en.server

    const backendLeaves = leaves(backendServer)
    const appLeaves = leaves(serverEn.server)

    const backendKeys = Array.from(backendLeaves.keys()).sort()
    const appKeys = Array.from(appLeaves.keys()).sort()

    const missingInApp = backendKeys.filter((k) => !appLeaves.has(k))
    const extraInApp = appKeys.filter((k) => !backendLeaves.has(k))
    const mismatches: { code: string; backend: unknown; app: unknown }[] = []

    for (const key of backendKeys) {
      if (appLeaves.has(key)) {
        const bVal = backendLeaves.get(key)
        const aVal = appLeaves.get(key)
        if (bVal !== aVal) {
          mismatches.push({ code: key, backend: bVal, app: aVal })
        }
      }
    }

    expect(missingInApp).toEqual([])
    expect(extraInApp).toEqual([])
    expect(mismatches).toEqual([])
  })

  itRow163('compares every copied Greek server sentence with the backend word for word', () => {
    const backendElModule = loadTypeScriptFile<{ el: { server: Record<string, unknown> } }>(
      backendPaths.backendElPath
    )
    const backendServer = backendElModule.el.server

    const backendLeaves = leaves(backendServer)
    const appLeaves = leaves(serverEl.server)

    const backendKeys = Array.from(backendLeaves.keys()).sort()
    const appKeys = Array.from(appLeaves.keys()).sort()

    const missingInApp = backendKeys.filter((k) => !appLeaves.has(k))
    const extraInApp = appKeys.filter((k) => !backendLeaves.has(k))
    const mismatches: { code: string; backend: unknown; app: unknown }[] = []

    for (const key of backendKeys) {
      if (appLeaves.has(key)) {
        const bVal = backendLeaves.get(key)
        const aVal = appLeaves.get(key)
        if (bVal !== aVal) {
          mismatches.push({ code: key, backend: bVal, app: aVal })
        }
      }
    }

    expect(missingInApp).toEqual([])
    expect(extraInApp).toEqual([])
    expect(mismatches).toEqual([])
  })

  const copiedGroups = ['event', 'eventPart', 'enum', 'error', 'notice', 'board', 'mail'] as const

  for (const group of copiedGroups) {
    itRow163(`matches English server.${group} sentences word for word with backend`, () => {
      const backendEnModule = loadTypeScriptFile<{ en: { server: Record<string, unknown> } }>(
        backendPaths.backendEnPath
      )
      const backendGroup = backendEnModule.en.server[group]
      const appGroup = (serverEn.server as Record<string, unknown>)[group]

      const backendLeaves = leaves(backendGroup)
      const appLeaves = leaves(appGroup || {})

      const missingInApp = Array.from(backendLeaves.keys()).filter((k) => !appLeaves.has(k))
      const extraInApp = Array.from(appLeaves.keys()).filter((k) => !backendLeaves.has(k))
      const mismatches: { code: string; backend: unknown; app: unknown }[] = []

      for (const [key, bVal] of Array.from(backendLeaves.entries())) {
        if (appLeaves.has(key)) {
          const aVal = appLeaves.get(key)
          if (bVal !== aVal) {
            mismatches.push({ code: key, backend: bVal, app: aVal })
          }
        }
      }

      expect(missingInApp).toEqual([])
      expect(extraInApp).toEqual([])
      expect(mismatches).toEqual([])
      expect(appGroup).toEqual(backendGroup)
    })

    itRow163(`matches Greek server.${group} sentences word for word with backend`, () => {
      const backendElModule = loadTypeScriptFile<{ el: { server: Record<string, unknown> } }>(
        backendPaths.backendElPath
      )
      const backendGroup = backendElModule.el.server[group]
      const appGroup = (serverEl.server as Record<string, unknown>)[group]

      const backendLeaves = leaves(backendGroup)
      const appLeaves = leaves(appGroup || {})

      const missingInApp = Array.from(backendLeaves.keys()).filter((k) => !appLeaves.has(k))
      const extraInApp = Array.from(appLeaves.keys()).filter((k) => !backendLeaves.has(k))
      const mismatches: { code: string; backend: unknown; app: unknown }[] = []

      for (const [key, bVal] of Array.from(backendLeaves.entries())) {
        if (appLeaves.has(key)) {
          const aVal = appLeaves.get(key)
          if (bVal !== aVal) {
            mismatches.push({ code: key, backend: bVal, app: aVal })
          }
        }
      }

      expect(missingInApp).toEqual([])
      expect(extraInApp).toEqual([])
      expect(mismatches).toEqual([])
      expect(appGroup).toEqual(backendGroup)
    })
  }

  // request-web does not copy event-messages.ts, so we compare code names; param placeholders in sentences are compared above.
  itRow163('ensures EVENT_MESSAGE_CODES and EVENT_PART_CODES match the app server templates', () => {
    const backendMsgModule = loadTypeScriptFile<{
      EVENT_MESSAGE_CODES: Record<string, readonly string[]>
      EVENT_PART_CODES: Record<string, readonly string[]>
    }>(backendPaths.backendMessagesPath)

    // EVENT_MESSAGE_CODES
    const backendMsgCodes = Object.keys(backendMsgModule.EVENT_MESSAGE_CODES).sort()
    const appMsgCodesEn = Object.keys(serverEn.server.event).sort()
    const appMsgCodesEl = Object.keys(serverEl.server.event).sort()

    const missingMsgCodesEn = backendMsgCodes.filter((c) => !(c in serverEn.server.event))
    const extraMsgCodesEn = appMsgCodesEn.filter((c) => !(c in backendMsgModule.EVENT_MESSAGE_CODES))
    const missingMsgCodesEl = backendMsgCodes.filter((c) => !(c in serverEl.server.event))
    const extraMsgCodesEl = appMsgCodesEl.filter((c) => !(c in backendMsgModule.EVENT_MESSAGE_CODES))

    expect(missingMsgCodesEn).toEqual([])
    expect(extraMsgCodesEn).toEqual([])
    expect(missingMsgCodesEl).toEqual([])
    expect(extraMsgCodesEl).toEqual([])
    expect(appMsgCodesEn).toEqual(backendMsgCodes)
    expect(appMsgCodesEl).toEqual(backendMsgCodes)

    // EVENT_PART_CODES
    const backendPartCodes = Object.keys(backendMsgModule.EVENT_PART_CODES).sort()
    const appPartCodesEn = Object.keys(serverEn.server.eventPart).sort()
    const appPartCodesEl = Object.keys(serverEl.server.eventPart).sort()

    const missingPartCodesEn = backendPartCodes.filter((c) => !(c in serverEn.server.eventPart))
    const extraPartCodesEn = appPartCodesEn.filter((c) => !(c in backendMsgModule.EVENT_PART_CODES))
    const missingPartCodesEl = backendPartCodes.filter((c) => !(c in serverEl.server.eventPart))
    const extraPartCodesEl = appPartCodesEl.filter((c) => !(c in backendMsgModule.EVENT_PART_CODES))

    expect(missingPartCodesEn).toEqual([])
    expect(extraPartCodesEn).toEqual([])
    expect(missingPartCodesEl).toEqual([])
    expect(extraPartCodesEl).toEqual([])
    expect(appPartCodesEn).toEqual(backendPartCodes)
    expect(appPartCodesEl).toEqual(backendPartCodes)
  })
})
