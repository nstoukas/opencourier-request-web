// Jest's module sandbox empties require.extensions, which causes requireindex (used by eslint-plugin-i18next) to skip rules
jest.mock('requireindex', () => () => ({
  'no-literal-string': require('eslint-plugin-i18next/lib/rules/no-literal-string'),
}))

import fs from 'fs'
import path from 'path'
import { ESLint } from 'eslint'

describe('ESLint guard for request-web i18n and repo cleanliness (row 129, decisions 129.0-129.4)', () => {
  // Repo root is the opencourier-request-web directory containing .eslintrc.js and package.json
  const repoRoot = path.resolve(__dirname, '..')
  const eslint = new ESLint({ cwd: repoRoot })

  it('(a) JSX with a literal English sentence between tags is reported by i18next/no-literal-string as an error', async () => {
    // Literal English text placed directly between JSX tags in page or module code
    const pageSnippet = `export const Page = () => <div>A literal sentence between tags.</div>\n`
    const moduleSnippet = `export const Card = () => <span>Please wait while we load</span>\n`

    const pageResults = await eslint.lintText(pageSnippet, {
      filePath: path.join(repoRoot, 'src/pages/samplePage.tsx'),
    })
    const moduleResults = await eslint.lintText(moduleSnippet, {
      filePath: path.join(repoRoot, 'src/modules/sampleModule.tsx'),
    })

    // Both should report i18next/no-literal-string as an error (severity 2)
    const pageI18nErrors = pageResults[0].messages.filter(
      (m) => m.ruleId === 'i18next/no-literal-string' && m.severity === 2
    )
    expect(pageI18nErrors.length).toBeGreaterThanOrEqual(1)
    expect(pageI18nErrors[0].message).toContain('disallow literal string')

    const moduleI18nErrors = moduleResults[0].messages.filter(
      (m) => m.ruleId === 'i18next/no-literal-string' && m.severity === 2
    )
    expect(moduleI18nErrors.length).toBeGreaterThanOrEqual(1)
    expect(moduleI18nErrors[0].message).toContain('disallow literal string')
  })

  it('(b) the same markup using t(\'key\') is clean', async () => {
    // Text rendered via translation hook t(...) contains no literal strings between tags
    const translatedSnippet = `export const Page = ({ t }: { t: (k: string) => string }) => <div>{t('common.greeting')}</div>\n`

    const results = await eslint.lintText(translatedSnippet, {
      filePath: path.join(repoRoot, 'src/pages/samplePage.tsx'),
    })

    const i18nErrors = results[0].messages.filter(
      (m) => m.ruleId === 'i18next/no-literal-string'
    )
    expect(i18nErrors).toEqual([])
    expect(results[0].errorCount).toBe(0)
  })

  it('(c) a className/data-testid string attribute is not reported', async () => {
    // jsx-text-only mode restricts the rule to text between tags; attributes are ignored
    const attributeSnippet = `export const Page = ({ t }: { t: (k: string) => string }) => (
  <div className="p-4 text-center font-medium" data-testid="page-container" title="Page Title">
    {t('common.greeting')}
  </div>
)\n`

    const results = await eslint.lintText(attributeSnippet, {
      filePath: path.join(repoRoot, 'src/pages/samplePage.tsx'),
    })

    const i18nErrors = results[0].messages.filter(
      (m) => m.ruleId === 'i18next/no-literal-string'
    )
    expect(i18nErrors).toEqual([])
    expect(results[0].errorCount).toBe(0)
  })

  it('(d) the same literal sentence in a *.test.tsx filePath is not reported', async () => {
    // Test files frequently write English sentences to assert against rendered elements
    const testSnippet = `export const TestComponent = () => <div>A literal sentence between tags.</div>\n`

    const testResults = await eslint.lintText(testSnippet, {
      filePath: path.join(repoRoot, 'src/modules/sample.test.tsx'),
    })

    const i18nErrors = testResults[0].messages.filter(
      (m) => m.ruleId === 'i18next/no-literal-string'
    )
    expect(i18nErrors).toEqual([])
  })

  it('(e) package.json configures lint with --max-warnings <= 2, lint:fix carries the same number, and the real repo lints with 0 errors (row 133)', async () => {
    // 1. Verify package.json configures ESLint over src with max warnings <= 2 (the two logo <img> warnings)
    // and that lint:fix carries the exact same number (row 133, decision 133.1)
    const pkgPath = path.join(repoRoot, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

    expect(pkg.scripts?.lint).toBeDefined()
    expect(pkg.scripts?.['lint:fix']).toBeDefined()
    expect(pkg.scripts.lint).toMatch(/\beslint\b/)
    expect(pkg.scripts.lint).toMatch(/\bsrc\b/)
    expect(pkg.scripts.lint).toMatch(/--max-warnings\s+\d+/)
    expect(pkg.scripts['lint:fix']).toMatch(/--max-warnings\s+\d+/)

    const maxWarningsMatch = pkg.scripts.lint.match(/--max-warnings\s+(\d+)/)
    const fixMaxWarningsMatch = pkg.scripts['lint:fix'].match(/--max-warnings\s+(\d+)/)
    const maxWarnings = Number(maxWarningsMatch[1])
    const fixMaxWarnings = Number(fixMaxWarningsMatch[1])

    // The limit must be 2 or lower and lint:fix must carry the same number
    expect(maxWarnings).toBeLessThanOrEqual(2)
    expect(fixMaxWarnings).toBe(maxWarnings)

    // 2. Run ESLint over the real repo src directory and assert errorCount is 0
    const results = await eslint.lintFiles(['src'])
    expect(results.length).toBeGreaterThan(0)

    const totalErrors = results.reduce((acc, r) => acc + r.errorCount, 0)
    const totalWarnings = results.reduce((acc, r) => acc + r.warningCount, 0)

    expect(totalErrors).toBe(0)
    // Warnings are bounded by the measured baseline in package.json (at most 2)
    expect(totalWarnings).toBeLessThanOrEqual(maxWarnings)
  }, 30000)

  it('(f) @tanstack/react-table is gone from package.json and yarn.lock (row 133)', () => {
    const pkgPath = path.join(repoRoot, 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

    // package.json dependencies and devDependencies must not contain @tanstack/react-table
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    }
    expect(allDeps['@tanstack/react-table']).toBeUndefined()

    // Neither package.json nor yarn.lock may have any @tanstack/ reference
    const pkgContent = fs.readFileSync(pkgPath, 'utf8')
    expect(pkgContent).not.toMatch(/@tanstack\//)

    const yarnLockPath = path.join(repoRoot, 'yarn.lock')
    const yarnLockContent = fs.readFileSync(yarnLockPath, 'utf8')
    expect(yarnLockContent).not.toMatch(/@tanstack\//)
  })
})
