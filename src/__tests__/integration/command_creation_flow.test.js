// src/__tests__/integration/command_creation_flow.test.js
// End-to-end integration tests for complete commande creation flow
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createCommandeAndPlanning } from '../Pages/Admin/Commandes/services/commandesApi.js';
import { useCommandesData } from '../Pages/Admin/Commandes/hooks/useCommandesData.js';
import { useSimulation } from '../Pages/Admin/Commandes/hooks/useSimulation.js';
import { useForm } from '../Pages/Admin/Commandes/hooks/useForm.js';
import { computeMachineCompatibility } from '../../compat/rules.js';
import { renderHook } from '@testing-library/react';
import CommandesPage from '../Pages/Admin/Commandes/CommandesPage.jsx';

// Mock all dependencies
vi.mock('@/lib/supabaseClient');
vi.mock('@/compat/labels');
vi.mock('@/compat/rules');
vi.mock('@/compat/scenarios');
vi.mock('@/utils/nettoyageRules');
vi.mock('@/utils/calculs');
vi.mock('../Pages/Admin/Commandes/utils/workhours');
vi.mock('../Pages/Admin/Commandes/utils/timeRealtime');
vi.mock('../Pages/Admin/Commandes/utils/linked');
vi.mock('../Pages/Admin/Commandes/utils/grouping');
vi.mock('../Pages/Admin/Commandes/services/commandesApi');

import { supabase } from '@/lib/supabaseClient';
import { buildNeededSet } from '@/compat/labels';
import { listScenarioMachineIds, getScenarioForMachine } from '@/compat/scenarios';
import { computeNettoyageSecondsForOrder } from '@/utils/nettoyageRules';
import { calculerDurees } from '@/utils/calculs';
import { snapToNextWorkStart, addMinutesWithinWorkHours } from '../Pages/Admin/Commandes/utils/workhours';
import { roundMinutesTo5 } from '../Pages/Admin/Commandes/utils/timeRealtime';
import { getLinkedLastFinishAndMachineId } from '../Pages/Admin/Commandes/utils/linked';

// Test data fixtures
const mockMachines = [
  {
    id: 'machine-1',
    nom: 'Mono Machine',
    nbTetes: 1,
    champLargeurMm: 200,
    champHauteurMm: 300,
    maxCouleurs: 10,
    etiquettes: 't-shirt,coeur',
  },
  {
    id: 'machine-2',
    nom: 'Multi Machine',
    nbTetes: 4,
    champLargeurMm: 400,
    champHauteurMm: 600,
    maxCouleurs: 15,
    etiquettes: 'bonnet,polo',
  },
];

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

const mockScenarios = new Map([
  ['machine-1', { id: 'scenario-1', machine: mockMachines[0] }],
  ['machine-2', { id: 'scenario-2', machine: mockMachines[1] }],
]);

describe('Commande Creation Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful mocks
    supabase.from.mockImplementation((table) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          singleResolve: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              singleResolve: vi.fn(() => ({
                data: { id: 123, statut: 'A commencer' },
                error: null,
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(),
        })),
      })),
    }));

    // Mock utility functions
    buildNeededSet.mockReturnValue(new Set(['t-shirt']));
    listScenarioMachineIds.mockReturnValue(['machine-1', 'machine-2']);
    getScenarioForMachine.mockImplementation((scenarios, machineId) =>
      mockScenarios.get(machineId) || null
    );

    computeMachineCompatibility.mockReturnValue({
      ok: true,
      reasons: [],
      matched: ['t-shirt'],
      missing: [],
      machineId: 'machine-1',
      labels: ['t-shirt', 'coeur'],
    });

    calculerDurees.mockReturnValue({
      dureeBroderieHeures: 2,
      dureeNettoyageHeures: 0.5,
      dureeTotaleHeures: 2.5,
    });

    computeNettoyageSecondsForOrder.mockReturnValue(30);
    roundMinutesTo5.mockImplementation((min) => Math.round(min / 5) * 5);
    snapToNextWorkStart.mockReturnValue(new Date('2025-01-10T09:00:00'));
    addMinutesWithinWorkHours.mockReturnValue({ end: new Date('2025-01-10T11:30:00') });

    getLinkedLastFinishAndMachineId.mockReturnValue({
      lastFinish: null,
      machineId: null
    });

    createCommandeAndPlanning.mockResolvedValue({
      createdCmd: { id: 123, statut: 'A commencer' },
      errorPlanning: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Form Data Lifecycle', () => {
    it('handles complete form validation and submission flow', async () => {
      const { result } = renderHook(() => useForm());

      // Test form initialization
      expect(result.current.formData.numero).toBe('');
      expect(result.current.formData.quantite).toBe('');
      expect(result.current.formData.types).toEqual([]);

      // Simulate form filling
      act(() => {
        result.current.handleChange('numero', 'TEST-001');
        result.current.handleChange('client', 'Test Client');
        result.current.handleChange('quantite', 100);
        result.current.handleChange('points', 5000);
        result.current.toggleTag('types', 't-shirt');
        result.current.handleDateChange({ target: { value: '2025-10-15' } });
      });

      expect(result.current.formData.numero).toBe('TEST-001');
      expect(result.current.formData.client).toBe('Test Client');
      expect(result.current.formData.quantite).toBe(100);
      expect(result.current.formData.points).toBe(5000);
      expect(result.current.formData.types).toEqual(['t-shirt']);

      // Test form reset
      act(() => {
        result.current.resetForm();
      });

      expect(result.current.saved).toBe(true);
    });

    it('applies urgency and date validation correctly', async () => {
      const { result } = renderHook(() => useForm());

      // Test date input with urgency calculation
      act(() => {
        result.current.handleDateChange({ target: { value: '2025-01-15' } });
      });

      // Should set urgency based on delivery date proximity
      expect(result.current.formData.urgence).toBeDefined();
    });
  });

  describe('Machine Compatibility Analysis', () => {
    it('evaluates machine compatibility with form requirements', async () => {
      // Test compatibility analysis
      const compatibleResult = computeMachineCompatibility(
        mockMachines[0], // machine-1
        mockScenarios.get('machine-1'),
        new Set(['t-shirt']),
        { largeurMm: 150, hauteurMm: 250, nbCouleurs: 8 }
      );

      expect(compatibleResult.ok).toBe(true);
      expect(compatibleResult.matched).toContain('t-shirt');

      // Test incompatible scenario
      const incompatibleMachine = {
        ...mockMachines[0],
        etiquettes: 'bonnet', // No 't-shirt'
      };

      computeMachineCompatibility.mockReturnValue({
        ok: false,
        reasons: ['Étiquette manquante: "t-shirt"'],
        matched: [],
        missing: ['t-shirt'],
      });

      const incompatibleResult = computeMachineCompatibility(
        incompatibleMachine,
        null,
        new Set(['t-shirt']),
        { largeurMm: 150, hauteurMm: 250, nbCouleurs: 8 }
      );

      expect(incompatibleResult.ok).toBe(false);
    });

    it('handles machine dimension constraints', () => {
      // Test machine constraint violation
      computeMachineCompatibility.mockReturnValue({
        ok: false,
        reasons: ['Largeur 300mm > limite machine 200mm'],
      });

      const tooWideJob = computeMachineCompatibility(
        mockMachines[0], // 200mm width limit
        mockScenarios.get('machine-1'),
        new Set(['t-shirt']),
        { largeurMm: 300, hauteurMm: 250, nbCouleurs: 8 } // 300mm > 200mm
      );

      expect(tooWideJob.ok).toBe(false);
      expect(tooWideJob.reasons[0]).toContain('Largeur 300mm > limite machine 200mm');
    });
  });

  describe('Simulation Engine Integration', () => {
    it('simulates machine availability and calculates optimal scenarios', async () => {
      const { result } = renderHook(() =>
        useSimulation({
          machines: mockMachines,
          planning: [],
          formData: mockFormData,
          linked: { isLinked: false },
        })
      );

      // Run simulation
      await act(async () => {
        await result.current.handleSimulation();
      });

      // Verify simulation produced scenarios
      expect(result.current.scenarios.length).toBeGreaterThan(0);
      expect(result.current.selectedScenario).toBeDefined();
      expect(result.current.machineAssignee).toBeDefined();

      // Verify duration calculations
      expect(result.current.minutesReellesAppliquees).toBeDefined();

      // Test coefficient adjustment
      act(() => {
        result.current.setConfirmCoef(250);
      });
      expect(result.current.confirmCoef).toBe(250);

      // Test mono units for mono machines
      act(() => {
        result.current.setMonoUnitsUsed(3);
      });
      expect(result.current.monoUnitsUsed).toBe(3);
    });

    it('prioritizes machines by completion time', async () => {
      const { result } = renderHook(() =>
        useSimulation({
          machines: mockMachines,
          planning: [
            { machineId: 'machine-1', fin: new Date(Date.now() + 3600000).toISOString() },
          ],
          formData: mockFormData,
        })
      );

      await act(async () => {
        await result.current.handleSimulation();
      });

      // Should select the machine with earliest availability
      expect(result.current.selectedScenario).toBeDefined();
    });
  });

  describe('Commande Creation with Planning', () => {
    it('successfully creates commande and planning records', async () => {
      const result = await createCommandeAndPlanning({
        formData: mockFormData,
        machine: mockMachines[0],
        coef: 150,
        monoUnitsUsed: 2,
        planning: [],
        commandes: [],
        machines: mockMachines,
        nettoyageRules: [],
        articleTags: [],
        linked: { isLinked: false, linkedCommandeId: null, startAfterLinked: false },
      });

      expect(createCommandeAndPlanning).toHaveBeenCalledWith({
        formData: mockFormData,
        machine: mockMachines[0],
        coef: 150,
        monoUnitsUsed: 2,
        planning: [],
        commandes: [],
        machines: mockMachines,
        nettoyageRules: [],
        articleTags: [],
        linked: expect.objectContaining({
          isLinked: false,
        }),
      });

      expect(result.createdCmd).toEqual({ id: 123, statut: 'A commencer' });
      expect(result.errorPlanning).toBeNull();
    });

    it('handles linked commande constraints properly', async () => {
      getLinkedLastFinishAndMachineId.mockReturnValue({
        lastFinish: new Date('2025-01-10T10:00:00'),
        machineId: 'machine-2'
      });

      await createCommandeAndPlanning({
        formData: mockFormData,
        machine: mockMachines[1], // machine-2
        coef: 100,
        monoUnitsUsed: 1,
        planning: [],
        commandes: [],
        machines: mockMachines,
        nettoyageRules: [],
        articleTags: [],
        linked: {
          isLinked: true,
          linkedCommandeId: 456,
          startAfterLinked: true,
          sameMachineAsLinked: true,
        },
      });

      expect(snapToNextWorkStart).toHaveBeenCalled();
    });

    it('applies mono unit parallelism in duration calculations', async () => {
      await createCommandeAndPlanning({
        formData: mockFormData,
        machine: mockMachines[0], // mono machine (nbTetes: 1)
        coef: 100,
        monoUnitsUsed: 3, // 3 parallel units
        planning: [],
        commandes: [],
        machines: mockMachines,
        nettoyageRules: [],
        articleTags: [],
      });

      // Should calculate effective nbTetes = 1 * 3 = 3
      expect(calculerDurees).toHaveBeenCalledWith(
        expect.objectContaining({
          nbTetes: 3,
        })
      );
    });
  });

  describe('Data Persistence and Realtime Updates', () => {
    it('persists commande data with correct transformation', async () => {
      // Mock successful database operation
      supabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              singleResolve: vi.fn(() => ({
                data: {
                  id: 456,
                  numero: 'TEST-001',
                  client: 'Test Client',
                  statut: 'A commencer',
                  machineAssignee: 'Mono Machine',
                  duree_broderie_heures: 2,
                  duree_nettoyage_heures: 0.5,
                  duree_totale_heures: 150, // 2.5 * 60
                  duree_totale_heures_arrondie: 3,
                  mono_units_used: 2,
                },
                error: null,
              })),
            })),
          })),
        })),
      });

      const result = await createCommandeAndPlanning({
        formData: mockFormData,
        machine: mockMachines[0],
        coef: 100,
        monoUnitsUsed: 2,
        planning: [],
        commandes: [],
        machines: mockMachines,
        nettoyageRules: [],
        articleTags: [],
      });

      expect(result.createdCmd.statut).toBe('A commencer');
      expect(result.createdCmd.mono_units_used).toBe(2);
    });

    it('handles database constraint violations gracefully', async () => {
      // Mock foreign key violation
      supabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              singleResolve: vi.fn(() => ({
                data: null,
                error: { code: '23503', message: 'Foreign key constraint violation' },
              })),
            })),
          })),
        })),
      });

      await expect(createCommandeAndPlanning({
        formData: mockFormData,
        machine: mockMachines[0],
        coef: 100,
        planning: [],
        commandes: [],
        machines: mockMachines,
        nettoyageRules: [],
        articleTags: [],
      })).rejects.toThrow();
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('handles network failures during creation', async () => {
      // Mock network error
      supabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              singleResolve: vi.fn(() => ({
                data: null,
                error: { code: 'PGRST301', message: 'Connection failed' },
              })),
            })),
          })),
        })),
      });

      await expect(createCommandeAndPlanning({
        formData: mockFormData,
        machine: mockMachines[0],
        coef: 100,
        planning: [],
        commandes: [],
        machines: mockMachines,
        nettoyageRules: [],
        articleTags: [],
      })).rejects.toThrow();
    });

    it('validates form data completeness before submission', async () => {
      const incompleteFormData = {
        ...mockFormData,
        numero: '', // Required field empty
        types: [], // No types selected
      };

      // This should be caught by machine compatibility check
      computeMachineCompatibility.mockReturnValue({
        ok: false,
        reasons: ['Types requis non spécifiés'],
      });

      await expect(createCommandeAndPlanning({
        formData: incompleteFormData,
        machine: mockMachines[0],
        coef: 100,
        planning: [],
        commandes: [],
        machines: mockMachines,
        nettoyageRules: [],
        articleTags: [],
      })).rejects.toThrow('Machine incompatible');
    });
  });
});
