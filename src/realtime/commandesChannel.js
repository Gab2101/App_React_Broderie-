// src/realtime/commandesChannel.js
import supabase from '@/lib/supabaseClient'

let channel = null
let listeners = new Set()
let refCount = 0

function safeSubscribe(ch) {
  try {
    ch.subscribe(status => {
      // Realtime status logging removed for production cleanliness
    })
    return true
  } catch (e) {
    // Silent failure - realtime is not critical
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
    return () => {} // Silent failure handler
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
