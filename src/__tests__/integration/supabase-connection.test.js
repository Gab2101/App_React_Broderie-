import { describe, it, expect, beforeAll } from 'vitest'
import { supabase } from '../../supabaseClient'

describe('Supabase Connection', () => {
  it('should have valid Supabase client', () => {
    expect(supabase).toBeDefined()
    expect(typeof supabase.from).toBe('function')
    expect(supabase.auth).toBeDefined()
  })

  it('should be able to connect to Supabase (basic connectivity test)', async () => {
    // Test basic connectivity by attempting to get the current user
    // This should not throw an error even if not authenticated
    const { data, error } = await supabase.auth.getUser()

    // We expect either success (with null user) or a specific auth error
    // but not a connection/network error
    expect(error?.message).not.toContain('fetch')
    expect(error?.message).not.toContain('network')
  }, 10000) // 10 second timeout for network call

  it('should have access to expected tables', async () => {
    // Test that we can query the main tables without errors
    const tables = ['commandes', 'planning', 'machines']

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1)

      // We expect either success or RLS/policy errors, but not table not found
      if (error?.message) {
        expect(error.message).not.toContain('relation')
        expect(error.message).not.toContain('does not exist')
      }
    }
  }, 15000) // Longer timeout for multiple queries
})
