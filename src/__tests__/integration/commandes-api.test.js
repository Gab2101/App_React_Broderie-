import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabase } from '@/supabaseClient'
import {
  createCommandeAndPlanning,
  updateCommande,
  deleteCommandeWithPlanning
} from '../../Pages/Admin/Commandes/services/commandesApi'

describe('Commandes API Integration Tests', () => {
  // Test data that will be created and cleaned up
  let testCommandeId = null
  let testPlanningIds = []

  // Test data
  const testMachine = {
    id: 'test-machine-integration',
    nom: 'Test Machine Integration',
    nbTetes: 12,
    etiquettes: ['T-shirt', 'Polo']
  }

  const testFormData = {
    numero: 'TEST-001',
    client: 'Test Client',
    quantite: 50,
    points: 500,
    vitesseMoyenne: 600,
    dateLivraison: '2025-12-31',
    types: ['T-shirt'],
    options: [],
    urgence: 3,
    deballe: false
  }

  beforeAll(async () => {
    // Ensure we can connect to Supabase
    const { error } = await supabase.from('commandes').select('id').limit(1)
    if (error) {
      console.warn('Skipping integration tests - database not accessible:', error.message)
      return
    }
  }, 10000)

  afterAll(async () => {
    // Clean up test data
    if (testCommandeId) {
      try {
        await deleteCommandeWithPlanning(testCommandeId)
      } catch (error) {
        console.warn('Failed to clean up test commande:', error)
      }
    }

    // Clean up any orphaned planning entries
    for (const planningId of testPlanningIds) {
      try {
        await supabase.from('planning').delete().eq('id', planningId)
      } catch (error) {
        console.warn('Failed to clean up test planning:', error)
      }
    }
  }, 10000)

  describe('createCommandeAndPlanning', () => {
    it('should create commande and planning successfully', async () => {
      // Skip if database not accessible
      const { error: checkError } = await supabase.from('commandes').select('id').limit(1)
      if (checkError) return

      const result = await createCommandeAndPlanning({
        formData: testFormData,
        machine: testMachine,
        coef: 100,
        planning: [],
        commandes: [],
        machines: [testMachine],
        nettoyageRules: [],
        articleTags: [{ label: 'T-shirt', nettoyage: 45 }],
        linked: { isLinked: false, linkedCommandeId: null, sameMachineAsLinked: false, startAfterLinked: false },
      })

      expect(result.errorCmd).toBeUndefined()
      expect(result.createdCmd).toBeDefined()
      expect(result.createdCmd.numero).toBe(testFormData.numero)
      expect(result.createdCmd.client).toBe(testFormData.client)

      // Store for cleanup
      testCommandeId = result.createdCmd.id

      // Verify planning was created
      const { data: planningData, error: planningError } = await supabase
        .from('planning')
        .select('*')
        .eq('commandeId', testCommandeId)

      expect(planningError).toBeNull()
      expect(planningData).toBeDefined()
      expect(planningData.length).toBeGreaterThan(0)

      // Store planning IDs for cleanup
      testPlanningIds = planningData.map(p => p.id)
    }, 20000)

    it('should return error for incompatible machine', async () => {
      // Skip if database not accessible
      const { error: checkError } = await supabase.from('commandes').select('id').limit(1)
      if (checkError) return

      const incompatibleFormData = {
        ...testFormData,
        numero: 'TEST-INCOMPATIBLE',
        types: ['Non-existent type']
      }

      const result = await createCommandeAndPlanning({
        formData: incompatibleFormData,
        machine: testMachine,
        coef: 100,
        planning: [],
        commandes: [],
        machines: [testMachine],
        nettoyageRules: [],
        articleTags: [],
        linked: { isLinked: false, linkedCommandeId: null, sameMachineAsLinked: false, startAfterLinked: false },
      })

      expect(result.errorCmd).toBeDefined()
      expect(result.errorCmd.message).toContain('Machine incompatible')
      expect(result.createdCmd).toBeUndefined()
    }, 15000)
  })

  describe('updateCommande', () => {
    it('should update commande successfully', async () => {
      // Skip if no test commande was created or database not accessible
      if (!testCommandeId) return

      const updateData = {
        id: testCommandeId,
        client: 'Updated Test Client'
      }

      const result = await updateCommande(updateData)

      expect(result.error).toBeFalsy()

      // Verify the update
      const { data: updatedCommande, error: fetchError } = await supabase
        .from('commandes')
        .select('client')
        .eq('id', testCommandeId)
        .single()

      expect(fetchError).toBeNull()
      expect(updatedCommande.client).toBe('Updated Test Client')
    }, 15000)

    it('should return error for non-existent commande', async () => {
      // Skip if database not accessible
      const { error: checkError } = await supabase.from('commandes').select('id').limit(1)
      if (checkError) return

      const result = await updateCommande({
        id: 999999,
        client: 'Non-existent'
      })

      expect(result.error).toBeDefined()
    }, 10000)
  })

  describe('deleteCommandeWithPlanning', () => {
    it('should delete commande and related planning', async () => {
      // Skip if no test commande was created
      if (!testCommandeId) return

      const result = await deleteCommandeWithPlanning(testCommandeId)

      expect(result.error).toBeFalsy()

      // Verify deletion
      const { data: deletedCommande, error: fetchError } = await supabase
        .from('commandes')
        .select('id')
        .eq('id', testCommandeId)
        .single()

      expect(deletedCommande).toBeNull()

      // Verify planning deletion
      const { data: deletedPlanning, error: planningFetchError } = await supabase
        .from('planning')
        .select('id')
        .eq('commandeId', testCommandeId)

      expect(planningFetchError).toBeNull()
      expect(deletedPlanning.length).toBe(0)

      // Clear cleanup variables since deletion was successful
      testCommandeId = null
      testPlanningIds = []
    }, 15000)
  })
})
