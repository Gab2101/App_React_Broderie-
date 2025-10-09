// src/compat/__tests__/rules.test.js
// Comprehensive tests for machine compatibility rules
import { describe, it, expect } from 'vitest';
import { computeMachineCompatibility, isMachineCompatible } from '../rules.js';

describe('computeMachineCompatibility', () => {
  const mockMachine = {
    id: 'machine-1',
    nom: 'Test Machine',
    nbTetes: 1,
    champLargeurMm: 200,
    champHauteurMm: 300,
    maxCouleurs: 10
  };

  const mockScenario = {
    id: 'scenario-1',
    etiquettes: 't-shirt,coeur',
    _labels: new Set(['t-shirt', 'coeur']) // Pre-normalized
  };

  const mockMachine2 = { ...mockMachine, id: 'machine-2' };
  const mockScenario2 = { ...mockScenario, id: 'scenario-2' };

  it('returns ok=true when all constraints are met with scenario', () => {
    const jobSpec = { largeurMm: 150, hauteurMm: 250, nbCouleurs: 8 };
    const result = computeMachineCompatibility(mockMachine, mockScenario, ['t-shirt'], jobSpec);

    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.machineId).toBe('machine-1');
    expect(result.scenarioId).toBe('scenario-1');
    expect(result.labels).toEqual(['t-shirt', 'coeur']);
    expect(result.matched).toEqual(['t-shirt']);
    expect(result.missing).toEqual([]);
  });

  it('NO_SCENARIO when scenario is null', () => {
    const result = computeMachineCompatibility(mockMachine, null, ['t-shirt']);

    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual([{
      code: 'NO_SCENARIO',
      message: 'Aucun scénario pour cette machine'
    }, {
      code: 'MISSING_LABEL',
      label: 't-shirt',
      message: 'Étiquette manquante: "t-shirt"'
    }]);
  });

  it('MISSING_LABEL for each required label not present', () => {
    const result = computeMachineCompatibility(mockMachine, mockScenario, ['t-shirt', 'bonnet']);

    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual([{
      code: 'MISSING_LABEL',
      label: 'bonnet',
      message: 'Étiquette manquante: "bonnet"'
    }]);
    expect(result.matched).toEqual(['t-shirt']);
    expect(result.missing).toEqual(['bonnet']);
  });

  it('ANTI_LABEL_CONFLICT when job wants "coeur" and machine has "anti-coeur"', () => {
    const antiCoeurScenario = {
      ...mockScenario,
      etiquettes: 't-shirt,anti-coeur',
      _labels: new Set(['t-shirt', 'anti-coeur'])
    };

    const result = computeMachineCompatibility(mockMachine, antiCoeurScenario, ['coeur']);

    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual([{
      code: 'MISSING_LABEL',
      label: 'coeur',
      message: 'Étiquette manquante: "coeur"'
    }, {
      code: 'ANTI_LABEL_CONFLICT',
      wanted: 'coeur',
      has: 'anti-coeur',
      message: '"anti-coeur" ne couvre pas "coeur"'
    }]);
  });

  it('WIDTH_EXCEEDED when job width exceeds machine limit', () => {
    const result = computeMachineCompatibility(mockMachine, mockScenario, ['t-shirt'], {
      largeurMm: 250, // > 200
      hauteurMm: 200,
      nbCouleurs: 5
    });

    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual([{
      code: 'WIDTH_EXCEEDED',
      job: 250,
      machine: 200,
      message: 'Largeur 250mm > limite machine 200mm'
    }]);
  });

  it('HEIGHT_EXCEEDED when job height exceeds machine limit', () => {
    const result = computeMachineCompatibility(mockMachine, mockScenario, ['t-shirt'], {
      largeurMm: 150,
      hauteurMm: 350, // > 300
      nbCouleurs: 5
    });

    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual([{
      code: 'HEIGHT_EXCEEDED',
      job: 350,
      machine: 300,
      message: 'Hauteur 350mm > limite machine 300mm'
    }]);
  });

  it('COLORS_EXCEEDED when job colors exceed machine limit', () => {
    const result = computeMachineCompatibility(mockMachine, mockScenario, ['t-shirt'], {
      largeurMm: 150,
      hauteurMm: 250,
      nbCouleurs: 15 // > 10
    });

    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual([{
      code: 'COLORS_EXCEEDED',
      job: 15,
      machine: 10,
      message: 'Couleurs 15 > limite machine 10'
    }]);
  });

  it('handles multiple incompatibility reasons', () => {
    const result = computeMachineCompatibility(mockMachine, mockScenario, ['bonnet'], {
      largeurMm: 250,
      hauteurMm: 350,
      nbCouleurs: 15
    });

    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual([
      {
        code: 'MISSING_LABEL',
        label: 'bonnet',
        message: 'Étiquette manquante: "bonnet"'
      },
      {
        code: 'WIDTH_EXCEEDED',
        job: 250,
        machine: 200,
        message: 'Largeur 250mm > limite machine 200mm'
      },
      {
        code: 'HEIGHT_EXCEEDED',
        job: 350,
        machine: 300,
        message: 'Hauteur 350mm > limite machine 300mm'
      },
      {
        code: 'COLORS_EXCEEDED',
        job: 15,
        machine: 10,
        message: 'Couleurs 15 > limite machine 10'
      }
    ]);
  });

  it('handles missing machine dimensions gracefully', () => {
    const machineNoLimits = { ...mockMachine, champLargeurMm: undefined, champHauteurMm: undefined, maxCouleurs: undefined };

    const result = computeMachineCompatibility(machineNoLimits, mockScenario, ['t-shirt'], {
      largeurMm: 1000,
      hauteurMm: 2000,
      nbCouleurs: 50
    });

    // Should not add constraint violations if machine limits are undefined
    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('isMachineCompatible returns boolean for compatibility check', () => {
    const compatible = isMachineCompatible(mockMachine, mockScenario, ['t-shirt']);
    const incompatible = isMachineCompatible(mockMachine, mockScenario, ['nonexistent']);

    expect(compatible).toBe(true);
    expect(incompatible).toBe(false);
  });

  it('extracts labels from scenario without _labels', () => {
    const scenarioNoLabels = { ...mockScenario };
    delete scenarioNoLabels._labels;

    const result = computeMachineCompatibility(mockMachine, scenarioNoLabels, ['coeur']);

    expect(result.ok).toBe(true);
    expect(result.labels).toContain('coeur');
  });

  it('handles different input types for needed labels', () => {
    // Array input
    const arrayResult = computeMachineCompatibility(mockMachine, mockScenario, ['t-shirt']);
    expect(arrayResult.ok).toBe(true);

    // Set input
    const setResult = computeMachineCompatibility(mockMachine, mockScenario, new Set(['t-shirt']));
    expect(setResult.ok).toBe(true);

    // String input (single label)
    const stringResult = computeMachineCompatibility(mockMachine, mockScenario, 't-shirt');
    expect(stringResult.ok).toBe(true);
  });

  it('handles case-insensitive label matching', () => {
    const uppercaseLabels = new Set(['T-SHIRT', 'COEUR']);
    const uppercaseScenario = { ...mockScenario, _labels: uppercaseLabels };

    const result = computeMachineCompatibility(mockMachine, uppercaseScenario, ['t-shirt']);

    expect(result.ok).toBe(true);
    expect(result.matched).toEqual(['t-shirt']);
  });
});

describe('Error Scenarios', () => {
  const mockMachine = {
    id: 'machine-1',
    nom: 'Test Machine',
    nbTetes: 1,
    champLargeurMm: 200,
    champHauteurMm: 300,
    maxCouleurs: 10
  };

  const mockScenario = {
    id: 'scenario-1',
    etiquettes: 't-shirt,coeur',
    _labels: new Set(['t-shirt', 'coeur'])
  };

  it('handles null/undefined machine gracefully', () => {
    const result = computeMachineCompatibility(null, {}, ['t-shirt']);
    expect(result.machineId).toBe('unknown');
    expect(result.ok).toBe(false);
  });

  it('handles malformed needed labels', () => {
    const result = computeMachineCompatibility(mockMachine, mockScenario, null);
    expect(result.ok).toBe(true); // Empty needed set matches
  });
});
