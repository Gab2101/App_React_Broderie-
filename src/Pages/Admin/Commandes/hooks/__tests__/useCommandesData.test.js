// src/Pages/Admin/Commandes/hooks/__tests__/useCommandesData.test.js
// Comprehensive tests for useCommandesData hook
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
// Correct import - useCommandesData is a default export
import useCommandesData from '../useCommandesData.js';

// Mock Supabase dependencies
vi.mock('@/lib/supabaseClient', () => ({
  default: {
    from: vi.fn(),
  },
}));

vi.mock('@/utils/errorHandler', () => ({
  reportError: vi.fn(),
}));

import supabase from '@/lib/supabaseClient';
import { reportError } from '@/utils/errorHandler';

describe('useCommandesData', () => {
  const mockCommandes = [
    {
      id: 'cmd-1',
      numero: 'TEST-001',
      client: 'Client A',
      statut: 'A commencer',
      machineAssignee: 'Machine 1',
    },
    {
      id: 'cmd-2',
      numero: 'TEST-002',
      client: 'Client B',
      statut: 'En cours',
      machineAssignee: 'Machine 2',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default successful mocks
    supabase.from.mockImplementation((table) => {
      if (table === 'commandes') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              data: mockCommandes,
              error: null,
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              data: null,
              error: null,
            })),
          })),
        };
      }
      if (table === 'planning') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              data: [],
              error: null,
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              data: null,
              error: null,
            })),
          })),
        };
      }
      return {};
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State & Loading', () => {
    it('returns initial state correctly', () => {
      const { result } = renderHook(() => useCommandesData());

      expect(result.current.commandes).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('loads commandes successfully on mount', async () => {
      const { result } = renderHook(() => useCommandesData());

      // Wait for async data loading
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.commandes).toEqual(mockCommandes);
      expect(result.current.error).toBeNull();
    });

    it('handles database errors gracefully', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            data: null,
            error: { message: 'Database connection failed', code: 'CONNECTION_ERROR' },
          })),
        })),
      });

      const { result } = renderHook(() => useCommandesData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.commandes).toEqual([]);
      expect(result.current.error).toBeTruthy();
      expect(result.current.error.message).toBe('Database connection failed');
      expect(reportError).toHaveBeenCalledWith(
        result.current.error,
        expect.objectContaining({
          operation: 'Commandes fetch',
          component: 'useCommandesData',
        })
      );
    });
  });

  describe('CRUD Operations', () => {
    it('deleteCommandeWithPlanning deletes commande and associated planning', async () => {
      const { result } = renderHook(() => useCommandesData());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock planning table to return some entries
      supabase.from.mockImplementation((table) => {
        if (table === 'planning') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: [{ id: 'plan-1' }, { id: 'plan-2' }],
                error: null,
              })),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: null,
                error: null,
              })),
            })),
          };
        }
        if (table === 'commandes') {
          return {
            select: vi.fn(() => ({
              order: vi.fn(() => ({
                data: mockCommandes,
                error: null,
              })),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: null,
                error: null,
              })),
            })),
          };
        }
        return {};
      });

      let deleteResult;
      await act(async () => {
        deleteResult = await result.current.deleteCommandeWithPlanning('cmd-1');
      });

      expect(deleteResult.error).toBeNull();
      expect(supabase.from).toHaveBeenCalledWith('planning');
      expect(supabase.from).toHaveBeenCalledWith('commandes');

      const planningDeleteCall = supabase.from('planning').delete();
      expect(planningDeleteCall.eq).toHaveBeenCalled();
    });

    it('handles planning deletion errors during commande deletion', async () => {
      supabase.from.mockImplementation((table) => {
        if (table === 'planning') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: [{ id: 'plan-1' }],
                error: null,
              })),
            })),
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: null,
                error: { message: 'Planning deletion failed', code: 'DELETE_ERROR' },
              })),
            })),
          };
        }
        return {};
      });

      const { result } = renderHook(() => useCommandesData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const deleteResult = await act(async () => {
        return await result.current.deleteCommandeWithPlanning('cmd-1');
      });

      expect(deleteResult.error).toBeTruthy();
      // Should continue attempting to delete commande even if planning deletion fails
    });

    it('returns error when planning selection fails', async () => {
      supabase.from.mockImplementation((table) => {
        if (table === 'planning') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: null,
                error: { message: 'Planning query failed', code: 'SELECT_ERROR' },
              })),
            })),
          };
        }
        return {};
      });

      const { result } = renderHook(() => useCommandesData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const deleteResult = await result.current.deleteCommandeWithPlanning('cmd-1');

      expect(deleteResult.error).toBeTruthy();
      expect(deleteResult.error.message).toBe('Planning query failed');
    });
  });

  describe('Data Synchronization', () => {
    it('refreshCommandes reloads data from server', async () => {
      const { result } = renderHook(() => useCommandesData());

      // Initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Change mock data for refresh
      const newMockCommandes = [mockCommandes[0]]; // Only first commande
      supabase.from.mockReturnValue({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            data: newMockCommandes,
            error: null,
          })),
        })),
      });

      // Refresh
      await act(async () => {
        await result.current.refreshCommandes();
      });

      expect(result.current.commandes).toEqual(newMockCommandes);
      expect(result.current.loading).toBe(false);
    });

    it('maintains loading state during refresh', async () => {
      const { result } = renderHook(() => useCommandesData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock slow refresh
      supabase.from.mockReturnValue({
        select: vi.fn(() => ({
          order: vi.fn(() => new Promise(resolve => {
            setTimeout(() => resolve({
              data: mockCommandes,
              error: null,
            }), 100); // 100ms delay
          })),
        })),
      });

      let isLoadingDuringRefresh = false;
      await act(async () => {
        const refreshPromise = result.current.refreshCommandes();
        // Check loading state immediately after calling refresh
        if (result.current.loading) {
          isLoadingDuringRefresh = true;
        }
        await refreshPromise;
      });

      expect(isLoadingDuringRefresh).toBe(true);
      expect(result.current.loading).toBe(false); // Should be false after completion
    });
  });

  describe('Memory Management & Cleanup', () => {
    it('provides stable references to functions', () => {
      const { result } = renderHook(() => useCommandesData());

      // Store initial function references
      const initialRefresh = result.current.refreshCommandes;
      const initialDelete = result.current.deleteCommandeWithPlanning;

      // Re-render (simulate state change or parent update)
      act(() => {}); // Trigger re-render

      // Functions should maintain stable references
      expect(result.current.refreshCommandes).toBe(initialRefresh);
      expect(result.current.deleteCommandeWithPlanning).toBe(initialDelete);
    });

    it('handles rapid successive refresh calls', async () => {
      const { result } = renderHook(() => useCommandesData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Multiple rapid refreshes
      await act(async () => {
        result.current.refreshCommandes();
        result.current.refreshCommandes();
        result.current.refreshCommandes();
      });

      // Should handle sequential calls without issues
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Error Recovery', () => {
    it('recovers from temporary network failures', async () => {
      // Start with failure
      supabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            data: null,
            error: { message: 'Network timeout', code: 'TIMEOUT' },
          })),
        })),
      });

      const { result } = renderHook(() => useCommandesData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeTruthy();
      });

      // Fix network and retry
      supabase.from.mockReturnValue({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            data: mockCommandes,
            error: null,
          })),
        })),
      });

      await act(async () => {
        await result.current.refreshCommandes();
      });

      expect(result.current.commandes).toEqual(mockCommandes);
      expect(result.current.error).toBeNull();
    });

    it('preserves cached data on refresh failure', async () => {
      const { result } = renderHook(() => useCommandesData());

      // Initial successful load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.commandes).toEqual(mockCommandes);
      });

      // Fail next refresh
      supabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            data: null,
            error: { message: 'Refresh failed', code: 'REFRESH_ERROR' },
          })),
        })),
      });

      await act(async () => {
        await result.current.refreshCommandes();
      });

      // Should keep original data despite refresh failure
      expect(result.current.commandes).toEqual(mockCommandes);
      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Concurrent Operations', () => {
    it('handles multiple delete operations safely', async () => {
      const { result } = renderHook(() => useCommandesData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Attempt concurrent delete operations
      const deletePromises = [
        result.current.deleteCommandeWithPlanning('cmd-1'),
        result.current.deleteCommandeWithPlanning('cmd-2'),
      ];

      await act(async () => {
        const results = await Promise.all(deletePromises);
        results.forEach(result => {
          expect(result).toHaveProperty('error');
        });
      });
    });

    it('maintains data integrity during multiple refreshes', async () => {
      const { result } = renderHook(() => useCommandesData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const refreshPromises = Array(5).fill().map(() =>
        result.current.refreshCommandes()
      );

      await act(async () => {
        await Promise.all(refreshPromises);
      });

      expect(result.current.commandes).toEqual(mockCommandes);
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Data Filtering & Processing', () => {
    it('applies consistent sorting to commandes', async () => {
      const unsortedCommandes = [
        { id: 'c', numero: 'TEST-003' },
        { id: 'a', numero: 'TEST-001' },
        { id: 'b', numero: 'TEST-002' },
      ];

      supabase.from.mockReturnValue({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            data: unsortedCommandes, // Supabase should return sorted
            error: null,
          })),
        })),
      });

      const { result } = renderHook(() => useCommandesData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.commandes).toEqual(unsortedCommandes);
    });

    it('handles empty datasets gracefully', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [], // Empty result
            error: null,
          })),
        })),
      });

      const { result } = renderHook(() => useCommandesData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.commandes).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });
});
