import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const localesDir = path.join(root, 'src', 'i18n', 'locales')
const languages = fs.readdirSync(localesDir)
  .filter((name) => fs.existsSync(path.join(localesDir, name, 'translation.json')))
  .sort()

function flatten(value, prefix = '', output = {}) {
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flatten(child, next, output)
    } else {
      output[next] = child
    }
  }
  return output
}

const maps = Object.fromEntries(languages.map((language) => {
  const file = path.join(localesDir, language, 'translation.json')
  return [language, flatten(JSON.parse(fs.readFileSync(file, 'utf8')))]
}))

const allKeys = [...new Set(Object.values(maps).flatMap((map) => Object.keys(map)))].sort()
let failed = false

for (const language of languages) {
  const missing = allKeys.filter((key) => !(key in maps[language]))
  if (missing.length > 0) {
    failed = true
    console.error(`${language}: missing ${missing.length} keys`)
    for (const key of missing) console.error(`  - ${key}`)
  }
}

if (failed) process.exit(1)
console.log(`i18n key parity OK: ${languages.join(', ')}`)
