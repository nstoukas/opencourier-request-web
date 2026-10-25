import fs from 'fs'
import path from 'path'

// Helper to convert CSS HSL string "H S% L%" into RGB [0..255]
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r1 = 0, g1 = 0, b1 = 0
  if (hp >= 0 && hp < 1) { r1 = c; g1 = x; b1 = 0 }
  else if (hp >= 1 && hp < 2) { r1 = x; g1 = c; b1 = 0 }
  else if (hp >= 2 && hp < 3) { r1 = 0; g1 = c; b1 = x }
  else if (hp >= 3 && hp < 4) { r1 = 0; g1 = x; b1 = c }
  else if (hp >= 4 && hp < 5) { r1 = x; g1 = 0; b1 = c }
  else if (hp >= 5 && hp <= 6) { r1 = c; g1 = 0; b1 = x }
  const m = l - c / 2
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ]
}

// Helper to convert hex string "#RRGGBB" into RGB [0..255]
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

// Helper to load and resolve tokens from tokens.json (called only inside tests when tokensPath exists)
function loadTokens(tokensPath: string) {
  const tokensData = JSON.parse(fs.readFileSync(tokensPath, 'utf8'))
  const rawTokenMap = new Map<string, any>()
  for (const token of tokensData.color.tokens) {
    rawTokenMap.set(token.name, token.value)
  }

  function resolveLightHex(val: any): string {
    if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
      const ref = val.slice(1, -1)
      if (!rawTokenMap.has(ref)) {
        throw new Error(`Referenced token not found: ${ref}`)
      }
      return resolveLightHex(rawTokenMap.get(ref))
    }
    if (val && typeof val === 'object' && val.light) {
      return resolveLightHex(val.light)
    }
    if (typeof val === 'string') {
      return val
    }
    throw new Error(`Cannot resolve token value: ${JSON.stringify(val)}`)
  }

  return { tokensData, rawTokenMap, resolveLightHex }
}

describe('globals.css design system theme matching tokens.json (Clause 1)', () => {
  const cssPath = path.resolve(__dirname, 'globals.css')
  const tokensPath = path.resolve(__dirname, '../../../../opencourier-design-system/tokens/tokens.json')
  const tailwindConfigPath = path.resolve(__dirname, '../../../tailwind.config.ts')

  const css = fs.readFileSync(cssPath, 'utf8')
  const tailwindConfig = fs.readFileSync(tailwindConfigPath, 'utf8')

  it('contains no .dark block in globals.css (light only, night run decision D6)', () => {
    // Assert no .dark selector exists
    expect(css).not.toMatch(/\.dark\s*\{/)
  })

  // Skip cleanly when tokens.json is absent (e.g. in a standalone clone outside the co-op workspace)
  const tokensExist = fs.existsSync(tokensPath)
  const describeOrSkipTokens = tokensExist ? describe : describe.skip

  describeOrSkipTokens('tokens.json alignment in globals.css', () => {
    it('defines a matching --<name> variable in :root for every hex color token in tokens.json (and defines overlay in tailwind.config.ts)', () => {
      const { tokensData, resolveLightHex } = loadTokens(tokensPath)
      const rootMatch = css.match(/:root\s*\{([^}]+)\}/)
      expect(rootMatch).toBeTruthy()
      const rootContent = rootMatch![1]

      // Collect all CSS variable names defined in :root (stripping leading '--')
      const rootVarNames = new Set<string>()
      for (const line of rootContent.split('\n')) {
        const trimmed = line.trim()
        if (trimmed.startsWith('--') && trimmed.includes(':')) {
          const varName = trimmed.split(':')[0].trim().replace(/^--/, '')
          rootVarNames.add(varName)
        }
      }

      // Every token in tokens.json color.tokens whose light value resolves to a hex color
      // must have a matching --<name> variable in :root.
      const missingTokens: string[] = []
      for (const token of tokensData.color.tokens) {
        const resolved = resolveLightHex(token.value)
        if (resolved.startsWith('#')) {
          if (!rootVarNames.has(token.name)) {
            missingTokens.push(token.name)
          }
        }
      }

      // If any hex color token is missing from :root, fail with the list of missing token names
      expect(missingTokens).toEqual([])

      // The one token whose value is rgba ('overlay', rgba(0, 0, 0, 0.5)) is the only one
      // allowed to be absent from :root, because tailwind.config.ts defines it directly.
      const nonHexTokens = tokensData.color.tokens.filter(
        (token: any) => !resolveLightHex(token.value).startsWith('#')
      )
      expect(nonHexTokens.map((t: any) => t.name)).toEqual(['overlay'])
      expect(rootVarNames.has('overlay')).toBe(false)
      expect(tailwindConfig).toContain("overlay: 'rgb(0 0 0 / 0.5)'")
    })

    it('matches every color variable in :root against tokens.json light value within 1/255 rounding', () => {
      const { rawTokenMap, resolveLightHex } = loadTokens(tokensPath)
      const rootMatch = css.match(/:root\s*\{([^}]+)\}/)
      expect(rootMatch).toBeTruthy()
      const rootContent = rootMatch![1]

      const varLines = rootContent
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('--') && l.includes(':'))

      // Expect at least 40 theme variables in :root
      expect(varLines.length).toBeGreaterThan(40)

      for (const line of varLines) {
        const [keyPart, valPart] = line.split(':')
        const varName = keyPart.trim().replace(/^--/, '')
        const rawVal = valPart.replace(';', '').trim()

        // Non-color variables (e.g. radius) are skipped from color matching
        if (varName === 'radius') {
          expect(rawVal).toBe('0.625rem')
          continue
        }

        // Variable must exist in tokens.json
        expect(rawTokenMap.has(varName)).toBe(true)

        const lightHex = resolveLightHex(rawTokenMap.get(varName))
        expect(lightHex.startsWith('#')).toBe(true)

        const [rToken, gToken, bToken] = hexToRgb(lightHex)

        // CSS value is "H S% L%"
        const parts = rawVal.split(/\s+/)
        expect(parts).toHaveLength(3)

        const h = parseFloat(parts[0])
        const s = parseFloat(parts[1]) / 100
        const l = parseFloat(parts[2]) / 100

        const [rCss, gCss, bCss] = hslToRgb(h, s, l)

        // Allow 1/255 rounding error per channel (diff <= 1.01 in [0..255] scale)
        expect(Math.abs(rToken - rCss)).toBeLessThanOrEqual(1.01)
        expect(Math.abs(gToken - gCss)).toBeLessThanOrEqual(1.01)
        expect(Math.abs(bToken - bCss)).toBeLessThanOrEqual(1.01)
      }
    })
  })

  describe('clean skip when design system folder is absent', () => {
    it('gracefully reports skipped if design system tokens are missing', () => {
      if (!tokensExist) {
        expect(true).toBe(true)
      }
    })
  })
})
