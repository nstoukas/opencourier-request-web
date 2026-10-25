import fs from 'fs'
import path from 'path'

function getFilesRecursively(dir: string, extensions: string[]): string[] {
  let results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath, extensions))
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath)
    }
  }
  return results
}

describe('no lucide import remains (Clause 3 guard test)', () => {
  const rootDir = path.resolve(__dirname, '../..')
  const srcDir = path.resolve(rootDir, 'src')
  const packageJsonPath = path.resolve(rootDir, 'package.json')

  // Disallow the package name anywhere in source or dependencies
  const forbiddenPackage = ['lucide', 'react'].join('-')

  const codeFiles = getFilesRecursively(srcDir, ['.ts', '.tsx', '.js'])

  it('scans package.json and asserts lucide-react is not present', () => {
    const pkgContent = fs.readFileSync(packageJsonPath, 'utf8')
    expect(pkgContent).not.toContain(forbiddenPackage)

    const pkgJson = JSON.parse(pkgContent)
    const allDeps = {
      ...pkgJson.dependencies,
      ...pkgJson.devDependencies,
    }
    expect(allDeps[forbiddenPackage]).toBeUndefined()
  })

  it('scans every .ts, .tsx, .js file under src/ and fails if lucide-react appears', () => {
    expect(codeFiles.length).toBeGreaterThan(10)

    const offendingFiles: string[] = []
    for (const file of codeFiles) {
      if (file === __filename) continue
      const content = fs.readFileSync(file, 'utf8')
      if (content.includes(forbiddenPackage)) {
        offendingFiles.push(path.relative(rootDir, file))
      }
    }

    expect(offendingFiles).toEqual([])
  })
})
