import fs from 'fs'
import path from 'path'

function applyEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

export function loadLocalEnv(projectRoot: string) {
  applyEnvFile(path.join(projectRoot, '.env'))
  applyEnvFile(path.join(projectRoot, '.env.local'))
}
