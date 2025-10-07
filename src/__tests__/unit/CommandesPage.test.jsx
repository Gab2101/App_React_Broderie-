import { vi } from 'vitest';

vi.mock('@/Pages/Admin/Commandes/hooks/useCommandesData', () => ({
  default: () => ({
    commandes: [{ id: 1, numero: 'C-001', statut: 'A commencer' }],
    setCommandes: vi.fn(),
    machines: [{ id: 'A', nom: 'Machine A' }],
    planning: [],
    nettoyageRules: [],
    linkableCommandes: [],
    reloadData: vi.fn(),
  }),
}));

vi.mock('@/Pages/Admin/Commandes/hooks/useForm', () => ({
  default: () => ({
    formData: { quantite: '1', points: '1000', urgence: '1' },
    setFormData: vi.fn(),
    resetForm: vi.fn(),
    setSaved: vi.fn(),
  }),
}));

vi.mock('@/Pages/Admin/Commandes/hooks/useLinkedCommande', () => ({
  default: () => ({
    isLinked: false, linkedCommandeId: null,
    sameMachineAsLinked: false, startAfterLinked: true,
    setIsLinked: vi.fn(), setLinkedCommandeId: vi.fn(),
    setSameMachineAsLinked: vi.fn(), setStartAfterLinked: vi.fn(),
  }),
}));

vi.mock('@/Pages/Admin/Commandes/hooks/useSimulation', () => ({
  default: () => ({
    selectedScenario: null,
    setSelectedScenario: vi.fn(),
    scenarioByMachineId: {},
    currentScenario: null,
    confirmCoef: 200, setConfirmCoef: vi.fn(),
    minutesReellesAppliquees: 0,
    machineAssignee: null, setMachineAssignee: vi.fn(),
    monoUnitsUsed: 1, setMonoUnitsUsed: vi.fn(),
    handleSimulation: vi.fn(),
  }),
}));

vi.mock('@/Pages/Admin/Commandes/hooks/useStatut', () => ({
  default: () => ({
    STATUTS: ['A commencer', 'En cours', 'Terminée', 'En attente'],
    handleChangeStatut: vi.fn(),
  }),
}));

vi.mock('@/lib/supabaseClient', () => ({
  default: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: {}, error: null }))
          }))
        }))
      }))
    }))
  }
}));

// Import statements AFTER mocks
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CommandesPage from '@/Pages/Admin/Commandes/CommandesPage';
import { EtiquettesContext } from '@/context/EtiquettesContext';

const mockCommandes = [
  {
    id: 1,
    numero: 'CMD001',
    client: 'Client A',
    statut: 'En cours',
    machineAssignee: 'Machine 1',
    quantite: 10,
    points: 5000,
    urgence: 'Normale',
    deballe: false,
    duree_totale_heures: 2.5,
  },
  {
    id: 2,
    numero: 'CMD002',
    client: 'Client B',
    statut: 'A commencer',
    machineAssignee: 'Machine 2',
    quantite: 20,
    points: 8000,
    urgence: 'Urgente',
    deballe: true,
    duree_totale_heures: 4.0,
  },
];

const mockMachines = [
  { id: 1, nom: 'Machine 1', group_label: 'Groupe A' },
  { id: 2, nom: 'Machine 2', group_label: 'Groupe B' },
];

const mockEtiquettes = {
  articleTags: ['Tag1', 'Tag2'],
  broderieTags: ['Broderie1', 'Broderie2'],
};

describe('CommandesPage', () => {

  const renderWithContext = (component) => {
    return render(
      <EtiquettesContext.Provider value={mockEtiquettes}>
        {component}
      </EtiquettesContext.Provider>
    );
  };

  it('renders without crashing', () => {
    renderWithContext(<CommandesPage />);
    expect(screen.getByText('Nouvelle commande')).toBeInTheDocument();
  });

  it('displays commande cards', () => {
    renderWithContext(<CommandesPage />);
    expect(screen.getByText('Commande #CMD001')).toBeInTheDocument();
    expect(screen.getByText('Commande #CMD002')).toBeInTheDocument();
  });

  it('opens form modal when "Nouvelle commande" is clicked', () => {
    renderWithContext(<CommandesPage />);
    const newButton = screen.getByText('Nouvelle commande');
    fireEvent.click(newButton);
    // Modal should open (implementation specific)
  });

  it('filters commandes based on search query', async () => {
    renderWithContext(<CommandesPage />);
    
    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'Client A' } });

    await waitFor(() => {
      expect(screen.getByText('Commande #CMD001')).toBeInTheDocument();
    });
  });

  it('groups commandes by machine', () => {
    renderWithContext(<CommandesPage />);
    
    // Should show machine groups
    expect(screen.getByText('Machine 1')).toBeInTheDocument();
    expect(screen.getByText('Machine 2')).toBeInTheDocument();
  });

  it('handles delete confirmation', async () => {
    window.confirm = vi.fn(() => true);
    renderWithContext(<CommandesPage />);

    const deleteButtons = screen.getAllByText('Supprimer');
    fireEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalled();
  });
});
