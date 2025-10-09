// src/Pages/Admin/Commandes/services/__tests__/commandesApi.test.js
// Comprehensive tests for commandesApi service with error handling
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCommandeAndPlanning, updateCommande, deleteCommandeWithPlanning } from '../commandesApi.js';
import { assertNoSupabaseError, SupabaseError } from '@/utils/errorHandler.js';

// Mock dependencies
vi.mock('@/lib/supabaseClient', () => ({
  default: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          singleResolve: vi.fn().mockResolvedValue({ data: { id: 'commande1' }, error: null }),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(),
            singleResolve: vi.fn().mockResolvedValue({ data: { id: 'commande1' }, error: null }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(),
        })),
      })),
    })),
  },
}));

vi.mock('@/utils/nettoyageRules', () => ({
  computeNettoyageSecondsForOrder: vi.fn(),
}));

vi.mock('@/utils/calculs', () => ({
  calculerDurees: vi.fn(),
}));

vi.mock('@/utils/nettoyageRules');
vi.mock('@/utils/calculs');
vi.mock('../utils/linked');
vi.mock('../utils/timeRealtime');
vi.mock('../utils/workhours');

// Import after mocks
import supabase from '@/lib/supabaseClient';
import { computeNettoyageSecondsForOrder } from '@/utils/nettoyageRules';
import { calculerDurees } from '@/utils/calculs';
import { getLinkedLastFinishAndMachineId, getMachineByName } from '../utils/linked';
import { roundMinutesTo5 } from '../utils/timeRealtime';
import { snapToNextWorkStart, addMinutesWithinWorkHours, roundUpToNextHourParis, DEFAULT_WORKDAY } from '../utils/workhours';
import { createCommandeAndPlanning, updateCommande, deleteCommandeWithPlanning } from '../commandesApi.js';
import { assertNoSupabaseError, SupabaseError } from '@/utils/errorHandler.js';

describe('createCommandeAndPlanning', () => {
  const mockFormData = {
    numero: 'TEST-001',
    client: 'Test Client',
    quantite: 100,
    points: 5000,
    urgence: 3,
    dateLivraison: '2025-10-15',
    types: ['t-shirt'],
    options: [],
    vitesseMoyenne: 680,
  };

  const mockMachine = {
    id: 'machine-1',
    nom: 'Machine Test',
    nbTetes: 1,
    etiquettes: 't-shirt,coeur',
  };

  const mockPlanning = [];
  const mockMachines = [mockMachine];
  const mockNettoyageRules = [];
  const mockArticleTags = [];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful mocks
    supabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          singleResolve: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            singleResolve: vi.fn().mockResolvedValue({ data: { id: 'commande1' }, error: null }),
          })),
        })),
      })),
    });

    computeNettoyageSecondsForOrder.mockReturnValue(30);
    calculerDurees.mockReturnValue({
      dureeBroderieHeures: 2,
      dureeNettoyageHeures: 0.5,
      dureeTotaleHeures: 2.5,
    });

    roundMinutesTo5.mockImplementation((min) => Math.round(min / 5) * 5);
    snapToNextWorkStart.mockReturnValue(new Date('2025-01-10T09:00:00'));
    addMinutesWithinWorkHours.mockReturnValue({ end: new Date('2025-01-10T11:30:00') });
    roundUpToNextHourParis.mockReturnValue(new Date('2025-01-10T09:00:00'));

    getLinkedLastFinishAndMachineId.mockReturnValue({ lastFinish: null, machineId: null });
    getMachineByName.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates commande successfully with compatible machine', async () => {
    const result = await createCommandeAndPlanning({
      formData: mockFormData,
      machine: mockMachine,
      coef: 100,
      monoUnitsUsed: 1,
      planning: mockPlanning,
      commandes: [],
      machines: mockMachines,
      nettoyageRules: mockNettoyageRules,
      articleTags: mockArticleTags,
    });

    expect(result.createdCmd).toBeDefined();
    expect(result.errorPlanning).toBeUndefined();
    expect(computeNettoyageSecondsForOrder).toHaveBeenCalledWith(
      't-shirt',
      [],
      mockNettoyageRules,
      mockArticleTags
    );
    expect(calculerDurees).toHaveBeenCalledWith({
      quantite: 100,
      points: 5000,
      vitesse: 680,
      nbTetes: 1, // monoUnitsUsed applied
      nettoyageParArticleSec: 30,
    });
  });

  it('applies monoUnitsUsed to effective nbTetes calculation', async () => {
    await createCommandeAndPlanning({
      formData: mockFormData,
      machine: mockMachine,
      coef: 150,
      monoUnitsUsed: 3, // 3 units parallel
      planning: mockPlanning,
      commandes: [],
      machines: mockMachines,
      nettoyageRules: mockNettoyageRules,
      articleTags: mockArticleTags,
    });

    expect(calculerDurees).toHaveBeenCalledWith({
      quantite: 100,
      points: 5000,
      vitesse: 680,
      nbTetes: 3, // machine.nbTetes (1) * monoUnitsUsed (3)
      nettoyageParArticleSec: 30,
    });
  });

  it('applies coef correctly to duration calculation', async () => {
    await createCommandeAndPlanning({
      formData: mockFormData,
      machine: mockMachine,
      coef: 200,
      monoUnitsUsed: 1,
      planning: mockPlanning,
      commandes: [],
      machines: mockMachines,
      nettoyageRules: mockNettoyageRules,
      articleTags: mockArticleTags,
    });

    // 2.5 hours * 60 = 150 minutes
    // 150 * 200/100 = 300 minutes
    // roundMinutesTo5(300) = 300 (already multiple of 5)
    expect(roundMinutesTo5).toHaveBeenCalledWith(300);
  });

  it('throws SupabaseError when machine incompatible', async () => {
    // Mock incompatible machine
    const incompatibleMachine = {
      ...mockMachine,
      etiquettes: 'bonnet', // No 't-shirt'
    };

    await expect(createCommandeAndPlanning({
      formData: mockFormData,
      machine: incompatibleMachine,
      coef: 100,
      monoUnitsUsed: 1,
      planning: mockPlanning,
      commandes: [],
      machines: mockMachines,
      nettoyageRules: mockNettoyageRules,
      articleTags: mockArticleTags,
    })).rejects.toThrow('Machine incompatible');
  });

  it('validates linked commande machine constraint', async () => {
    const linkedCommandeId = 123;
    const wrongMachine = {
      ...mockMachine,
      nom: 'Wrong Machine',
      id: 'machine-wrong',
    };

    getLinkedLastFinishAndMachineId.mockReturnValue({
      lastFinish: null,
      machineId: 'machine-different'
    });

    getMachineByName.mockReturnValue({
      id: 'machine-different',
      nom: 'Linked Machine'
    });

    await expect(createCommandeAndPlanning({
      formData: mockFormData,
      machine: wrongMachine,
      coef: 100,
      monoUnitsUsed: 1,
      planning: mockPlanning,
      commandes: [{ id: linkedCommandeId }],
      machines: mockMachines,
      nettoyageRules: mockNettoyageRules,
      articleTags: mockArticleTags,
      linked: {
        isLinked: true,
        linkedCommandeId,
        sameMachineAsLinked: true,
        startAfterLinked: false,
      },
    })).rejects.toThrow('La machine sélectionnée doit être la même que celle de la commande liée');
  });

  it('handles Supabase insert failure', async () => {
    // Mock failed insert
    supabase.from.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Insert failed', code: '23505' }
          }),
        })),
      })),
    });

    await expect(createCommandeAndPlanning({
      formData: mockFormData,
      machine: mockMachine,
      coef: 100,
      monoUnitsUsed: 1,
      planning: mockPlanning,
      commandes: [],
      machines: mockMachines,
      nettoyageRules: mockNettoyageRules,
      articleTags: mockArticleTags,
    })).rejects.toThrow(SupabaseError);

    await expect(createCommandeAndPlanning({
      formData: mockFormData,
      machine: mockMachine,
      coef: 100,
      monoUnitsUsed: 1,
      planning: mockPlanning,
      commandes: [],
      machines: mockMachines,
      nettoyageRules: mockNettoyageRules,
      articleTags: mockArticleTags,
    })).rejects.toMatchObject({
      operation: 'insert from commandes',
      code: '23505',
    });
  });

  it('handles planning creation after successful commande creation', async () => {
    await createCommandeAndPlanning({
      formData: mockFormData,
      machine: mockMachine,
      coef: 100,
      monoUnitsUsed: 1,
      planning: mockPlanning,
      commandes: [],
      machines: mockMachines,
      nettoyageRules: mockNettoyageRules,
      articleTags: mockArticleTags,
    });

    expect(supabase.from).toHaveBeenCalledWith('planning');
    expect(supabase.from).toHaveBeenCalledWith('commandes');
  });

  it('applies linked command timing constraints', async () => {
    const futureDate = new Date('2025-01-11T10:00:00');

    getLinkedLastFinishAndMachineId.mockReturnValue({
      lastFinish: futureDate,
      machineId: 'machine-1',
    });

    await createCommandeAndPlanning({
      formData: mockFormData,
      machine: mockMachine,
      coef: 100,
      monoUnitsUsed: 1,
      planning: mockPlanning,
      commandes: [],
      machines: mockMachines,
      nettoyageRules: mockNettoyageRules,
      articleTags: mockArticleTags,
      linked: {
        isLinked: true,
        linkedCommandeId: 123,
        sameMachineAsLinked: true,
        startAfterLinked: true,
      },
    });

    expect(snapToNextWorkStart).toHaveBeenCalledWith(futureDate, DEFAULT_WORKDAY);
  });

  it('normalizes dates for database storage', async () => {
    const formDataWithDate = {
      ...mockFormData,
      dateLivraison: new Date('2025-10-15'), // Date object
    };

    await createCommandeAndPlanning({
      formData: formDataWithDate,
      machine: mockMachine,
      coef: 100,
      monoUnitsUsed: 1,
      planning: mockPlanning,
      commandes: [],
      machines: mockMachines,
      nettoyageRules: mockNettoyageRules,
      articleTags: mockArticleTags,
    });

    // Should convert to UTC ISO string
    expect(supabase.from).toHaveBeenCalledWith('commandes');
    const insertCall = supabase.from('commandes').insert;
    const commandPayload = insertCall.mock.calls[0][0][0];
    expect(commandPayload.dateLivraison).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('tracks mono_units_used in database', async () => {
    await createCommandeAndPlanning({
      formData: mockFormData,
      machine: mockMachine,
      coef: 100,
      monoUnitsUsed: 4,
      planning: mockPlanning,
      commandes: [],
      machines: mockMachines,
      nettoyageRules: mockNettoyageRules,
      articleTags: mockArticleTags,
    });

    const insertCall = supabase.from('commandes').insert;
    const commandPayload = insertCall.mock.calls[0][0][0];
    expect(commandPayload.mono_units_used).toBe(4);
  });
});

describe('updateCommande', () => {
  it('calls Supabase update with correct parameters', async () => {
    const mockFormData = { id: 123, numero: 'UPDATED-001' };

    await updateCommande(mockFormData);

    expect(supabase.from).toHaveBeenCalledWith('commandes');
    expect(supabase.from().update).toHaveBeenCalledWith(mockFormData);
    expect(supabase.from().update().eq).toHaveBeenCalledWith('id', 123);
  });

  it('throws SupabaseError on update failure', async () => {
    // Mock failure
    supabase.from.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          singleResolve: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Update failed', code: '23P01' }
          }),
        })),
      })),
    });

    await expect(updateCommande({ id: 123 })).rejects.toThrow(SupabaseError);
  });
});

describe('deleteCommandeWithPlanning', () => {
  beforeEach(() => {
    // Mock planning entries
    supabase.from.mockImplementation((table) => {
      if (table === 'planning') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              singleResolve: vi.fn().mockResolvedValue({
                data: [{ id: 'planning1' }, { id: 'planning2' }],
                error: null
              }),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              singleResolve: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        };
      }

      if (table === 'commandes') {
        return {
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              singleResolve: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        };
      }

      return {};
    });
  });

  it('deletes planning entries first, then commande', async () => {
    const result = await deleteCommandeWithPlanning(123);

    expect(result.error).toBeNull();

    // Should select planning first
    expect(supabase.from).toHaveBeenCalledWith('planning');

    // Should delete planning entries
    expect(supabase.from).toHaveBeenCalledWith('commandes');

    // Should delete commande last
    const commandesDeleteCall = supabase.from('commandes').delete;
    expect(commandesDeleteCall).toHaveBeenCalled();
  });

  it('handles planning selection failure', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'planning') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              singleResolve: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Select failed', code: '42P01' }
              }),
            })),
          })),
        };
      }
      return {};
    });

    const result = await deleteCommandeWithPlanning(123);

    expect(result.error).toBeDefined();
    console.log('Planning selection error logged');
  });

  it('handles planning deletion failure', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'planning') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              singleResolve: vi.fn().mockResolvedValue({
                data: [{ id: 'planning1' }],
                error: null
              }),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              singleResolve: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Delete failed', code: '23P01' }
              }),
            })),
          })),
        };
      }
      return {};
    });

    const result = await deleteCommandeWithPlanning(123);

    expect(console.error).toHaveBeenCalledWith('Erreur suppression planning:', expect.any(Object));
  });
});
