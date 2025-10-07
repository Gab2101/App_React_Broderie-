import { describe, it, expect } from 'vitest';
import { groupAndSortByMachine } from '@/Pages/Admin/Commandes/utils/grouping';

describe('groupAndSortByMachine', () => {
  it('groups commandes by machine', () => {
    const commandes = [
      { id: 1, machineAssignee: 'Machine A', statut: 'En cours' },
      { id: 2, machineAssignee: 'Machine B', statut: 'A commencer' },
      { id: 3, machineAssignee: 'Machine A', statut: 'A commencer' },
    ];

    const result = groupAndSortByMachine(commandes);

    expect(result.size).toBe(2);
    expect(result.get('Machine A')).toHaveLength(2);
    expect(result.get('Machine B')).toHaveLength(1);
  });

  it('handles commandes without machine assignment', () => {
    const commandes = [
      { id: 1, machineAssignee: null, statut: 'A commencer' },
      { id: 2, machineAssignee: 'Machine A', statut: 'En cours' },
    ];

    const result = groupAndSortByMachine(commandes);

    expect(result.has('Non assignée') || result.has(null)).toBe(true);
  });

  it('sorts commandes by status priority', () => {
    const commandes = [
      { id: 1, machineAssignee: 'Machine A', statut: 'A commencer' },
      { id: 2, machineAssignee: 'Machine A', statut: 'En cours' },
      { id: 3, machineAssignee: 'Machine A', statut: 'Terminée' },
    ];

    const result = groupAndSortByMachine(commandes);
    const machineACommandes = result.get('Machine A');

    // "En cours" should come first
    expect(machineACommandes[0].statut).toBe('En cours');
  });

  it('handles empty array', () => {
    const result = groupAndSortByMachine([]);
    expect(result.size).toBe(0);
  });

  it('handles undefined input', () => {
    const result = groupAndSortByMachine(undefined);
    expect(result.size).toBe(0);
  });

  it('preserves all commande properties', () => {
    const commandes = [
      { 
        id: 1, 
        machineAssignee: 'Machine A', 
        statut: 'En cours',
        client: 'Client A',
        numero: 'CMD001'
      },
    ];

    const result = groupAndSortByMachine(commandes);
    const grouped = result.get('Machine A')[0];

    expect(grouped.client).toBe('Client A');
    expect(grouped.numero).toBe('CMD001');
  });

  it('groups multiple machines correctly', () => {
    const commandes = [
      { id: 1, machineAssignee: 'Machine A', statut: 'En cours' },
      { id: 2, machineAssignee: 'Machine B', statut: 'En cours' },
      { id: 3, machineAssignee: 'Machine C', statut: 'En cours' },
      { id: 4, machineAssignee: 'Machine A', statut: 'A commencer' },
    ];

    const result = groupAndSortByMachine(commandes);

    expect(result.size).toBe(3);
    expect(result.get('Machine A')).toHaveLength(2);
    expect(result.get('Machine B')).toHaveLength(1);
    expect(result.get('Machine C')).toHaveLength(1);
  });
});
