// src/Pages/Admin/Commandes/components/__tests__/MachineAndTimeConfirmModal.test.jsx
// Comprehensive tests for MachineAndTimeConfirmModal component
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MachineAndTimeConfirmModal } from '../MachineAndTimeConfirmModal.jsx';
import { computePreviewMinutes, headsFactor } from '@/utils/calculator/previewCalculator.js';

// Mock dependencies
vi.mock('@/compat/labels', () => ({
  buildNeededSet: vi.fn(),
}));

vi.mock('@/compat/scenarios', () => ({
  listScenarioMachineIds: vi.fn(),
  getScenarioForMachine: vi.fn(),
}));

vi.mock('@/compat/rules', () => ({
  computeMachineCompatibility: vi.fn(),
  isMachineCompatible: vi.fn(),
}));

vi.mock('@/utils/calculator/previewCalculator.js', () => ({
  computePreviewMinutes: vi.fn(),
  headsFactor: vi.fn(),
}));

vi.mock('../utils/timeRealtime', () => ({
  clampPercentToStep5: vi.fn(),
  computeProvisionalEnd: vi.fn(),
}));

vi.mock('../../../../utils/time', () => ({
  convertHoursToHHMM: vi.fn(),
}));

// Import after mocks
import { buildNeededSet } from '@/compat/labels';
import { listScenarioMachineIds, getScenarioForMachine } from '@/compat/scenarios';
import { computeMachineCompatibility, isMachineCompatible } from '@/compat/rules';
import { computePreviewMinutes } from '@/utils/calculator/previewCalculator';
import { clampPercentToStep5, computeProvisionalEnd } from '../utils/timeRealtime';
import { convertHoursToHHMM } from '../../../../utils/time';

describe('MachineAndTimeConfirmModal', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    machines: [
      {
        id: 'machine-1',
        nom: 'Mono Machine',
        nbTetes: 1,
        champLargeurMm: 200,
        champHauteurMm: 300,
        maxCouleurs: 10,
      },
      {
        id: 'machine-2',
        nom: 'Multi Machine',
        nbTetes: 4,
        champLargeurMm: 400,
        champHauteurMm: 600,
        maxCouleurs: 15,
      },
    ],
    formData: {
      largeurMm: 150,
      hauteurMm: 250,
      nbCouleurs: 8,
    },
    selectedScenario: {
      machine: { id: 'machine-1' },
      machine_id: 'machine-1',
    },
    scenarioByMachineId: new Map([
      ['machine-1', { id: 'scenario-1' }],
      ['machine-2', { id: 'scenario-2' }],
    ]),
    currentScenario: { id: 'scenario-1' },
    confirmCoef: 150,
    setConfirmCoef: vi.fn(),
    monoUnitsUsed: 1,
    setMonoUnitsUsed: vi.fn(),
    machineAssignee: 'machine-1',
    setMachineAssignee: vi.fn(),
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    buildNeededSet.mockReturnValue(new Set(['t-shirt']));
    listScenarioMachineIds.mockReturnValue(['machine-1', 'machine-2']);
    getScenarioForMachine.mockReturnValue({ id: 'scenario-1' });
    isMachineCompatible.mockReturnValue(true);
    computeMachineCompatibility.mockReturnValue({
      ok: true,
      reasons: [],
      matched: ['t-shirt'],
      missing: [],
      machineId: 'machine-1',
      scenarioId: 'scenario-1',
      labels: ['t-shirt', 'coeur'],
    });

    computePreviewMinutes.mockReturnValue({
      broderieTheoAdj: 2.5,
      nettoyageApplique: 0.5,
      totalTheoAdj: 3.0,
      broderieAppliquee: 3.75, // 2.5 * 1.5
      totalApplique: 4.25, // 3.0 * 1.5 (approx)
      coefTotalEquivalent: 150,
    });

    clampPercentToStep5.mockImplementation((val) => val);
    computeProvisionalEnd.mockReturnValue(new Date('2025-01-10T12:25:00'));
    convertHoursToHHMM.mockReturnValue('04:15');
  });

  it('does not render when isOpen is false', () => {
    render(<MachineAndTimeConfirmModal {...mockProps} isOpen={false} />);
    expect(screen.queryByText('Confirmer machine & durée')).not.toBeInTheDocument();
  });

  it('does not render when no selectedScenario', () => {
    render(<MachineAndTimeConfirmModal {...mockProps} selectedScenario={null} />);
    expect(screen.queryByText('Confirmer machine & durée')).not.toBeInTheDocument();
  });

  it('renders modal with machine selection and coefficient controls', () => {
    render(<MachineAndTimeConfirmModal {...mockProps} />);

    expect(screen.getByText('Confirmer machine & durée')).toBeInTheDocument();
    expect(screen.getByText('Mono Machine')).toBeInTheDocument();
    expect(screen.getByText('Multi Machine')).toBeInTheDocument();
    expect(screen.getByLabelText('Coefficient broderie (%)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('150')).toBeInTheDocument();
  });

  it('shows types d\'article section', () => {
    render(<MachineAndTimeConfirmModal {...mockProps} />);

    expect(screen.getByText("Types d'article :")).toBeInTheDocument();
    expect(screen.getByText("t-shirt")).toBeInTheDocument();
  });

  it('displays duration summary with calculated values', () => {
    render(<MachineAndTimeConfirmModal {...mockProps} />);

    expect(screen.getByText('Résumé des durées')).toBeInTheDocument();
    expect(screen.getByText('Broderie appliquée : 3.75 min')).toBeInTheDocument();
    expect(screen.getByText('Total appliqué : 4.25 min')).toBeInTheDocument();
    expect(screen.getByText('Fin estimée : 4.25 HH')).toBeInTheDocument();
  });

  it('updates coefficient when slider changes', () => {
    render(<MachineAndTimeConfirmModal {...mockProps} />);

    const slider = screen.getByLabelText('Coefficient broderie (%)');
    fireEvent.change(slider, { target: { value: '200' } });

    expect(mockProps.setConfirmCoef).toHaveBeenCalledWith(200);
  });

  it('shows mono units control for mono machines', () => {
    render(<MachineAndTimeConfirmModal {...mockProps} />); // machine-1 has nbTetes: 1 (mono)

    expect(screen.getByText('Nombre d\'unités mono utilisées en parallèle')).toBeInTheDocument();
    const input = screen.getByDisplayValue('1');
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '3' } });
    expect(mockProps.setMonoUnitsUsed).toHaveBeenCalledWith(3);
  });

  it('hides mono units control for multi-head machines', () => {
    render(<MachineAndTimeConfirmModal {...mockProps} machineAssignee="machine-2" />); // machine-2 has nbTetes: 4

    expect(screen.queryByText('Nombre d\'unités mono utilisées en parallèle')).not.toBeInTheDocument();
  });

  it('changes machine selection', () => {
    render(<MachineAndTimeConfirmModal {...mockProps} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'machine-2' } });

    expect(mockProps.setMachineAssignee).toHaveBeenCalledWith('machine-2');
  });

  it('shows incompatibility warning when machine is incompatible', () => {
    computeMachineCompatibility.mockReturnValue({
      ok: false,
      reasons: ['Étiquette manquante: "t-shirt"', 'Largeur 250mm > limite machine 200mm'],
      matched: [],
      missing: ['t-shirt'],
      machineId: 'machine-1',
      labels: ['bonnet'],
    });

    render(<MachineAndTimeConfirmModal {...mockProps} />);

    expect(screen.getByText('⚠️ Machine incompatible')).toBeInTheDocument();
    expect(screen.getByText('Étiquette manquante: "t-shirt", Largeur 250mm > limite machine 200mm')).toBeInTheDocument();
  });

  it('disables confirm button when machine is incompatible', () => {
    computeMachineCompatibility.mockReturnValue({
      ok: false,
      reasons: ['Incompatible'],
      matched: [],
      missing: ['t-shirt'],
    });

    render(<MachineAndTimeConfirmModal {...mockProps} />);

    const confirmButton = screen.getByText('Confirmer ce choix');
    expect(confirmButton).toBeDisabled();
  });

  it('calls onConfirm with correct payload when confirm button is clicked', () => {
    render(<MachineAndTimeConfirmModal {...mockProps} />);

    const confirmButton = screen.getByText('Confirmer ce choix');
    fireEvent.click(confirmButton);

    expect(mockProps.onConfirm).toHaveBeenCalledWith({
      machineId: 'machine-1',
      coef: 150,
      monoUnitsUsed: 1,
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<MachineAndTimeConfirmModal {...mockProps} />);

    const cancelButton = screen.getByText('Annuler');
    fireEvent.click(cancelButton);

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when close icon is clicked', () => {
    render(<MachineAndTimeConfirmModal {...mockProps} />);

    const closeButton = screen.getByLabelText('Fermer');
    fireEvent.click(closeButton);

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('applies mono multiplier to coefficient calculation', () => {
    render(<MachineAndTimeConfirmModal {...mockProps} monoUnitsUsed={3} />);

    expect(computePreviewMinutes).toHaveBeenCalledWith(
      expect.objectContaining({
        monoUnitsUsed: 3,
      })
    );
  });

  it('passes formData dimensions to compatibility check', () => {
    render(<MachineAndTimeConfirmModal {...mockProps} />);

    expect(computeMachineCompatibility).toHaveBeenCalledWith(
      expect.any(Object), // machine
      expect.any(Object), // scenario
      expect.any(Set),   // neededTypes
      {
        largeurMm: 150,
        hauteurMm: 250,
        nbCouleurs: 8,
      }
    );
  });

  it('includes disabled machines in select options with warning labels', () => {
    // Mock one incompatible machine
    isMachineCompatible
      .mockReturnValueOnce(true)  // machine-1 compatible
      .mockReturnValueOnce(false); // machine-2 incompatible

    render(<MachineAndTimeConfirmModal {...mockProps} />);

    const select = screen.getByRole('combobox');

    // Should have options for both machines
    expect(select).toContainElement(screen.getByText(/-.*indispo.*/));
  });

  it('includes selected machine in options even if not in compatible list', () => {
    listScenarioMachineIds.mockReturnValue(['machine-2']); // Only machine-2 has scenario
    buildNeededSet.mockReturnValue(new Set(['t-shirt']));

    render(<MachineAndTimeConfirmModal {...mockProps} machineAssignee="machine-1" />);

    // Should still show both machines in select
    expect(screen.getByText('Mono Machine')).toBeInTheDocument();
    expect(screen.getByText('Multi Machine')).toBeInTheDocument();
  });

  it('logs diagnostic information to console during render', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    render(<MachineAndTimeConfirmModal {...mockProps} />);

    expect(consoleLogSpy).toHaveBeenCalledWith('[Modal] neededTypesSet', expect.any(Set));
    expect(consoleLogSpy).toHaveBeenCalledWith('[Modal] scenario keys', expect.any(Array));

    consoleLogSpy.mockRestore();
  });
});
