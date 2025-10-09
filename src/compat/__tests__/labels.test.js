// src/compat/__tests__/labels.test.js
// Comprehensive tests for machine compatibility and label parsing

import { describe, it, expect } from 'vitest';
import { buildNeededSet } from '../labels.js';

// Mock test data
const mockFormData = {
  types: ['Bonnet', 't-shirt'],      // Mixed case (user input)
  options: ['Devant', 'peinture']    // Also mixed case
};

const mockMachines = [
  {
    id: 'machine-1',
    nom: 'Machine 1',
    etiquettes: ["bonnet", "t-shirt", "chemise"], // Has bonnet and t-shirt
  },
  {
    id: 'machine-2',
    nom: 'Machine 2',
    // String format in DB
    etiquettes: "polaire,devant,serviette"
  },
  {
    id: 'machine-3',
    nom: 'Machine 3',
    etiquettes: ["blouse", "casquette"] // Doesn't have bonnet
  }
];

// Helper to simulate machine label parsing (from modal debugging)
function parseMachineLabels(etiquettes) {
  if (Array.isArray(etiquettes)) {
    return new Set(etiquettes.map(String).map(s => s.toLowerCase()).filter(s => s.trim()));
  } else if (etiquettes) {
    // Handle string format
    return new Set(String(etiquettes).toLowerCase().split(/[,;\s]+/).filter(s => s.trim()));
  } else {
    return new Set([]);
  }
}

describe('Machine Compatibility Tests', () => {
  describe('Label Parsing', () => {
    it('parses array etiquettes correctly', () => {
      const machine = mockMachines[0];
      const labels = parseMachineLabels(machine.etiquettes);

      expect(labels.has('bonnet')).toBe(true);
      expect(labels.has('t-shirt')).toBe(true);
      expect(labels.has('chemise')).toBe(true);
      expect(labels.has('invalid')).toBe(false);
    });

    it('parses string etiquettes correctly', () => {
      const machine = mockMachines[1];
      const labels = parseMachineLabels(machine.etiquettes);

      expect(labels.has('polaire')).toBe(true);
      expect(labels.has('devant')).toBe(true);
      expect(labels.has('serviette')).toBe(true);
      expect(labels.has('invalid')).toBe(false);
    });

    it('handles empty/missing etiquettes', () => {
      const labels = parseMachineLabels(null);
      expect(labels.has('anything')).toBe(false);

      const labelsEmpty = parseMachineLabels([]);
      expect(labelsEmpty.has('anything')).toBe(false);
    });

    it('normalizes case correctly', () => {
      const machine = {
        etiquettes: ["BONNET", "T-Shirt", "Chemise"]
      };
      const labels = parseMachineLabels(machine.etiquettes);

      expect(labels.has('bonnet')).toBe(true);
      expect(labels.has('t-shirt')).toBe(true);
      expect(labels.has('chemise')).toBe(true);
    });
  });

  describe('buildNeededSet Logic', () => {
    it('combines types and options from formData', () => {
      const needed = buildNeededSet(mockFormData);
      expect(needed.has('bonnet')).toBe(true);  // types normalized
      expect(needed.has('t-shirt')).toBe(true); // types normalized
      expect(needed.size).toBe(4); // 2 types + 2 options
    });

    it('only uses types when options ignored', () => {
      const needed = buildNeededSet({
        ...mockFormData,
        options: []
      });
      expect(needed.has('bonnet')).toBe(true);
      expect(needed.has('t-shirt')).toBe(true);
      expect(needed.has('devant')).toBe(false);
      expect(needed.size).toBe(2);
    });

    it('normalizes case from formData', () => {
      const needed = buildNeededSet(mockFormData);
      expect(needed.has('bonnet')).toBe(true);  // Bonnet → bonnet
      expect(needed.has('devant')).toBe(true);  // Devant → devant
    });

    it('handles string inputs', () => {
      const needed = buildNeededSet({
        types: 'bonnet,t-shirt',
        options: 'devant peinture'
      });
      expect(needed.size).toBe(4);
      expect(needed.has('bonnet')).toBe(true);
      expect(needed.has('peinture')).toBe(true);
    });
  });

  describe('Compatibility Checking Logic', () => {
    it('finds machine with required labels (exact match)', () => {
      // Machine has bonnet + t-shirt, we need only bonnet
      const machine = mockMachines[0];
      const needed = new Set(['bonnet']);

      const machineLabels = parseMachineLabels(machine.etiquettes);
      const missing = Array.from(needed).filter(req => !machineLabels.has(req.toLowerCase()));

      expect(missing).toEqual([]);
      expect(missing.length).toBe(0);
    });

    it('identifies truly missing labels', () => {
      // Machine has bonnet + t-shirt, we need bonnet + polo
      const machine = mockMachines[0];
      const needed = new Set(['bonnet', 'polo']);

      const machineLabels = parseMachineLabels(machine.etiquettes);
      const missing = Array.from(needed).filter(req => !machineLabels.has(req.toLowerCase()));

      expect(missing).toEqual(['polo']);
      expect(missing.length).toBe(1);
    });

    it('works with string etiquettes', () => {
      // Machine has "polaire,devant,serviette", we need "devant"
      const machine = mockMachines[1];
      const needed = new Set(['devant']);

      const machineLabels = parseMachineLabels(machine.etiquettes);
      const missing = Array.from(needed).filter(req => !machineLabels.has(req.toLowerCase()));

      expect(missing).toEqual([]);
      expect(missing.length).toBe(0);
    });

    it('shows all missing labels for incompatible machine', () => {
      // Machine has "blouse","casquette", we need "bonnet","devant"
      const machine = mockMachines[2];
      const needed = new Set(['bonnet', 'devant']);

      const machineLabels = parseMachineLabels(machine.etiquettes);
      const missing = Array.from(needed).filter(req => !machineLabels.has(req.toLowerCase()));

      expect(missing.sort()).toEqual(['bonnet', 'devant']);
      expect(missing.length).toBe(2);
    });
  });

  describe('End-to-End Compatibility Pipeline', () => {
    it('complete compatibility check with formData works', () => {
      // Form asks for 'Bonnet' (normalized to 'bonnet')
      // Machine has "bonnet"
      const formData = { types: ['Bonnet'] };
      const machine = mockMachines[0];

      const neededSet = buildNeededSet(formData); // ['bonnet']
      const machineLabels = parseMachineLabels(machine.etiquettes);
      const missing = Array.from(neededSet).filter(req => !machineLabels.has(req.toLowerCase()));

      expect(neededSet.has('bonnet')).toBe(true);
      expect(machineLabels.has('bonnet')).toBe(true);
      expect(missing).toEqual([]);
    });

    it('fails when machine missing required labels', () => {
      // Form asks for 'Bonnet'
      // Machine missing "bonnet"
      const formData = { types: ['Bonnet'] };
      const machine = mockMachines[2]; // No bonnet

      const neededSet = buildNeededSet(formData);
      const machineLabels = parseMachineLabels(machine.etiquettes);
      const missing = Array.from(neededSet).filter(req => !machineLabels.has(req.toLowerCase()));

      expect(neededSet.has('bonnet')).toBe(true);
      expect(machineLabels.has('bonnet')).toBe(false);
      expect(missing).toEqual(['bonnet']);
    });

    it('intro version with only article tags works', () => {
      // Form asks for 'bonnet' in types, ignore options
      // Machine has "bonnet"
      const formData = { types: ['bonnet'], options: ['missing-option'] };
      const machine = mockMachines[0];

      // Simulate current modal logic: only use types, ignore options
      const neededSet = buildNeededSet({ ...formData, options: [] });
      const machineLabels = parseMachineLabels(machine.etiquettes);
      const missing = Array.from(neededSet).filter(req => !machineLabels.has(req.toLowerCase()));

      expect(neededSet.has('bonnet')).toBe(true);
      expect(neededSet.has('missing-option')).toBe(false);
      expect(machineLabels.has('bonnet')).toBe(true);
      expect(missing).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('handles machines with special characters in labels', () => {
      const machine = {
        etiquettes: ["emplacement,simple", "devant"]
      };
      const machineLabels = parseMachineLabels(machine.etiquettes);

      expect(machineLabels.has('emplacement,simple')).toBe(true);
      expect(machineLabels.has('devant')).toBe(true);
    });

    it('handles very long required sets', () => {
      const needed = buildNeededSet({
        types: 'bonnet,t-shirt,chemise,polo',
        options: 'devant,dos,manche,poche'
      });
      expect(needed.size).toBe(8);
    });

    it('ignores empty/whitespace labels', () => {
      const machine = {
        etiquettes: ["bonnet", "", " ", "t-shirt"]
      };
      const machineLabels = parseMachineLabels(machine.etiquettes);

      expect(machineLabels.has('bonnet')).toBe(true);
      expect(machineLabels.has('t-shirt')).toBe(true);
      expect(machineLabels.has('')).toBe(false);
      expect(machineLabels.has(' ')).toBe(false);
    });

    it('handles duplicate label normalization', () => {
      const needed = buildNeededSet({
        types: ['BONNET', 'bonnet'], // Duplicate case variations
        options: ['DEVANT', 'devant']
      });
      expect(needed.size).toBe(2); // Should deduplicate
    });
  });
});
