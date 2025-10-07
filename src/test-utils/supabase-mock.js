// src/test-utils/supabase-mock.js
// Comprehensive Supabase mock for unit and integration tests

export function createSupabaseMock(options = {}) {
  const {
    selectData = [],
    selectError = null,
    insertData = null,
    updateData = null,
    deleteError = null,
    shouldThrow = false,
  } = options;

  const mockRow = insertData || updateData || {};

  const mock = {
    from: vi.fn((table) => ({
      select: vi.fn((columns = '*') => ({
        data: selectData,
        error: selectError,
        eq: vi.fn(() => ({
          data: selectData,
          error: selectError,
        })),
        in: vi.fn(() => ({
          data: selectData,
          error: selectError,
        })),
        order: vi.fn(() => ({
          data: selectData,
          error: selectError,
        })),
        single: vi.fn(() => ({
          data: selectData[0] || null,
          error: selectError,
        })),
      })),
      
      insert: vi.fn((data) => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: insertData || data,
            error: selectError,
          })),
          data: Array.isArray(data) ? data : [data],
          error: selectError,
        })),
      })),
      
      update: vi.fn((data) => ({
        eq: vi.fn((col, val) => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: updateData || { ...mockRow, ...data },
              error: selectError,
            })),
          })),
        })),
      })),
      
      delete: vi.fn(() => ({
        eq: vi.fn((col, val) => ({
          error: deleteError,
        })),
      })),
      
      upsert: vi.fn((data) => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: insertData || data,
            error: selectError,
          })),
        })),
      })),
    })),
    
    channel: vi.fn((channelName) => {
      const handlers = [];
      
      return {
        on: vi.fn((event, filter, callback) => {
          handlers.push({ event, filter, callback });
          return {
            on: vi.fn((e, f, cb) => {
              handlers.push({ event: e, filter: f, callback: cb });
              return { subscribe: vi.fn(() => 'SUBSCRIBED') };
            }),
            subscribe: vi.fn(() => 'SUBSCRIBED'),
          };
        }),
        subscribe: vi.fn((callback) => {
          if (callback) callback('SUBSCRIBED');
          return 'SUBSCRIBED';
        }),
        unsubscribe: vi.fn(),
        _handlers: handlers, // For test inspection
      };
    }),
    
    removeChannel: vi.fn(() => 'ok'),
    
    auth: {
      getSession: vi.fn(() => Promise.resolve({
        data: { session: null },
        error: null,
      })),
      onAuthStateChange: vi.fn((callback) => {
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      }),
    },
    
    storage: {
      from: vi.fn((bucket) => ({
        upload: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        download: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    },
  };

  return mock;
}

// Helper to create a mock with specific table responses
export function createSupabaseTableMock(tableResponses = {}) {
  return {
    from: vi.fn((table) => {
      const response = tableResponses[table] || { data: [], error: null };
      
      return {
        select: vi.fn(() => Promise.resolve(response)),
        insert: vi.fn(() => ({
          select: vi.fn(() => Promise.resolve(response)),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => Promise.resolve(response)),
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    }),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({ subscribe: vi.fn() })),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  };
}

// Export a default mock instance for simple use cases
export const mockSupabase = createSupabaseMock();
