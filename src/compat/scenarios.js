// src/compat/scenarios.js
// Map/Object-agnostic scenario access utilities

/**
 * Extract machine IDs from scenarioByMachineId (Map or plain object)
 * @param {any} scenarioByMachineId - Either Map<machineId, scenario> or {machineId: scenario}
 * @returns {string[]} Array of machine IDs as strings
 */
export function listScenarioMachineIds(scenarioByMachineId) {
  if (!scenarioByMachineId) return [];

  // Handle Map objects
  if (typeof scenarioByMachineId.keys === 'function') {
    return Array.from(scenarioByMachineId.keys(), String);
  }

  // Handle plain objects
  return Object.keys(scenarioByMachineId).map(String);
}

/**
 * Get scenario for a specific machine ID from scenarioByMachineId
 * Handles both Map and plain object formats
 * @param {any} scenarioByMachineId - Either Map<machineId, scenario> or {machineId: scenario}
 * @param {string|number} machineId - Machine ID to look up
 * @param {any} fallback - Fallback scenario if not found
 * @returns {any} Scenario object or fallback
 */
export function getScenarioForMachine(scenarioByMachineId, machineId, fallback = null) {
  if (!scenarioByMachineId) return fallback;

  const k = String(machineId);

  // Handle Map objects (.get(), .has() methods)
  if (typeof scenarioByMachineId.get === 'function') {
    return scenarioByMachineId.get(machineId) ||
           scenarioByMachineId.get(k) ||
           fallback;
  }

  // Handle plain objects (property access)
  return scenarioByMachineId[machineId] ||
         scenarioByMachineId[k] ||
         fallback;
}
