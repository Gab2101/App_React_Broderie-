import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CommandeCard from '@/Pages/Admin/Commandes/components/CommandeCard';

const mockCommande = {
  id: 1,
  numero: 'CMD001',
  client: 'Client Test',
  statut: 'En cours',
  deballe: false,
  duree_totale_heures: 2.5,
};

describe('CommandeCard', () => {
  it('renders commande information correctly', () => {
    render(<CommandeCard commande={mockCommande} />);

    expect(screen.getByText('Commande #CMD001')).toBeInTheDocument();
    expect(screen.getByText('Client :')).toBeInTheDocument();
    expect(screen.getByText('Client Test')).toBeInTheDocument();
  });

  it('calls onEdit when Modifier button is clicked', () => {
    const onEdit = vi.fn();
    render(<CommandeCard commande={mockCommande} onEdit={onEdit} />);

    const modifierButton = screen.getByRole('button', { name: /Modifier/i });
    fireEvent.click(modifierButton);

    expect(onEdit).toHaveBeenCalledWith(mockCommande);
  });

  it('calls onDelete when Supprimer button is clicked', () => {
    const onDelete = vi.fn();
    render(<CommandeCard commande={mockCommande} onDelete={onDelete} />);

    const supprimerButton = screen.getByRole('button', { name: /Supprimer/i });
    fireEvent.click(supprimerButton);

    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('calls onStatusChange when select value changes', () => {
    const onStatusChange = vi.fn();
    render(<CommandeCard commande={mockCommande} onStatusChange={onStatusChange} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Terminée' } });

    expect(onStatusChange).toHaveBeenCalledWith(1, 'Terminée');
  });

  it('calls onDeballeChange when checkbox is toggled', () => {
    const onDeballeChange = vi.fn();
    render(<CommandeCard commande={mockCommande} onDeballeChange={onDeballeChange} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(onDeballeChange).toHaveBeenCalledWith(1, true);
  });

  it('handles legacy prop names (cmd instead of commande)', () => {
    const onEdit = vi.fn();
    render(<CommandeCard cmd={mockCommande} onEdit={onEdit} />);

    const modifierButton = screen.getByRole('button', { name: /Modifier/i });
    fireEvent.click(modifierButton);

    expect(onEdit).toHaveBeenCalledWith(mockCommande);
  });

  it('handles legacy prop names (onStatutChange instead of onStatusChange)', () => {
    const onStatutChange = vi.fn();
    render(<CommandeCard commande={mockCommande} onStatutChange={onStatutChange} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Terminée' } });

    expect(onStatutChange).toHaveBeenCalledWith(1, 'Terminée');
  });

  it('validates prop types at runtime with asFn guard', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Test that asFn logs error for invalid function props
    render(<CommandeCard commande={mockCommande} onEdit="not a function" />);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CommandeCard] prop onEdit must be a function'),
      'not a function'
    );

    consoleSpy.mockRestore();
  });

  it('handles missing props gracefully with defaults', () => {
    expect(() => {
      render(<CommandeCard commande={mockCommande} />);
    }).not.toThrow();

    const modifierButton = screen.getByRole('button', { name: /Modifier/i });
    expect(modifierButton).toBeInTheDocument();
  });
});
