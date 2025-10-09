// src/Pages/Admin/Commandes/hooks/__tests__/useForm.test.js
// Comprehensive tests for useForm hook
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock time utils
vi.mock('@/utils/time', () => ({
  convertHoursToHHMM: vi.fn(() => '16:30'),
}));

vi.mock('../../utils/timeRealtime', () => ({
  computeProvisionalEnd: vi.fn(() => new Date('2025-10-08T16:30:00')),
}));

import useForm from '../useForm.js';
import { convertHoursToHHMM } from '@/utils/time';
import { computeProvisionalEnd } from '../../utils/timeRealtime';

describe('useForm', () => {
  const defaultFormData = {
    id: null,
    numero: '',
    client: '',
    quantite: '',
    points: '',
    urgence: 3,
    dateLivraison: '',
    types: [],
    options: [],
    vitesseMoyenne: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('returns correct initial state', () => {
      const { result } = renderHook(() => useForm());

      expect(result.current.formData).toEqual(defaultFormData);
      expect(result.current.saved).toBe(true);
      expect(typeof result.current.handleChange).toBe('function');
      expect(typeof result.current.handleDateChange).toBe('function');
      expect(typeof result.current.toggleTag).toBe('function');
      expect(typeof result.current.resetForm).toBe('function');
    });

    it('initializes with custom formData', () => {
      const customData = {
        numero: 'TEST-001',
        client: 'Custom Client',
        quantite: 100,
        types: ['t-shirt'],
        options: ['peinture'],
      };

      const { result } = renderHook(() => useForm(customData));

      expect(result.current.formData).toEqual({
        ...defaultFormData,
        ...customData,
      });
      expect(result.current.saved).toBe(true);
    });
  });

  describe('Form State Management', () => {
    it('handleChange updates single fields correctly', () => {
      const { result } = renderHook(() => useForm());

      act(() => {
        result.current.handleChange('numero', 'TEST-001');
      });

      expect(result.current.formData.numero).toBe('TEST-001');
      expect(result.current.saved).toBe(false); // Should mark as unsaved
    });

    it('handleChange handles numeric fields', () => {
      const { result } = renderHook(() => useForm());

      act(() => {
        result.current.handleChange('quantite', 150);
      });

      expect(result.current.formData.quantite).toBe(150); // Real hook converts to number
      expect(result.current.saved).toBe(false);
    });

    it('handleDateChange sets dateLivraison correctly', () => {
      const { result } = renderHook(() => useForm());

      act(() => {
        result.current.handleDateChange({ target: { value: '2025-10-15' } });
      });

      expect(result.current.formData.dateLivraison).toBe('2025-10-15');
      expect(result.current.saved).toBe(false);
    });

    it('multiple handleChange calls accumulate correctly', () => {
      const { result } = renderHook(() => useForm());

      act(() => {
        result.current.handleChange('numero', 'TEST-001');
        result.current.handleChange('client', 'Test Client');
        result.current.handleChange('quantite', 75);
      });

      expect(result.current.formData).toEqual({
        ...defaultFormData,
        numero: 'TEST-001',
        client: 'Test Client',
        quantite: 75, // Converted to number
      });
      expect(result.current.saved).toBe(false);
    });
  });

  describe('Tag Management', () => {
    it('toggleTag adds tag to empty types array', () => {
      const { result } = renderHook(() => useForm());

      act(() => {
        result.current.toggleTag('types', 't-shirt');
      });

      expect(result.current.formData.types).toEqual(['t-shirt']);
      expect(result.current.saved).toBe(false);
    });

    it('toggleTag removes existing tag', () => {
      const { result } = renderHook(() => useForm());

      // Add tag first
      act(() => {
        result.current.toggleTag('types', 't-shirt');
      });
      expect(result.current.formData.types).toEqual(['t-shirt']);

      // Remove tag
      act(() => {
        result.current.toggleTag('types', 't-shirt');
      });
      expect(result.current.formData.types).toEqual([]);
      expect(result.current.saved).toBe(false);
    });

    it('toggleTag handles options array correctly', () => {
      const { result } = renderHook(() => useForm());

      act(() => {
        result.current.toggleTag('options', 'peinture');
      });

      expect(result.current.formData.options).toEqual(['peinture']);
      expect(result.current.saved).toBe(false);
    });

    it('toggleTag works with multiple tags', () => {
      const { result } = renderHook(() => useForm());

      act(() => {
        result.current.toggleTag('types', 't-shirt');
        result.current.toggleTag('types', 'bonnet');
        result.current.toggleTag('types', 'polo');
      });

      expect(result.current.formData.types).toEqual(['t-shirt', 'bonnet', 'polo']);

      // Remove middle tag
      act(() => {
        result.current.toggleTag('types', 'bonnet');
      });

      expect(result.current.formData.types).toEqual(['t-shirt', 'polo']);
    });

    it('toggleTag maintains other fields when modifying tags', () => {
      const { result } = renderHook(() => useForm());

      act(() => {
        result.current.handleChange('numero', 'TEST-001');
        result.current.toggleTag('types', 't-shirt');
      });

      expect(result.current.formData.numero).toBe('TEST-001');
      expect(result.current.formData.types).toEqual(['t-shirt']);
    });
  });

  describe('Form Reset & State', () => {
    it('resetForm restores original data and marks as saved', () => {
      const { result } = renderHook(() => useForm());

      // Make changes
      act(() => {
        result.current.handleChange('numero', 'MODIFIED');
        result.current.toggleTag('types', 't-shirt');
      });

      expect(result.current.formData.numero).toBe('MODIFIED');
      expect(result.current.formData.types).toEqual(['t-shirt']);
      expect(result.current.saved).toBe(false);

      // Reset
      act(() => {
        result.current.resetForm();
      });

      expect(result.current.formData).toEqual(defaultFormData);
      expect(result.current.saved).toBe(true);
    });

    it('resetForm works with custom initial data', () => {
      const customInitial = {
        numero: 'CUSTOM-001',
        types: ['polo'],
        quantite: '50',
      };

      const { result } = renderHook(() => useForm(customInitial));

      // Modify
      act(() => {
        result.current.handleChange('numero', 'MODIFIED');
        result.current.toggleTag('types', 't-shirt');
      });

      // Reset to original custom data
      act(() => {
        result.current.resetForm();
      });

      expect(result.current.formData.numero).toBe('CUSTOM-001');
      expect(result.current.formData.types).toEqual(['polo']);
      expect(result.current.formData.quantite).toBe('50');
      expect(result.current.saved).toBe(true);
    });
  });

  describe('Stable References', () => {
    it('provides stable function references across re-renders', () => {
      const { result } = renderHook(() => useForm());

      const initialFunctions = {
        handleChange: result.current.handleChange,
        handleDateChange: result.current.handleDateChange,
        toggleTag: result.current.toggleTag,
        resetForm: result.current.resetForm,
      };

      // Trigger re-render
      act(() => {
        result.current.handleChange('numero', 'trigger');
      });

      // Functions should maintain stable references
      expect(result.current.handleChange).toBe(initialFunctions.handleChange);
      expect(result.current.handleDateChange).toBe(initialFunctions.handleDateChange);
      expect(result.current.toggleTag).toBe(initialFunctions.toggleTag);
      expect(result.current.resetForm).toBe(initialFunctions.resetForm);
    });
  });

  describe('Data Validation & Sanitization', () => {
    it('handles empty string values correctly', () => {
      const { result } = renderHook(() => useForm());

      act(() => {
        result.current.handleChange('numero', '');
        result.current.handleChange('client', '');
        result.current.handleChange('quantite', '');
      });

      expect(result.current.formData.numero).toBe('');
      expect(result.current.formData.client).toBe('');
      expect(result.current.formData.quantite).toBe('');
    });

    it('handles numeric field conversions correctly', () => {
      const { result } = renderHook(() => useForm());

      act(() => {
        result.current.handleChange('quantite', 75);     // Should convert to number
        result.current.handleChange('points', 50);       // Should convert to number
        result.current.handleChange('urgence', 5);       // Should convert to number
        result.current.handleChange('vitesseMoyenne', 750); // Should stay as-is or convert
      });

      expect(result.current.formData.quantite).toBe(75);
      expect(result.current.formData.points).toBe(50);
      expect(result.current.formData.urgence).toBe(5);
    });
  });

  describe('Form Data Integrity', () => {
    it('does not modify default empty arrays accidentally', () => {
      const { result } = renderHook(() => useForm());

      // Access form data to ensure arrays are separate objects
      const initialTypes = result.current.formData.types;
      const initialOptions = result.current.formData.options;

      expect(initialTypes).toEqual([]);
      expect(initialOptions).toEqual([]);

      // Modifying one array shouldn't affect frozen defaults
      act(() => {
        result.current.toggleTag('types', 't-shirt');
      });

      expect(result.current.formData.options).toEqual([]); // Should remain empty
      expect(result.current.formData.options).not.toBe(initialOptions); // But should be new array
    });

    it('maintains proper array references in state', () => {
      const { result } = renderHook(() => useForm());

      const initialTypesRef = result.current.formData.types;

      act(() => {
        result.current.toggleTag('types', 't-shirt');
      });

      // Arrays should be new references after state updates
      expect(result.current.formData.types).not.toBe(initialTypesRef);
      expect(result.current.formData.types).toEqual(['t-shirt']);
    });
  });

  describe('Edge Cases', () => {
    it('handles null or undefined initial data', () => {
      const { result } = renderHook(() => useForm(null));

      expect(result.current.formData).toEqual(defaultFormData);
    });

    it('handles partial initial data', () => {
      const partialData = { numero: 'PARTIAL-001', quantite: 25 };
      const { result } = renderHook(() => useForm(partialData));

      expect(result.current.formData.numero).toBe('PARTIAL-001');
      expect(result.current.formData.quantite).toBe(25);
      expect(result.current.formData.types).toEqual([]); // Should have defaults
    });

    it('handles undefined field updates gracefully', () => {
      const { result } = renderHook(() => useForm());

      // This shouldn't crash
      act(() => {
        result.current.handleChange(undefined, 'value');
        result.current.handleChange('nonexistentField', 'value');
      });

      expect(result.current.formData).toEqual(defaultFormData);
    });

    it('handles date formatting correctly', () => {
      const { result } = renderHook(() => useForm());

      act(() => {
        result.current.handleDateChange({ target: { value: '2025-10-08' } });
      });

      expect(result.current.formData.dateLivraison).toBe('2025-10-08');
    });
  });

  describe('Complex Form Interactions', () => {
    it('supports complex multi-field updates', () => {
      const { result } = renderHook(() => useForm());

      act(() => {
        // Update multiple fields
        result.current.handleChange('numero', 'COMPLEX-001');
        result.current.handleChange('client', 'Complex Client');
        result.current.handleChange('quantite', '200');
        result.current.toggleTag('types', 't-shirt');
        result.current.toggleTag('types', 'polo');
        result.current.toggleTag('options', 'peinture');
        result.current.handleDateChange('2025-10-10');
      });

      expect(result.current.formData).toEqual({
        ...defaultFormData,
        numero: 'COMPLEX-001',
        client: 'Complex Client',
        quantite: '200',
        types: ['t-shirt', 'polo'],
        options: ['peinture'],
        delivery_date: '2025-10-10',
      });
      expect(result.current.saved).toBe(false);
    });

    it('maintains form state through multiple operations', () => {
      const { result } = renderHook(() => useForm());

      // Add some data
      act(() => {
        result.current.handleChange('numero', 'STATE-001');
        result.current.toggleTag('types', 't-shirt');
      });

      expect(result.current.saved).toBe(false);

      // Modify
      act(() => {
        result.current.handleChange('numero', 'STATE-002');
        result.current.toggleTag('options', 'wash');
      });

      expect(result.current.formData.numero).toBe('STATE-002');
      expect(result.current.formData.types).toEqual(['t-shirt']);
      expect(result.current.formData.options).toEqual(['wash']);
      expect(result.current.saved).toBe(false);

      // Reset
      act(() => {
        result.current.resetForm();
      });

      expect(result.current.formData).toEqual(defaultFormData);
      expect(result.current.saved).toBe(true);
    });
  });

  describe('Performance & Memory', () => {
    it('creates new object references on state changes', () => {
      const { result } = renderHook(() => useForm());

      const initialFormRef = result.current.formData;

      act(() => {
        result.current.handleChange('numero', 'change');
      });

      // Object reference should change (immutable updates)
      expect(result.current.formData).not.toBe(initialFormRef);
      expect(result.current.formData.numero).toBe('change');
    });

    it('preserves unchanged fields during updates', () => {
      const { result } = renderHook(() => useForm({
        numero: 'INITIAL',
        quantite: '100',
        types: ['initial-type'],
      }));

      act(() => {
        result.current.handleChange('client', 'New Client');
      });

      // Unchanged fields should maintain original references if primitive
      expect(result.current.formData.numero).toBe('INITIAL');
      expect(result.current.formData.quantite).toBe('100');
      expect(result.current.formData.types).toEqual(['initial-type']);
      expect(result.current.formData.client).toBe('New Client');
    });
  });
});
