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
    // Real Supabase chaining: from() returns an object with select(), insert(), etc.
    from: vi.fn((table) => ({
      // select() returns a chainable query builder
      select: vi.fn((columns = '*') => ({
        // Each method returns the query builder for chaining
        eq: vi.fn((column, value) => ({
          data: selectData.filter(item =>
            String(item[column]) === String(value)
          ),
          error: selectError,
          // Add more chaining methods as needed
          single: vi.fn(() => ({
            data: selectData.find(item =>
              String(item[column]) === String(value)
            ) || null,
            error: selectError,
          })),
        })),
        in: vi.fn((column, values) => ({
          data: selectData.filter(item =>
            values.includes(String(item[column]))
          ),
          error: selectError,
        })),
        gte: vi.fn((column, value) => ({
          lt: vi.fn((column2, value2) => ({
            data: selectData.filter(item =>
              new Date(item[column]).getTime() >= new Date(value).getTime() &&
              new Date(item[column2]).getTime() < new Date(value2).getTime()
            ),
            error: selectError,
          })),
          data: [],
          error: selectError,
        })),
        order: vi.fn((column, opts) => ({
          data: selectData.sort(),
          error: selectError,
        })),
        // Direct resolution for simple queries
        data: selectData,
        error: selectError,
        single: vi.fn(() => ({
          data: selectData[0] || null,
          error: selectError,
        })),
      })),

      // insert() returns a chainable query builder
      insert: vi.fn((data) => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: insertData || (Array.isArray(data) ? data[0] : data),
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
        error: selectError,
      })),

      delete: vi.fn(() => ({
        eq: vi.fn((col, val) => ({
          error: deleteError,
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
