// scripts/check-env.cjs
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

const files = ['.env.local', '.env.development.local', '.env.development', '.env']
for (const f of files) {
  const p = path.resolve(process.cwd(), f)
  if (fs.existsSync(p)) dotenv.config({ path: p })
}

const req = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
const missing = req.filter(k => !process.env[k] || String(process.env[k]).trim() === '')

if (missing.length) {
  console.error('[ENV CHECK] Missing:', missing.join(', '))
  if (process.env.NODE_ENV === 'production' || process.env.CI) process.exit(1)
  else console.warn('[ENV CHECK] Development mode: continuing.')
} else {
  console.log('[ENV CHECK] OK')
}
