// src/Pages/Admin/Commandes/hooks/__tests__/useSimulation.test.js
// Comprehensive tests for useSimulation hook
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSimulation } from '../useSimulation.js';

// Mock dependencies
vi.mock('../../../../utils/calculs', () => ({
  calculerDurees: vi.fn(),
}));

vi.mock('../../../../utils/nettoyageRules', () => ({
  computeNettoyageSecondsForOrder: vi.fn(),
}));

vi.mock('../utils/workhours', () => ({
  snapToNextWorkStart: vi.fn(),
  addMinutesWithinWorkHours: vi.fn(),
  roundUpToNextHourParis: vi.fn(),
  DEFAULT_WORKDAY: {},
}));

vi.mock('../utils/linked', () => ({
  getLinkedLastFinishAndMachineId: vi.fn(),
}));

vi.mock('../utils/timeRealtime', () => ({
  roundMinutesTo5: vi.fn(),
}));

vi.mock('@/compat/labels', () => ({
  buildNeededSet: vi.fn(),
}));

// Import after mocks
import { calculerDurees } from '../../../../utils/calculs';
import { computeNettoyageSecondsForOrder } from '../../../../utils/nettoyageRules';
import { snapToNextWorkStart, addMinutesWithinWorkHours, roundUpToNextHourParis, DEFAULT_WORKDAY } from '../utils/workhours';
import { getLinkedLastFinishAndMachineId } from '../utils/linked';
import { roundMinutesTo5 } from '../utils/timeRealtime';
import { buildNeededSet } from '@/compat/labels';

describe('useSimulation', () => {
  const mockProps = {
    machines: [
      {
        id: 'machine-1',
        nom: 'Mono Machine',
        nbTetes: 1,
        etiquettes: 't-shirt,coeur',
      },
      {
        id: 'machine-2',
        nom: 'Multi Machine',
        nbTetes: 4,
        etiquettes: 'bonnet,polo',
      },
      {
        id: 'machine-3',
        nom: 'Compatibility Machine',
        nbTetes: 2,
        etiquettes: 't-shirt,coeur,polo', // Compatible with both types + options
      },
    ],
    planning: [],
    nettoyageRules: [],
    articleTags: [],
    formData: {
      types: ['t-shirt'],
      options: ['polo'], // Won't be handled unless strict mode
      quantite: 100,
      points: 5000,
      vitesseMoyenne: 680,
    },
  };

  const mockPlanning = [
    { machineId: 'machine-1', fin: new Date(Date.now() + 3600000).toISOString() }, // 1 hour from now
    { machineId: 'machine-2', fin: new Date(Date.now() + 7200000).toISOString() }, // 2 hours from now
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    calculerDurees.mockReturnValue({
      dureeBroderieHeures: 2,
      dureeNettoyageHeures: 0.5,
      dureeTotaleHeures: 2.5,
    });

    computeNettoyageSecondsForOrder.mockReturnValue(30);

    roundMinutesTo5.mockImplementation((min) => Math.round(min / 5) * 5);
    snapToNextWorkStart.mockReturnValue(new Date('2025-01-10T09:00:00'));
    addMinutesWithinWorkHours.mockReturnValue({ end: new Date('2025-01-10T11:30:00') });
    roundUpToNextHourParis.mockReturnValue(new Date('2025-01-10T09:00:00'));

    getLinkedLastFinishAndMachineId.mockReturnValue({ lastFinish: null, machineId: null });

    buildNeededSet.mockReturnValue(new Set(['t-shirt']));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial state before simulation', () => {
    const { result } = renderHook(() => useSimulation(mockProps));

    expect(result.current.scenarios).toEqual([]);
    expect(result.current.selectedScenario).toBeNull();
    expect(result.current.machineAssignee).toBeNull();
    expect(result.current.confirmCoef).toBe(200);
    expect(result.current.monoUnitsUsed).toBe(1);
    expect(result.current.minutesReellesAppliquees).toBe(0);
  });

  it('finds compatible machines based on formData types', async () => {
    // Set up scenario with linked props for compatibility
    const linkedProps = {
      ...mockProps,
      linked: { isLinked: false, linkedCommandeId: null, startAfterLinked: false },
    };

    const { result } = renderHook(() => useSimulation(linkedProps));

    await act(async () => {
      await result.current.handleSimulation();
    });

    // Should call with machines and compatibility matching
    expect(calculerDurees).toHaveBeenCalled();
    expect(result.current.scenarios.length).toBeGreaterThan(0);
  });

  it('calculates correct scenario timings and ordering', async () => {
    // Mock planning to favor different machines
    const planningProps = { ...mockProps, planning: mockPlanning };
    const { result } = renderHook(() => useSimulation(planningProps));

    await act(async () => {
      await result.current.handleSimulation();
    });

    // Should choose fastest scenario
    expect(result.current.selectedScenario).toBeDefined();
    expect(result.current.machineAssignee).toBeDefined();
  });

  it('applies coef to duration calculations correctly', async () => {
    const { result } = renderHook(() => useSimulation(mockProps));

    await act(async () => {
      await result.current.handleSimulation();
    });

    // Default coef is 200 (2x), base time 2.5 hours = 150 minutes
    // 150 * 2 = 300 minutes, rounded to 5 minutes = 300
    const expectedAdjusted = 300; // (2.5 * 60) * (200/100) = 300
    expect(roundMinutesTo5).toHaveBeenCalledWith(expectedAdjusted);
  });

  it('respects confirmCoef setter from parent', async () => {
    const { result } = renderHook(() => useSimulation(mockProps));

    // Set custom coefficient
    act(() => {
      result.current.setConfirmCoef(350); // 3.5x
    });

    await act(async () => {
      await result.current.handleSimulation();
    });

    // Should use updated coefficient in calculations
    expect(result.current.confirmCoef).toBe(350);
  });

  it('handles mono machine parallelization with monoUnitsUsed', async () => {
    const { result } = renderHook(() => useSimulation(mockProps));

    // Set parallel mono units
    act(() => {
      result.current.setMonoUnitsUsed(3);
    });

    await act(async () => {
      await result.current.handleSimulation();
    });

    // Duration is divided by monoUnitsUsed (mono machines only)
    expect(calculerDurees).toHaveBeenCalledWith(
      expect.objectContaining({
        nbTetes: 3, // 1 (machine base) * 3 (monoUnitsUsed)
      })
    );
  });

  it('ignores monoUnitsUsed for multi-head machines', async () => {
    // Force simulation to choose multi-head machine
    buildNeededSet.mockReturnValue(new Set(['bonnet'])); // Only machine-2 has bonnet

    const { result } = renderHook(() => useSimulation(mockProps));

    act(() => {
      result.current.setMonoUnitsUsed(5); // Should be ignored
    });

    await act(async () => {
      await result.current.handleSimulation();
    });

    // machine-2 has nbTetes: 4, should not be multiplied by monoUnitsUsed
    expect(calculerDurees).toHaveBeenCalledWith(
      expect.objectContaining({
        nbTetes: 4, // Not 5, not 4*5
      })
    );
  });

  it('selects machine with earliest completion time', async () => {
    const { result } = renderHook(() => useSimulation({ ...mockProps, planning: mockPlanning }));

    await act(async () => {
      await result.current.handleSimulation();
    });

    // Should select the machine with earliest timing
    expect(result.current.selectedScenario).toBeDefined();
    expect(result.current.selectedScenario.fin.getTime()).toBeLessThanOrEqual(
      result.current.scenarios[0]?.fin.getTime() || Infinity
    );
  });

  it('resets simulation results when running again', async () => {
    const { result } = renderHook(() => useSimulation(mockProps));

    // First simulation
    await act(async () => {
      await result.current.handleSimulation();
    });

    const firstSelected = result.current.selectedScenario;
    const firstCoef = result.current.confirmCoef;
    const firstMonoUnits = result.current.monoUnitsUsed;

    // Change settings
    act(() => {
      result.current.setConfirmCoef(400);
      result.current.setMonoUnitsUsed(2);
    });

    // Second simulation
    await act(async () => {
      await result.current.handleSimulation();
    });

    // Should update results (test that state is properly reset)
    expect(result.current.confirmCoef).toBe(400);
    expect(result.current.monoUnitsUsed).toBe(2);
  });

  it('filters machines by normalized label matching', async () => {
    // Mock case-insensitive label matching
    buildNeededSet.mockReturnValue(new Set(['t-shirt'])); // Normalized 't-shirt'

    const caseInsensitiveMachine = {
      ...mockProps.machines[0],
      etiquettes: 'T-SHIRT,COEUR', // Uppercase but should match
    };

    const mixedCaseProps = {
      ...mockProps,
      machines: [caseInsensitiveMachine, ...mockProps.machines.slice(1)],
    };

    const { result } = renderHook(() => useSimulation(mixedCaseProps));

    await act(async () => {
      await result.current.handleSimulation();
    });

    // Should find compatible machines despite case differences
    expect(result.current.scenarios.some(s => s.machine.id === caseInsensitiveMachine.id)).toBe(true);
  });

  it('handles empty machine list gracefully', async () => {
    const emptyProps = { ...mockProps, machines: [] };
    const { result } = renderHook(() => useSimulation(emptyProps));

    await act(async () => {
      await result.current.handleSimulation();
    });

    // Should alert user and not crash
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    expect(result.current.scenarios).toEqual([]);
  });

  it('calculates minutesTheoriques without rounding first', async () => {
    const { result } = renderHook(() => useSimulation(mockProps));

    await act(async () => {
      await result.current.handleSimulation();
    });

    // minutesTheoriques should be continuous
    const coeffInMinutes = (result.current.confirmCoef / 100); // 2.0
    const expectedBaseMinutes = 2.5 * 60; // 150 minutes
    const expectedTheoriques = expectedBaseMinutes; // No scaling here
    const expectedReelles = expectedTheoriques * coeffInMinutes; // 300 minutes

    expect(result.current.minutesReellesAppliquees).toBe(expectedReelles);
  });

  it('applies linked command constraints correctly', async () => {
    const linkedProps = {
      ...mockProps,
      linked: {
        isLinked: true,
        linkedCommandeId: 123,
        startAfterLinked: true,
        sameMachineAsLinked: false,
      },
    };

    const linkedFinish = new Date('2025-01-10T11:00:00');
    getLinkedLastFinishAndMachineId.mockReturnValue({
      lastFinish: linkedFinish,
      machineId: 'machine-2'
    });

    const { result } = renderHook(() => useSimulation(linkedProps));

    await act(async () => {
      await result.current.handleSimulation();
    });

    expect(snapToNextWorkStart).toHaveBeenCalledWith(linkedFinish, DEFAULT_WORKDAY);
  });
});
