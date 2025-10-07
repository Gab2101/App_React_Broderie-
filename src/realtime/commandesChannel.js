// src/realtime/commandesChannel.js
import supabase from '@/lib/supabaseClient'

let channel = null
let listeners = new Set()
let refCount = 0

function safeSubscribe(ch) {
  try {
    ch.subscribe(status => {
      if (status === 'SUBSCRIBED') console.log('Realtime subscription established')
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('Realtime subscription failed')
      else if (status === 'CLOSED') console.log('Realtime channel closed')
    })
    return true
  } catch (e) {
    console.warn('[Realtime] subscribe skipped:', e?.message || e)
    return false
  }
}

function ensureChannel() {
  if (channel) return channel
  // Si supabase est un stub (absence d’ENV), l’accès lèvera une erreur ici.
  channel = supabase.channel('public:commandes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'commandes' },
      payload => { for (const cb of listeners) cb(payload) }
    )
  safeSubscribe(channel)
  return channel
}

export function attachCommandesListener(cb) {
  try {
    ensureChannel()
  } catch (e) {
    console.warn('[Realtime] not available:', e?.message || e)
    return () => {}
  }
  listeners.add(cb)
  refCount++
  return () => {
    listeners.delete(cb)
    refCount--
    if (refCount <= 0 && channel) {
      try { supabase.removeChannel(channel) } catch {}
      channel = null
      listeners = new Set()
      refCount = 0
    }
  }
}
