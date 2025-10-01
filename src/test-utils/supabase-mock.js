// Mock Supabase client for testing
export const createMockSupabaseClient = () => {
  const mockResponse = {
    data: null,
    error: null,
  }

  const mockQuery = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(mockResponse),
  }

  return {
    from: vi.fn(() => mockQuery),
  }
}

export const mockSupabaseResponse = (data = null, error = null) => ({
  data,
  error,
})

// Helper to setup mock responses
export const setupSupabaseMock = (mockClient) => {
  mockClient.from.mockImplementation((table) => {
    const mockQuery = {
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    return mockQuery
  })
}
