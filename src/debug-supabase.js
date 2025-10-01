// Debug script for Supabase connection issues
import { supabase } from './supabaseClient.js'

console.log('🔍 Supabase Debug Script')
console.log('========================')

// Test 1: Environment variables
console.log('\n1. Environment Variables:')
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('VITE_SUPABASE_PUBLISHABLE_KEY:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? 'Present' : 'Missing')

// Test 2: Client initialization
console.log('\n2. Supabase Client:')
console.log('Client created:', !!supabase)
console.log('Has from method:', typeof supabase.from === 'function')
console.log('Has auth property:', !!supabase.auth)

// Test 3: Basic REST API connectivity
console.log('\n3. Testing REST API connectivity...')
try {
  const { data, error } = await supabase.from('commandes').select('count').limit(1)
  if (error) {
    console.error('❌ REST API Error:', error.message)
  } else {
    console.log('✅ REST API works - got data:', data)
  }
} catch (err) {
  console.error('❌ REST API Exception:', err.message)
}

// Test 4: WebSocket/Realtime status
console.log('\n4. Testing WebSocket/Realtime...')
try {
  // Check if realtime is available
  const channel = supabase.channel('debug-test')
  console.log('Channel created:', !!channel)

  // Try to subscribe (this will attempt WebSocket connection)
  channel.subscribe((status) => {
    console.log('Realtime status:', status)
    if (status === 'SUBSCRIBED') {
      console.log('✅ WebSocket connection successful')
      channel.unsubscribe()
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      console.log('❌ WebSocket connection failed with status:', status)
    }
  })

  // Timeout after 5 seconds
  setTimeout(() => {
    console.log('⏰ WebSocket test timeout - unsubscribing')
    channel.unsubscribe()
  }, 5000)

} catch (err) {
  console.error('❌ WebSocket setup error:', err.message)
}

// Test 5: Network connectivity
console.log('\n5. Testing basic network connectivity...')
try {
  const response = await fetch('https://iejytndopjcloyqefbae.supabase.co/rest/v1/', {
    method: 'HEAD',
    headers: {
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
    }
  })
  console.log('Network test - Status:', response.status)
  console.log('Network test - OK:', response.ok)
} catch (err) {
  console.error('❌ Network connectivity error:', err.message)
}

console.log('\n🎯 Debug complete. Check results above.')
console.log('If REST API works but WebSocket fails, the issue is likely:')
console.log('- Firewall blocking WebSocket connections')
console.log('- Supabase realtime not enabled')
console.log('- Network proxy interfering with WebSocket')
