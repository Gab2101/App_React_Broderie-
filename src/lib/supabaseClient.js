// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const g = globalThis
const SB_KEY = 'sb-auth-iejytndopjcloyqefbae' // stable pour ce projet

function readEnv() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  return { url, key }
}

function makeClient() {
  const { url, key } = readEnv()
  if (!url || !key) {
    const err = new Error('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    if (import.meta.env.DEV) {
      console.error(err.message, {
        urlPresent: Boolean(url),
        keyLen: (key && key.length) || 0,
        module: import.meta.url,
      })
    }
    // Export d'un stub qui jette si on l'utilise sans ENV valides
    return new Proxy({}, {
      get() { throw err }
    })
  }

  if (import.meta.env.DEV) {
    console.log('[Supabase] URL:', url)
    console.log('[Supabase] Key: Present')
  }

  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: SB_KEY,
      flowType: 'pkce',
      multiTab: true,
    },
    realtime: { params: { eventsPerSecond: 10 } },
  })
}

// Empêche la double création (HMR / imports dupliqués)
if (!g.__supabase_client__) {
  g.__supabase_client__ = makeClient()
} else if (import.meta.env.DEV) {
  console.warn('[Supabase] Reusing existing client (HMR)')
}

const supabase = g.__supabase_client__
export default supabase
