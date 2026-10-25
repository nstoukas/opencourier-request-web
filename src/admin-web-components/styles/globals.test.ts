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

describe('globals.css design system theme matching tokens.json (Clause 1)', () => {
  const cssPath = path.resolve(__dirname, 'globals.css')
  const tokensPath = path.resolve(__dirname, '../../../../opencourier-design-system/tokens/tokens.json')

  const css = fs.readFileSync(cssPath, 'utf8')
  const tokensData = JSON.parse(fs.readFileSync(tokensPath, 'utf8'))

  // Build token lookup map
  const rawTokenMap = new Map<string, any>()
  for (const token of tokensData.color.tokens) {
    rawTokenMap.set(token.name, token.value)
  }

  // Resolves token values (unwrapping light theme and references like "{foreground}")
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

  it('contains no .dark block in globals.css (light only, night run decision D6)', () => {
    // Assert no .dark selector exists
    expect(css).not.toMatch(/\.dark\s*\{/)
  })

  it('matches every color variable in :root against tokens.json light value within 1/255 rounding', () => {
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
