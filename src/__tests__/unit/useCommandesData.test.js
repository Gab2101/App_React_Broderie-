import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockSupabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => ({ data: {}, error: null }) })) })) })),
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => ({ data: {}, error: null })) })) })),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
      eq: vi.fn(() => ({ data: [], error: null })),
      order: vi.fn(() => ({ data: [], error: null })),
    })),
    channel: vi.fn(() => ({ on: vi.fn(() => ({})), subscribe: vi.fn(() => 'SUB') })),
    removeChannel: vi.fn(() => {}),
  }
}));

vi.mock('@/lib/supabaseClient', () => ({ default: hoisted.mockSupabase }));

import useCommandesData from '@/Pages/Admin/Commandes/hooks/useCommandesData';

vi.mock('@/utils/CommandesService', () => ({
  replaceCommandeInArray: vi.fn((arr, newItem) => 
    arr.map(item => item.id === newItem.id ? newItem : item)
  ),
}));

vi.mock('@/utils/nettoyageRules', () => ({
  fetchNettoyageRules: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@/realtime/commandesChannel', () => ({
  attachCommandesListener: vi.fn(() => vi.fn()),
}));

describe('useCommandesData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty arrays', () => {
    const { result } = renderHook(() => useCommandesData());
    
    expect(result.current.commandes).toEqual([]);
    expect(result.current.machines).toEqual([]);
    expect(result.current.planning).toEqual([]);
    expect(result.current.linkableCommandes).toEqual([]);
    expect(result.current.nettoyageRules).toEqual([]);
  });

  it('fetches data on mount', async () => {
    const mockCommandes = [
      { id: 1, numero: 'CMD001', statut: 'En cours' },
    ];
    const mockMachines = [
      { id: 1, nom: 'Machine 1' },
    ];
    
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'commandes') {
        return {
          select: vi.fn(() => Promise.resolve({ 
            data: mockCommandes, 
            error: null 
          })),
        };
      }
      if (table === 'machines') {
        return {
          select: vi.fn(() => Promise.resolve({ 
            data: mockMachines, 
            error: null 
          })),
        };
      }
      return {
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      };
    });

    const { result } = renderHook(() => useCommandesData());

    await waitFor(() => {
      expect(result.current.commandes.length).toBeGreaterThan(0);
    });
  });

  it('handles fetch errors gracefully', async () => {
    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn(() => Promise.resolve({ 
        data: null, 
        error: { message: 'Network error' } 
      })),
    }));

    const { result } = renderHook(() => useCommandesData());

    await waitFor(() => {
      expect(result.current.commandes).toEqual([]);
      expect(result.current.machines).toEqual([]);
    });
  });

  it('provides reloadData function', () => {
    const { result } = renderHook(() => useCommandesData());
    
    expect(typeof result.current.reloadData).toBe('function');
  });

  it('reloads data when reloadData is called', async () => {
    const { result } = renderHook(() => useCommandesData());

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalled();
    });

    const initialCallCount = mockSupabase.from.mock.calls.length;
    
    await result.current.reloadData();

    expect(mockSupabase.from.mock.calls.length).toBeGreaterThan(initialCallCount);
  });

  it('filters linkable commandes by status', async () => {
    const mockCommandes = [
      { id: 1, numero: 'CMD001', statut: 'En cours' },
      { id: 2, numero: 'CMD002', statut: 'Terminée' },
      { id: 3, numero: 'CMD003', statut: 'A commencer' },
    ];

    const mockLinkableCommandes = mockCommandes.filter(c => 
      ['A commencer', 'En cours'].includes(c.statut)
    );

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'commandes') {
        const call = mockSupabase.from.mock.calls.length;
        // First call returns all, second call returns filtered
        if (call === 1) {
          return {
            select: vi.fn(() => Promise.resolve({ 
              data: mockCommandes, 
              error: null 
            })),
          };
        } else {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => Promise.resolve({
                data: mockLinkableCommandes,
                error: null
              }))
            })),
          };
        }
      }
      return {
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      };
    });

    const { result } = renderHook(() => useCommandesData());

    await waitFor(() => {
      expect(result.current.linkableCommandes.length).toBe(2);
    });
  });
});
